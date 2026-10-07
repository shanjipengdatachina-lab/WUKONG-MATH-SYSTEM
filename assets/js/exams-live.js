/* ==========================================================================
   真题题库 · 学生端交互
   --------------------------------------------------------------------------
   不走 WK_API.boot 那条路（那是为知识树 + 学习数据兜底用的）。
   这里直接用 WK_API.get —— 真题页只关心题库本身，不依赖知识树就绪。

   三件事：
     1. 拉列表 + 筛选项可用值；
     2. 点列表项展开详情（带答案，判分在前端字符串比对）；
     3. 解析按会员权益决定显不显（详情接口里 explanation 没权益就给 null）。
   ========================================================================== */
(function () {
  'use strict';

  var API = window.WK_API;
  if (!API) { return; /* 没接口层就什么都不做，免得报错把页面拖坏 */ }

  var state = {
    facets: { years: [], regions: [], paperTypes: [], qtypes: [] },
    filter: { year: '', region: '', paperType: '', qtype: '', kind: '' },
    rows: [],
    currentId: null,
    currentDetail: null,
  };

  var $list = document.getElementById('exams-list');
  var $count = document.getElementById('exams-count-note');
  var $detail = document.getElementById('exams-detail');
  var $detailBody = document.getElementById('exams-detail-body');
  var $back = document.getElementById('exams-back');

  document.getElementById('f-year').addEventListener('change', function (e) {
    state.filter.year = e.target.value; loadList();
  });
  document.getElementById('f-region').addEventListener('change', function (e) {
    state.filter.region = e.target.value; loadList();
  });
  document.getElementById('f-paper').addEventListener('change', function (e) {
    state.filter.paperType = e.target.value; loadList();
  });
  document.getElementById('f-qtype').addEventListener('change', function (e) {
    state.filter.qtype = e.target.value; loadList();
  });
  document.getElementById('f-kind').addEventListener('change', function (e) {
    state.filter.kind = e.target.value; loadList();
  });
  document.getElementById('f-reset').addEventListener('click', function () {
    state.filter = { year: '', region: '', paperType: '', qtype: '', kind: '' };
    ['f-year', 'f-region', 'f-paper', 'f-qtype', 'f-kind'].forEach(function (id) {
      document.getElementById(id).value = '';
    });
    loadList();
  });
  $back.addEventListener('click', function () {
    state.currentId = null;
    state.currentDetail = null;
    $detail.hidden = true;
    $list.hidden = false;
    document.getElementById('exams-filters').hidden = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  /* ---- 筛选项可用值 ---- */
  function loadFacets() {
    API.get('/exams/facets').then(function (got) {
      state.facets = got || { years: [], regions: [], paperTypes: [], qtypes: [] };
      fillSelect('f-year', state.facets.years.map(function (y) { return { value: String(y), label: String(y) }; }));
      fillSelect('f-region', state.facets.regions.map(function (r) { return { value: r, label: r }; }));
      fillSelect('f-paper', state.facets.paperTypes.map(function (p) { return { value: p, label: p }; }));
      fillSelect('f-qtype', state.facets.qtypes.map(function (q) { return { value: q, label: q }; }));
    }).catch(function (e) {
      // 题库可能还空着 —— 不弹错，列表照常取
      console.warn('[exams] facets 没拉到：', e && e.message);
    });
  }

  function fillSelect(id, options) {
    var sel = document.getElementById(id);
    var keep = sel.value;
    // 保留第一项（"全部"）
    while (sel.options.length > 1) { sel.remove(1); }
    options.forEach(function (op) {
      var o = document.createElement('option');
      o.value = op.value; o.textContent = op.label;
      sel.appendChild(o);
    });
    sel.value = keep;
  }

  /* ---- 列表 ---- */
  function loadList() {
    $list.innerHTML = '<p class="qlist__empty">加载中…</p>';
    var params = [];
    if (state.filter.year) { params.push('year=' + encodeURIComponent(state.filter.year)); }
    if (state.filter.region) { params.push('region=' + encodeURIComponent(state.filter.region)); }
    if (state.filter.paperType) { params.push('paperType=' + encodeURIComponent(state.filter.paperType)); }
    if (state.filter.qtype) { params.push('qtype=' + encodeURIComponent(state.filter.qtype)); }
    if (state.filter.kind) { params.push('kind=' + encodeURIComponent(state.filter.kind)); }
    var q = params.length ? '?' + params.join('&') : '';
    API.get('/exams' + q).then(function (got) {
      state.rows = (got && got.items) || [];
      renderList();
    }).catch(function (e) {
      $list.innerHTML = '<p class="qlist__empty">没拉到题：' + escapeHtml(e && e.message || '连不上服务器') + '</p>';
    });
  }

  function renderList() {
    if ($count) { $count.textContent = state.rows.length ? '· 共 ' + state.rows.length + ' 道' : ''; }
    if (!state.rows.length) {
      $list.innerHTML = '<p class="qlist__empty">题库里还没有题。换一组筛选试试，或者等老师录入。</p>';
      return;
    }
    var html = state.rows.map(function (r, i) {
      return '' +
        '<a class="qrow" href="#exam-' + r.id + '" data-id="' + r.id + '">' +
          '<span class="qrow__no">' + (i + 1) + '</span>' +
          '<span class="qrow__body">' +
            '<span class="qrow__head">' +
              '<span class="qrow__code">' + escapeHtml(r.code) + '</span>' +
              '<span class="qrow__meta">' + r.year + ' · ' + escapeHtml(r.region) + ' · ' + escapeHtml(r.paperType) + ' · ' + escapeHtml(r.qtype) + '</span>' +
            '</span>' +
            '<span class="qrow__stem">' + previewStem(r.stem) + '</span>' +
            '<span class="qrow__tags">' +
              '<span class="qrow__tag qrow__tag--diff">难度 ' + r.difficulty + '/5</span>' +
              (r.nodeName ? '<span class="qrow__tag">' + escapeHtml(r.nodeName) + '</span>' : '') +
              '<span class="qrow__tag">' + kindLabel(r.kind) + '</span>' +
            '</span>' +
          '</span>' +
        '</a>';
    }).join('');
    $list.innerHTML = html;
    // 绑定点击（用事件代理，避免一堆 listener）
    $list.querySelectorAll('.qrow').forEach(function (el) {
      el.addEventListener('click', function (ev) {
        ev.preventDefault();
        var id = Number(el.getAttribute('data-id'));
        openDetail(id);
      });
    });
  }

  function previewStem(html) {
    // 列表项里只显示纯文本（剥掉标签），完整 HTML 在详情里看
    var txt = (html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    return escapeHtml(txt.length > 200 ? txt.slice(0, 200) + '…' : txt);
  }

  function kindLabel(k) {
    return { choice: '选择题', blank: '填空题', board: '白板题' }[k] || k;
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /* ---- 详情 / 答题 ---- */
  function openDetail(id) {
    state.currentId = id;
    $detailBody.innerHTML = '<p class="qlist__empty">加载中…</p>';
    $list.hidden = true;
    document.getElementById('exams-filters').hidden = true;
    $detail.hidden = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });

    API.get('/exams/' + id).then(function (got) {
      state.currentDetail = got;
      renderDetail();
    }).catch(function (e) {
      $detailBody.innerHTML = '<p class="qlist__empty">没拉到这道题：' + escapeHtml(e && e.message || '') + '</p>';
    });
  }

  // 学生答题的本地状态（不落库 —— 这一版不做"错题进错题本"联动）
  var answerState = { chosen: '', blanks: [], submitted: false };

  function renderDetail() {
    var d = state.currentDetail;
    if (!d) { return; }
    answerState = { chosen: '', blanks: d.blanks.map(function () { return ''; }), submitted: false };

    var head = '' +
      '<div class="qbox__head">' +
        '<span class="qbox__code">' + escapeHtml(d.code) + '</span>' +
        '<span class="qbox__meta">' + d.year + ' · ' + escapeHtml(d.region) + ' · ' + escapeHtml(d.paperType) + ' · ' + escapeHtml(d.qtype) +
        (d.no ? ' · ' + escapeHtml(d.no) : '') +
        (d.nodeName ? ' · ' + escapeHtml(d.nodeName) : '') +
        '</span>' +
      '</div>';

    var stem = '<div class="qbox__stem">' + d.stem + '</div>';

    var answerArea = '';
    if (d.kind === 'choice') {
      answerArea = '<div class="qbox__opts" id="q-opts">' +
        d.options.map(function (op) {
          return '<label class="qopt" data-key="' + escapeHtml(op.key) + '">' +
            '<span class="qopt__key">' + escapeHtml(op.key) + '</span>' +
            '<span class="qopt__text">' + op.text + '</span>' +
            '<input type="radio" name="q-choice" value="' + escapeHtml(op.key) + '" hidden>' +
          '</label>';
        }).join('') +
      '</div>';
    } else if (d.kind === 'blank') {
      answerArea = '<div class="qbox__opts">' +
        d.blanks.map(function (b, i) {
          return '<div class="qblank">' +
            '<span class="qblank__label">' + escapeHtml(b.label || ('第 ' + (i + 1) + ' 空')) + '</span>' +
            '<input class="qblank__input" data-i="' + i + '" type="text" autocomplete="off">' +
          '</div>';
        }).join('') +
      '</div>';
    } else {
      // board：白板题没有判分，直接给"看解析"
      answerArea = '<div class="qbox__opts"><p class="qlist__empty" style="text-align:left;padding:0">白板题没有标准答案 —— 写完自己的思路后看老师给的解析。</p></div>';
    }

    var actions = '' +
      '<div class="qactions">' +
        (d.kind === 'board'
          ? '<button class="btn btn--ghost btn--sm" id="q-show-board" type="button">看解析</button>'
          : '<button class="btn btn--primary btn--sm" id="q-submit" type="button" disabled>对答案</button>') +
      '</div>';

    $detailBody.innerHTML = '<div class="qbox">' + head + stem + answerArea + actions + '</div>';

    bindDetailEvents();
  }

  function bindDetailEvents() {
    var d = state.currentDetail;
    if (!d) { return; }

    if (d.kind === 'choice') {
      var $opts = document.getElementById('q-opts');
      if ($opts) {
        $opts.querySelectorAll('.qopt').forEach(function (el) {
          el.addEventListener('click', function () {
            if (answerState.submitted) { return; }
            $opts.querySelectorAll('.qopt').forEach(function (x) { x.classList.remove('qopt--chosen'); });
            el.classList.add('qopt--chosen');
            answerState.chosen = el.getAttribute('data-key') || '';
            var btn = document.getElementById('q-submit');
            if (btn) { btn.disabled = false; }
          });
        });
      }
    } else if (d.kind === 'blank') {
      $detailBody.querySelectorAll('.qblank__input').forEach(function (inp) {
        inp.addEventListener('input', function (e) {
          var i = Number(e.target.getAttribute('data-i'));
          answerState.blanks[i] = e.target.value;
          var filled = answerState.blanks.filter(function (s) { return s.trim() !== ''; }).length;
          var btn = document.getElementById('q-submit');
          if (btn) { btn.disabled = filled === 0; }
        });
      });
    }

    var $submit = document.getElementById('q-submit');
    if ($submit) {
      $submit.addEventListener('click', function () {
        if (answerState.submitted) { return; }
        answerState.submitted = true;
        renderResult();
      });
    }

    var $board = document.getElementById('q-show-board');
    if ($board) {
      $board.addEventListener('click', function () {
        answerState.submitted = true;
        renderResult();
      });
    }
  }

  function renderResult() {
    var d = state.currentDetail;
    if (!d) { return; }

    var correct = false;
    var given = '';

    if (d.kind === 'choice') {
      given = answerState.chosen;
      correct = !!given && !!d.answer && given.toUpperCase() === String(d.answer).trim().toUpperCase();
      // 把选项标记成对错
      document.querySelectorAll('#q-opts .qopt').forEach(function (el) {
        var k = el.getAttribute('data-key');
        if (k === d.answer) { el.classList.add('qopt--right'); }
        if (k === given && !correct) { el.classList.add('qopt--wrong'); }
        if (k === given) { el.classList.add('qopt--chosen'); }
      });
    } else if (d.kind === 'blank') {
      var ans = (d.answer || '').split('|');
      given = answerState.blanks.join('|');
      correct = ans.length === answerState.blanks.length &&
        ans.every(function (a, i) { return (answerState.blanks[i] || '').trim() === a.trim(); });
      // 把每个空标记
      document.querySelectorAll('.qblank__input').forEach(function (inp, idx) {
        var want = ans[idx];
        var got = (answerState.blanks[idx] || '').trim();
        inp.disabled = true;
        if (want && got === want.trim()) {
          inp.style.borderColor = '#3a9b3a';
          inp.style.background = 'rgba(58,155,58,0.06)';
        } else if (got) {
          inp.style.borderColor = '#c2453a';
          inp.style.background = 'rgba(194,69,58,0.06)';
        }
      });
    }

    // 答题结果条
    var resultHtml = '';
    if (d.kind === 'board') {
      resultHtml = '<div class="qresult qresult--open">已展开解析（白板题不判分）</div>';
    } else if (correct) {
      resultHtml = '<div class="qresult qresult--right">✓ 对了。你的答案：' + escapeHtml(given) + '</div>';
    } else {
      resultHtml = '<div class="qresult qresult--wrong">✗ 不对。你的答案：' + escapeHash(given) + '，正确答案：' + escapeHtml(d.answer || '') + '</div>';
    }

    // 解析
    var explainHtml = '';
    if (d.explanation) {
      explainHtml = '<div class="qexplain"><div class="qexplain__title">解析</div>' + d.explanation + '</div>';
    } else if (d.hasSolution === false) {
      explainHtml = '<div class="qexplain"><div class="qexplain__title">解析</div>' +
        '<div class="qexplain__locked">这道题的解析是<strong>会员专属</strong>。<a href="membership.html">去开通</a> 或 <a href="practice.html">看免费练习题</a>。</div></div>';
    } else {
      explainHtml = '<div class="qexplain"><div class="qexplain__title">解析</div>' +
        '<div class="qexplain__locked">这道题暂无解析。</div></div>';
    }

    var $box = $detailBody.querySelector('.qbox');
    if ($box) {
      var $result = document.createElement('div');
      $result.innerHTML = resultHtml + explainHtml;
      while ($result.firstChild) { $box.appendChild($result.firstChild); }
    }

    // 隐藏"对答案"按钮（已交过）
    var $submit = document.getElementById('q-submit');
    if ($submit) { $submit.style.display = 'none'; }
  }

  function escapeHash(s) { return escapeHtml(s); }

  /* ---- 启动：等登录就绪再拉数据（避免 401 时刷新一下又来一次） ---- */
  function start() {
    loadFacets();
    loadList();
  }

  if (window.WK_AUTH && window.WK_AUTH.ready) {
    window.WK_AUTH.ready().then(start, function () { start(); });
  } else {
    start();
  }
}());
