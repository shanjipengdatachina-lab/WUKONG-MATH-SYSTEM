/* ==========================================================================
   练习结果 · 接后台（assets/js/practice-result-live.js）
   --------------------------------------------------------------------------
   这一页原来整页是**写死的假数字**：3/4、75%、「用时 4 分 12 秒」、四行固定的题 ——
   而 practice-live.js 上那个「看这次的结果」一直指着它
   （设计稿 M4 写着"学生端 practice / practice-result 接接口"，只接了一半）。

   现在读真数据，两条口径与后台 /practice 那一路**同源**：
     · `judged` = 判得了分的题数 —— 正确率的分母是它，不是 total
     · 白板题（kind=board）记「做了」但判不了分，页面上写「已记『做了』」，
       **绝不写成「答错」** —— 那是让学生背一件系统自己说做不到的事
     · 「用时」原来那个数是编的，也不再有（服务端根本没记用时），
       那一格换成「白板题（记了『做了』）」

   地址：practice-result.html?id=123（从练习页跳过来时带着）；
   没带 id 就取**最近一次已交的**练习。
   依赖：assets/js/api.js（取数）、assets/js/auth-client.js（登录闸）。
   ========================================================================== */
(function () {
  'use strict';

  var API = window.WK_API;
  var AUTH = window.WK_AUTH;
  var rowsBox = document.getElementById('pr-rows');
  if (!API || !AUTH || !rowsBox) { return; }

  function el(id) { return document.getElementById(id); }

  function esc(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function icons() {
    if (window.lucide && window.lucide.createIcons) {
      try { window.lucide.createIcons(); } catch (e) { /* 图标画不出来不致命 */ }
    }
  }

  /** `judged` 这一列是后加的，早先交过的会话里它是 null —— 当 0 看 */
  function judgedOf(r) { return typeof r.judged === 'number' ? r.judged : 0; }

  function fmtWhen(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) { return ''; }
    var p = function (n) { return String(n).padStart(2, '0'); };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) +
      ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }

  /* ------------------------------------------------------------------ *
   * 成绩概览
   * ------------------------------------------------------------------ */
  function paintScore(r) {
    var box = el('pr-score');
    if (!box) { return; }
    var judged = judgedOf(r);
    var wrong = judged - (r.correct || 0);
    var board = r.total - judged;

    /* 「没有数据」与「数据是 0」分开：一道都判不了分时正确率写「—」，不写 0% */
    var items = [
      { num: (r.correct || 0) + ' / ' + judged, label: '答对（判分题）', bad: false },
      { num: r.score === null ? '—' : r.score + '%', label: '正确率', bad: false },
      { num: String(wrong), label: '答错', bad: wrong > 0 },
      { num: String(board), label: '白板题（记了「做了」）', bad: false }
    ];
    box.innerHTML = items.map(function (it) {
      return '<div class="score__item"><p class="score__num' +
        (it.bad ? ' score__num--bad' : '') + '">' + esc(it.num) + '</p>' +
        '<p class="score__label">' + esc(it.label) + '</p></div>';
    }).join('');

    var pct = r.score === null ? 0 : r.score;
    var fill = el('pr-bar-fill');
    var bar = el('pr-bar');
    if (fill) { fill.style.width = pct + '%'; }
    if (bar) { bar.setAttribute('aria-valuenow', String(pct)); }
  }

  /* ------------------------------------------------------------------ *
   * 逐题回顾
   * ------------------------------------------------------------------ */
  function rowOf(d, i) {
    var verdict;
    if (d.judged === false) {
      verdict = '<span class="arow__verdict arow__verdict--done">已记「做了」</span>';
    } else if (d.correct) {
      verdict = '<span class="arow__verdict arow__verdict--ok">' +
        '<i data-lucide="check" style="width:14px;height:14px"></i>答对</span>';
    } else {
      verdict = '<span class="arow__verdict arow__verdict--bad">' +
        '<i data-lucide="x" style="width:14px;height:14px"></i>答错</span>';
    }

    var chips = [];
    if (d.tag) { chips.push('<span class="arow__tag">' + esc(d.tag) + '</span>'); }
    if (d.kind === 'board') { chips.push('<span class="arow__tag">白板题</span>'); }
    if (d.judged) {
      chips.push('<span class="arow__tag">你答 ' + (d.given ? esc(d.given) : '（空）') + '</span>');
      chips.push('<span class="arow__tag">正确 ' + esc(d.answer) + '</span>');
    }

    /* 题干本来就是原样 HTML（和正文同一个规矩：塞回容器就一字不差地渲染） */
    return '<a class="arow" href="practice.html">' +
      '<span class="arow__no">第 ' + (i + 1) + ' 题</span>' +
      '<span class="arow__body">' +
      '<span class="arow__stem">' + d.stem + '</span>' +
      '<span class="arow__meta">' + chips.join('') + '</span>' +
      '</span>' + verdict + '</a>';
  }

  function paintRows(r) {
    rowsBox.innerHTML = r.details.map(rowOf).join('');
    var count = el('pr-count');
    if (count) { count.textContent = r.total + ' 题'; }
    icons();
  }

  /* ------------------------------------------------------------------ *
   * 底下那一句提示
   * ------------------------------------------------------------------ */
  function paintNote(r) {
    var note = el('pr-note');
    if (!note) { return; }
    var judged = judgedOf(r);
    var wrong = judged - (r.correct || 0);
    var board = r.total - judged;

    var bits = [];
    if (wrong > 0) {
      bits.push('本次判错 <strong>' + wrong + '</strong> 道 —— 练习错题会自动进你的错题本，订正一下。');
    }
    if (board > 0) {
      bits.push('另有 <strong>' + board + '</strong> 道白板题只记了「做了」：' +
        '它们只有题面、没有标准答案，系统判不了分。');
    }
    if (!bits.length) { note.hidden = true; return; }
    note.innerHTML = '<p>' + bits.join(' ') + '</p>';
    note.hidden = false;
  }

  /* ------------------------------------------------------------------ *
   * 载入
   * ------------------------------------------------------------------ */
  function wantedId() {
    var m = /[?&]id=(\d+)/.exec(window.location.search);
    return m ? Number(m[1]) : null;
  }

  /** 给了 id 就取那一次；没给就取**最近一次已交的** */
  function load() {
    var id = wantedId();
    if (id) { return API.get('/practice/sessions/' + id); }
    return API.get('/practice/sessions').then(function (list) {
      var done = (list.items || []).filter(function (s) { return !!s.submittedAt; });
      if (!done.length) { return null; }
      return API.get('/practice/sessions/' + done[0].id);
    });
  }

  function render(r) {
    var meta = el('pr-meta');
    var empty = el('pr-empty');
    if (!r) {
      if (meta) { meta.textContent = '还没有练习记录。'; }
      if (empty) { empty.hidden = false; }
      return;
    }
    if (meta) {
      meta.textContent = '提交于 ' + fmtWhen(r.submittedAt) +
        ' · 这次一共做了 ' + r.total + ' 道（判分 ' + judgedOf(r) + ' 道）';
    }
    paintScore(r);
    paintRows(r);
    paintNote(r);
  }

  function fail(err) {
    rowsBox.innerHTML = '';
    var meta = el('pr-meta');
    if (meta) { meta.textContent = ''; }
    var empty = el('pr-empty');
    if (!empty) { return; }
    empty.hidden = false;
    empty.textContent = (err && err.status === 400)
      ? '这次练习还没交，没有结果可看 —— 去练习页交了再来。'
      : '这次的结果没取到：' + ((err && err.message) || '未知错误');
  }

  AUTH.requireLogin().then(function (u) {
    if (!u) { return; }   /* 没登录 —— requireLogin 已经把人送到登录页了 */
    rowsBox.innerHTML = '<p class="pr-loading">正在读这次练习…</p>';
    load().then(render, fail);
  });
}());
