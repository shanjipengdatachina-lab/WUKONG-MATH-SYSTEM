/* ==========================================================================
   考试切片（assets/js/exam-slices-live.js）
   --------------------------------------------------------------------------
   用户 2026-10-07："学生账户可以上传考试图片，标记年月日和考试情况，然后后台分析
   形成考情切片报告……学生系统增加一个考试切片的管理功能。"

   这一页三件事：**传**（拍照上传 + 填日期与情况）、**看**（列表 + 考情报告）、**管**（改 / 删）。

   两条做法上的选择：
     · 图片**在前端先压一道**再传。手机直出三五 MB，压到长边 1600 通常 300KB 上下 ——
       传得快、存得省。而且不影响框错题：框用的是**百分比坐标**，跟像素尺寸无关。
     · 「考了哪几章」是**多选**（一场考试常常覆盖好几章），选完这张切片才落得到
       3D 时间轴的对应区间上。

   依赖：api.js（取数）、auth-client.js（身份）、entitlement.js（会员遮罩那类）。
   ========================================================================== */
(function () {
  'use strict';

  var API = window.WK_API;
  var AUTH = window.WK_AUTH;
  if (!API) { return; }

  var listEl = document.getElementById('slice-list');
  var listNote = document.getElementById('slice-count');
  var repEl = document.getElementById('slice-report');
  var formEl = document.getElementById('slice-form');
  var secForm = document.getElementById('upload-sec');
  var thumbsEl = document.getElementById('up-thumbs');
  var chapsEl = document.getElementById('up-chaps');
  var msgEl = document.getElementById('up-note-msg');
  if (!listEl) { return; }

  /** 已经传上去的图（服务端给的相对路径）。提交表单时只发这些。 */
  var uploaded = [];
  /** 这一次填表已经收过的文件（按名字+大小+改动时间认）。同一个文件不许收两遍。 */
  var seen = {};
  /** 全部分数章节（从知识树里挑出来的），供"考了哪几章"用 */
  var allChapters = [];
  var picked = {};
  var filterText = '';

  function esc(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function pad(n) { return String(n).padStart(2, '0'); }
  function today() {
    var d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function pct(rate) {
    return rate === null || rate === undefined ? '—' : Math.round(rate * 100) + '%';
  }
  function setMsg(text, bad) {
    if (!msgEl) { return; }
    msgEl.textContent = text || '';
    msgEl.setAttribute('data-tone', bad ? 'bad' : 'ok');
  }

  /* ------------------------------------------------------------------ *
   * 图片：先压，再传
   * ------------------------------------------------------------------ */
  function compress(file) {
    return new Promise(function (resolve) {
      /* 压不了就原样传 —— 压图是"省流量"，不是"能不能传"的前提 */
      if (!window.createImageBitmap || !window.HTMLCanvasElement) { resolve(file); return; }
      window.createImageBitmap(file).then(function (bmp) {
        var MAX = 1600;
        var scale = Math.min(1, MAX / Math.max(bmp.width, bmp.height));
        var w = Math.max(1, Math.round(bmp.width * scale));
        var h = Math.max(1, Math.round(bmp.height * scale));
        var cv = document.createElement('canvas');
        cv.width = w; cv.height = h;
        cv.getContext('2d').drawImage(bmp, 0, 0, w, h);
        cv.toBlob(function (blob) {
          /* 压完反而更大就别要了（小图会出现这种情况） */
          resolve(blob && blob.size < file.size ? blob : file);
        }, 'image/jpeg', 0.82);
      }, function () { resolve(file); });
    });
  }

  function uploadOne(file) {
    return compress(file).then(function (body) {
      /* **直接用 File/Blob 当 body**，不套 FormData、不转 base64：
         服务端收的是原始字节（见上传接口那段注释）。 */
      return API.raw('/uploads', body, 'image/jpeg');
    });
  }

  function renderThumbs() {
    if (!thumbsEl) { return; }
    if (!uploaded.length) {
      thumbsEl.innerHTML = '<span class="up__hint">还没有图片</span>';
      return;
    }
    thumbsEl.innerHTML = uploaded.map(function (u, i) {
      /* 标签放在图**下面**、× 用有底有边的按钮 —— 不往照片上压字。
         压字就得写死一个"在白底和黑底上都看得清"的颜色，深色模式下必然突兀。 */
      return '<span class="up__item">' +
        '<span class="up__thumb"><img src="' + esc(API.asset(u.url)) + '" alt="">' +
        '<button type="button" class="up__thumb-x" data-drop="' + i + '" title="去掉这张">×</button></span>' +
        '<span class="up__thumb-l">' + (i === 0 ? '正面' : '第 ' + (i + 1) + ' 页') + '</span></span>';
    }).join('');
  }

  /* ------------------------------------------------------------------ *
   * 章：从知识树里挑出 chapter，做成可搜的多选
   * ------------------------------------------------------------------ */
  function flatten(node, out) {
    out.push(node);
    (node.children || []).forEach(function (c) { flatten(c, out); });
    return out;
  }

  function renderChaps() {
    if (!chapsEl) { return; }
    var kw = filterText.trim();
    var shown = allChapters.filter(function (c) {
      return !kw || (c.book + ' ' + c.name).indexOf(kw) >= 0;
    }).slice(0, 200);

    var pickedCount = Object.keys(picked).length;
    chapsEl.innerHTML =
      '<div class="up__chaps-head">已选 <b>' + pickedCount + '</b> 章' +
      (pickedCount ? '（<a href="#" data-chap-clear="1">清空</a>）' : '') + '</div>' +
      (shown.length
        ? shown.map(function (c) {
          return '<label class="up__chap"><input type="checkbox" data-chap="' + c.id + '"' +
            (picked[c.id] ? ' checked' : '') + '><span>' + esc(c.book) + ' · ' + esc(c.name) + '</span></label>';
        }).join('')
        : '<p class="up__hint">没找到这一章。</p>');
  }

  function loadChapters() {
    return API.get('/tree').then(function (d) {
      var nodes = flatten(d.tree, []);
      var bookOf = {};
      /* 往上找册名：章 → 节/册。树里章的父级不一定就是册，所以逐层找最近的 book */
      (function build(node, book) {
        var here = node.kind === 'book' ? node.name : book;
        if (node.kind === 'book') { bookOf[node.id] = node.name; }
        if (node.kind === 'chapter') { bookOf[node.id] = here || ''; }
        (node.children || []).forEach(function (c) { build(c, here); });
      }(d.tree, ''));
      allChapters = nodes.filter(function (n) { return n.kind === 'chapter'; })
        .map(function (n) { return { id: n.id, name: n.name, book: bookOf[n.id] || '' }; });
      renderChaps();
    }, function () {
      if (chapsEl) { chapsEl.innerHTML = '<p class="up__hint">章节没取到，先不选也行。</p>'; }
    });
  }

  /* ------------------------------------------------------------------ *
   * 考情报告
   * ------------------------------------------------------------------ */
  function renderReport(rep) {
    if (!repEl) { return; }
    var s = rep.summary || {};
    if (!s.count) {
      repEl.innerHTML = '<p class="wk-note">还没有切片。上传第一张卷子之后，这里会出现考情汇总。</p>';
      return;
    }

    var chaps = rep.byChapter || [];
    var boxes = rep.boxes || { total: 0, withNode: 0, withoutNode: 0 };

    repEl.innerHTML =
      '<div class="rpt__kpis">' +
      kpi(s.count, '张切片') +
      kpi(s.withScore + ' / ' + s.count, '填了分数') +
      kpi(pct(s.avgRate), '平均得分率') +
      kpi(pct(s.best && s.best.rate), '最好') +
      '</div>' +
      '<p class="rpt__range">' + esc(s.firstDate || '') + ' ~ ' + esc(s.lastDate || '') +
      (s.withScore < s.count
        ? '　<strong>' + (s.count - s.withScore) + ' 张没填分数</strong>，不计入平均（不拿 0 顶替）'
        : '') + '</p>' +
      (rep.trend && rep.trend.length
        ? '<h3 class="rpt__h">成绩走向</h3><div class="rpt__bars">' +
          rep.trend.map(function (p) {
            var w = Math.max(4, Math.round(p.rate * 100));
            return '<div class="rpt__bar"><span class="rpt__bar-date">' + esc(p.date.slice(5)) + '</span>' +
              '<span class="rpt__bar-track"><i style="width:' + w + '%"></i></span>' +
              '<span class="rpt__bar-num">' + p.score + '/' + p.full + ' · ' + pct(p.rate) + '</span></div>';
          }).join('') + '</div>'
        : '') +
      '<h3 class="rpt__h">薄弱章节 <span class="rpt__sub">按"框出来的错题数"排</span></h3>' +
      (chaps.length
        ? '<ul class="rpt__chaps">' + chaps.slice(0, 12).map(function (c) {
          return '<li><span class="rpt__chap-name">' + esc(c.name) + '</span>' +
            '<span class="rpt__chap-meta">错题 <b>' + c.boxes + '</b> 道 · 考过 ' + c.slices + ' 次</span>' +
            (c.causes && c.causes.length
              ? '<span class="rpt__chap-cause">' + esc(c.causes.join('、')) + '</span>'
              : '') + '</li>';
        }).join('') + '</ul>'
        : '<p class="wk-note">还没有归到章节上的错题。在切片详情里把错题框出来、选上知识点，这里就会排出来。</p>') +
      '<p class="rpt__boxes">一共框了 <b>' + boxes.total + '</b> 道错题，其中 <b>' + boxes.withNode +
      '</b> 道挂了知识点' +
      (boxes.withoutNode ? '，还有 ' + boxes.withoutNode + ' 道没归类（不计入上面的薄弱章节）' : '') + '。</p>';
  }

  function kpi(v, label) {
    return '<div class="rpt__kpi"><b>' + esc(v) + '</b><span>' + esc(label) + '</span></div>';
  }

  /* ------------------------------------------------------------------ *
   * 切片列表
   * ------------------------------------------------------------------ */
  function sliceCard(s) {
    var img = s.images && s.images[0];
    var rate = s.rate === null ? '' : '<span class="sc__rate">' + pct(s.rate) + '</span>';
    return '<article class="sc" data-slice="' + s.id + '">' +
      (img ? '<img class="sc__img" src="' + esc(API.asset(img.url)) + '" alt="卷子">'
        : '<span class="sc__img sc__img--none">没图</span>') +
      '<div class="sc__body">' +
      '<h3 class="sc__name">' + esc(s.name) + '</h3>' +
      '<p class="sc__meta">' + esc(s.date) + ' · ' + esc(s.subject) + ' · ' + esc(s.paperType) +
      (s.score === null ? ' · <span class="dim">没记分数</span>' : ' · ' + s.score + '/' + s.full) + rate + '</p>' +
      (s.note ? '<p class="sc__note">' + esc(s.note) + '</p>' : '') +
      '<p class="sc__meta dim">覆盖 ' + (s.nodes || []).length + ' 章 · 框了 ' +
      (s.boxes || []).length + ' 道错题</p>' +
      '<div class="sc__acts">' +
      (img ? '<a class="btn btn--ghost btn--sm" href="' + esc(API.asset(img.url)) +
        '" target="_blank" rel="noopener">看原图</a>' : '') +
      '<button type="button" class="btn btn--ghost btn--sm" data-del="' + s.id + '">删除</button>' +
      '</div></div></article>';
  }

  function renderList(items) {
    if (listNote) { listNote.textContent = '共 ' + items.length + ' 张'; }
    if (!items.length) {
      listEl.innerHTML = '<p class="wk-note">还没有切片。点右上角「上传一张卷子」，' +
        '把拍到的卷子传上来，标上日期和这次的情况。</p>';
      return;
    }
    listEl.innerHTML = '<div class="sc-grid">' + items.map(sliceCard).join('') + '</div>';
  }

  function loadList() {
    return API.get('/me/exam-slices').then(function (d) {
      renderList((d && d.items) || []);
      if (listNote) { listNote.setAttribute('data-qa', 'slice-count'); }
    }, function (err) {
      listEl.innerHTML = '<p class="wk-note">切片没取到：' + esc((err && err.message) || '接口没通') + '</p>';
    });
  }

  function loadReport() {
    return API.get('/me/exam-slice-report').then(renderReport, function () {
      if (repEl) { repEl.innerHTML = '<p class="wk-note">报告没取到。</p>'; }
    });
  }

  /* ------------------------------------------------------------------ *
   * 交互
   * ------------------------------------------------------------------ */
  function showForm(on) {
    if (secForm) { secForm.hidden = !on; }
    if (on && !document.getElementById('up-date').value) {
      document.getElementById('up-date').value = today();
    }
    if (on && !allChapters.length) { loadChapters(); }
    if (on && secForm) { secForm.scrollIntoView({ block: 'start' }); }
  }

  function resetForm() {
    ['up-name', 'up-score', 'up-full', 'up-note'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) { el.value = ''; }
    });
    document.getElementById('up-date').value = today();
    document.getElementById('up-subject').value = '数学';
    document.getElementById('up-type').value = '单元卷';
    document.getElementById('up-file').value = '';
    uploaded = [];
    picked = {};
    filterText = '';
    seen = {};
    document.getElementById('up-ch-filter').value = '';
    renderThumbs();
    renderChaps();
    setMsg('');
  }

  function submitForm(ev) {
    ev.preventDefault();
    if (!uploaded.length) { setMsg('先选至少一张卷子照片。', true); return; }

    var score = document.getElementById('up-score').value.trim();
    var full = document.getElementById('up-full').value.trim();
    var nodeIds = Object.keys(picked).map(Number);

    var body = {
      name: document.getElementById('up-name').value.trim() ||
        (document.getElementById('up-subject').value.trim() + ' ' + document.getElementById('up-date').value),
      date: document.getElementById('up-date').value,
      subject: document.getElementById('up-subject').value.trim(),
      paperType: document.getElementById('up-type').value.trim(),
      score: score === '' ? null : Number(score),
      full: full === '' ? null : Number(full),
      note: document.getElementById('up-note').value.trim() || null,
      images: uploaded.map(function (u, i) {
        return { file: u.file, label: i === 0 ? '正面' : '第 ' + (i + 1) + ' 页', bytes: u.bytes };
      }),
      nodeIds: nodeIds,
    };

    var btn = document.getElementById('up-submit');
    if (btn) { btn.setAttribute('aria-busy', '1'); btn.textContent = '正在存…'; }
    setMsg('');

    API.post('/me/exam-slices', body).then(function () {
      if (btn) { btn.removeAttribute('aria-busy'); btn.textContent = '存成一张切片'; }
      resetForm();
      showForm(false);
      return Promise.all([loadList(), loadReport()]);
    }, function (err) {
      if (btn) { btn.removeAttribute('aria-busy'); btn.textContent = '存成一张切片'; }
      setMsg('没存上：' + ((err && err.message) || '接口没通'), true);
    });
  }

  function onFiles(files) {
    if (!files || !files.length) { return; }
    /* change 有时会连着来两次（重开选择器又选中同一张也会），不去重的话
       一张卷子会显示成"正面"和"第 2 页"两张，白占一份空间、提交上去也是重复的。 */
    var fresh = [];
    Array.prototype.forEach.call(files, function (f) {
      var key = f.name + ':' + f.size + ':' + f.lastModified;
      if (seen[key]) { return; }
      seen[key] = true;
      fresh.push(f);
    });
    if (!fresh.length) { return; }

    setMsg('正在压缩并上传…');
    var chain = Promise.resolve();
    Array.prototype.forEach.call(fresh, function (f) {
      chain = chain.then(function () { return uploadOne(f); }).then(function (got) {
        uploaded.push({ file: got.file, url: got.url, bytes: got.bytes });
        renderThumbs();
      });
    });
    chain.then(function () { setMsg('图片传好了，接着填下面的信息。'); },
      function (err) { setMsg('上传失败：' + ((err && err.message) || '接口没通'), true); });
  }

  function removeSlice(id) {
    if (!window.confirm('删掉这张切片？卷子照片也会一起删掉。')) { return; }
    API.del('/me/exam-slices/' + id).then(function () {
      return Promise.all([loadList(), loadReport()]);
    }, function (err) {
      window.alert('没删掉：' + ((err && err.message) || '接口没通'));
    });
  }

  /* 一处在 document 上收口：列表和章节都是重画出来的，逐个挂监听会漏 */
  document.addEventListener('click', function (ev) {
    var t = ev.target;
    if (!t) { return; }
    if (t.id === 'upload-open') { ev.preventDefault(); showForm(true); return; }
    if (t.id === 'up-cancel') { ev.preventDefault(); showForm(false); return; }
    var drop = t.getAttribute && t.getAttribute('data-drop');
    if (drop !== null && drop !== undefined) {
      ev.preventDefault();
      uploaded.splice(Number(drop), 1);
      renderThumbs();
      return;
    }
    var clear = t.getAttribute && t.getAttribute('data-chap-clear');
    if (clear) { ev.preventDefault(); picked = {}; renderChaps(); return; }
    var del = t.getAttribute && t.getAttribute('data-del');
    if (del) { ev.preventDefault(); removeSlice(Number(del)); }
  });

  document.addEventListener('change', function (ev) {
    var t = ev.target;
    if (t.id === 'up-file') { onFiles(t.files); return; }
    var chap = t.getAttribute && t.getAttribute('data-chap');
    if (chap) {
      if (t.checked) { picked[chap] = true; } else { delete picked[chap]; }
      var head = chapsEl.querySelector('.up__chaps-head b');
      if (head) { head.textContent = String(Object.keys(picked).length); }
    }
  });

  document.addEventListener('input', function (ev) {
    if (ev.target && ev.target.id === 'up-ch-filter') {
      filterText = ev.target.value;
      renderChaps();
    }
  });

  /* ------------------------------------------------------------------ *
   * 起
   * ------------------------------------------------------------------ */
  function start(user) {
    if (!user) {
      listEl.innerHTML = '<p class="wk-note">要登录才看得到自己的切片 —— ' +
        '<a href="login.html?next=exam-slices.html">去登录</a></p>';
      if (repEl) { repEl.innerHTML = ''; }
      return;
    }
    if (formEl) { formEl.addEventListener('submit', submitForm); }
    loadList();
    loadReport();
    loadChapters();
  }

  if (!AUTH) { start(null); return; }
  AUTH.ready().then(function (u) { start(u); }, function () { start(null); });
}());
