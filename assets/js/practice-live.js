/* ==========================================================================
   考点速练 · 接后台（assets/js/practice-live.js）
   --------------------------------------------------------------------------
   这一页原来是**写死的几道题**（题干、选项、正确答案、解析全在 HTML 里）。
   现在题目从后台取，但有两条必须守住：

     1. **取题时不带答案。** 页面上不再出现 `data-correct` —— 谁在浏览器里翻 DOM
        都翻不到答案；判分发生在服务端（设计稿 §3.6：前端说了不算）。
     2. **未登录不许做。** 用户原话："真题可以一直看，方法也是公共的，
        但是要用题库那时候，我就需要登录了。" 所以没登录时这一块只出一张登录卡。

   依赖：assets/js/api.js（取数）、assets/js/auth-client.js（身份与闸）。
   写死的那个列表会被这里整块换掉（pages.js 对它的绑定随之失效，不影响别的功能）。
   ========================================================================== */
(function () {
  'use strict';

  var API = window.WK_API;
  var AUTH = window.WK_AUTH;
  var list = document.getElementById('quiz-list');
  if (!API || !AUTH || !list) { return; }

  var state = { session: null, picked: {}, result: null };

  function esc(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function qs(sel, root) { return (root || document).querySelector(sel); }
  function qsa(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }

  function icons() {
    if (window.lucide && window.lucide.createIcons) {
      try { window.lucide.createIcons(); } catch (e) { /* 图标画不出来不致命 */ }
    }
  }

  /* ------------------------------------------------------------------ *
   * 未登录：只出一张登录卡
   * ------------------------------------------------------------------ */
  function renderGate() {
    list.innerHTML =
      '<section class="quiz-gate">' +
      '<p class="quiz-gate__title">登录后开始练</p>' +
      '<p class="quiz-gate__desc">真题与方法都可以直接看；题库要登录 —— ' +
      '练完的错题会归到你的错题本里，换个设备也在。</p>' +
      '<a class="btn btn--primary" id="quiz-login" href="login.html?next=practice.html">去登录</a>' +
      '</section>';
    injectGateStyle();
  }

  function injectGateStyle() {
    if (document.getElementById('quiz-gate-style')) { return; }
    var st = document.createElement('style');
    st.id = 'quiz-gate-style';
    st.textContent =
      '.quiz-gate{padding:40px 0;text-align:center;border:1px dashed var(--math-border);' +
      'border-radius:var(--math-radius-md);background:var(--math-surface)}' +
      '.quiz-gate__title{font-size:calc(17px * var(--math-fs));font-weight:600;color:var(--math-foreground)}' +
      '.quiz-gate__desc{margin:10px auto 20px;max-width:36em;font-size:calc(13px * var(--math-fs));' +
      'line-height:1.9;color:var(--math-ink-2)}' +
      '.quiz-status[data-tone="success"]{color:var(--math-primary)}' +
      '.quiz-status[data-tone="error"]{color:var(--math-danger,#b42318)}' +
      '.explain[hidden]{display:none}' +
      '.blank-row{display:flex;flex-wrap:wrap;gap:18px;margin:14px 0 6px}' +
      '.blank-cell{display:inline-flex;align-items:center;gap:8px;font-size:calc(13px * var(--math-fs));' +
      'color:var(--math-ink-2)}' +
      '.blank-cell__label{white-space:nowrap}' +
      '.quiz-actions{display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin:26px 0 8px;' +
      'padding-top:20px;border-top:1px solid var(--math-border)}' +
      '.quiz-actions__note{font-size:calc(13px * var(--math-fs));color:var(--math-ink-3);margin:0}' +
      '.quiz-actions__note[data-tone="error"]{color:#b42318}' +
      '.quiz-actions__note[data-tone="warn"]{color:#b45309}' +
      '.quiz-loading{font-size:calc(14px * var(--math-fs));color:var(--math-ink-3);padding:24px 0}';
    document.head.appendChild(st);
  }

  /* ------------------------------------------------------------------ *
   * 渲染题目（**不带答案**）
   * ------------------------------------------------------------------ */
  function renderQuestions() {
    var qs_ = state.session.questions;
    list.innerHTML = qs_.map(function (q, i) {
      var head = '<div class="quiz-head">' +
        '<span class="quiz-no">第 ' + (i + 1) + ' 题</span>' +
        (q.tag ? '<span class="quiz-tag">' + esc(q.tag) + '</span>' : '') +
        '<span class="quiz-status" hidden></span>' +
        '</div>';

      var body;
      if (q.kind === 'blank') {
        body = '<p class="quiz-stem">' + q.stem + '</p>' +
          '<div class="blank-row">' + q.blanks.map(function (b, bi) {
            return '<label class="blank-cell"><span class="blank-cell__label">' + esc(b.label) + '</span>' +
              '<input class="blank" type="text" autocomplete="off" spellcheck="false" ' +
              'data-qid="' + q.id + '" data-bi="' + bi + '" aria-label="' + esc(b.label) + '"></label>';
          }).join('') + '</div>';
      } else {
        body = '<p class="quiz-stem">' + q.stem + '</p>' +
          '<div class="opt-group" role="radiogroup" aria-label="第 ' + (i + 1) + ' 题选项">' +
          q.options.map(function (o) {
            return '<button type="button" class="opt" role="radio" aria-checked="false" ' +
              'data-state="idle" data-qid="' + q.id + '" data-key="' + esc(o.key) + '">' +
              '<span class="opt__mark"><span class="opt__dot"></span></span>' +
              '<span class="opt__key">' + esc(o.key) + '.</span>' +
              '<span class="opt__text">' + o.text + '</span>' +
              '</button>';
          }).join('') + '</div>';
      }

      return '<article class="quiz-item" data-qid="' + q.id + '">' + head + body +
        '<section class="explain" hidden aria-label="第 ' + (i + 1) + ' 题解析">' +
        '<p class="explain__label">解析</p><p class="explain__body"></p></section>' +
        '</article>';
    }).join('') + renderSubmit();

    icons();
  }

  function renderSubmit() {
    return '<div class="quiz-actions" id="quiz-actions">' +
      '<button type="button" class="btn btn--primary" id="quiz-submit">提交并判分</button>' +
      '<p class="quiz-actions__note" id="quiz-note">答案在服务端判 —— 页面上拿不到正确答案。</p>' +
      '</div>';
  }

  /* ------------------------------------------------------------------ *
   * 交互
   * ------------------------------------------------------------------ */
  list.addEventListener('click', function (event) {
    var opt = event.target.closest ? event.target.closest('.opt') : null;
    if (opt && !state.result) {
      var qid = opt.getAttribute('data-qid');
      qsa('.opt[data-qid="' + qid + '"]', list).forEach(function (b) {
        b.setAttribute('aria-checked', 'false');
        b.setAttribute('data-state', 'idle');
      });
      opt.setAttribute('aria-checked', 'true');
      opt.setAttribute('data-state', 'picked');
      state.picked[qid] = opt.getAttribute('data-key');
      return;
    }
    if (event.target.closest && event.target.closest('#quiz-submit')) { submit(); }
  });

  list.addEventListener('input', function (event) {
    var input = event.target;
    if (!input.classList || !input.classList.contains('blank')) { return; }
    var qid = Number(input.getAttribute('data-qid'));
    var item = qs('.quiz-item[data-qid="' + qid + '"]', list);
    if (!item) { return; }
    var vals = qsa('.blank', item).map(function (x) { return x.value.trim(); });
    state.picked[qid] = vals.join('|');
  });

  function collect() {
    return Object.keys(state.picked).map(function (qid) {
      return { questionId: Number(qid), given: state.picked[qid] };
    });
  }

  function setNote(text, tone) {
    var note = qs('#quiz-note', list);
    if (!note) { return; }
    note.textContent = text;
    if (tone) { note.setAttribute('data-tone', tone); }
  }

  function submit() {
    var answers = collect();
    if (answers.length < state.session.questions.length) {
      setNote('还有 ' + (state.session.questions.length - answers.length) + ' 道没作答。都做完再交。', 'warn');
      return;
    }
    var btn = qs('#quiz-submit', list);
    if (btn) { btn.setAttribute('aria-busy', 'true'); btn.textContent = '判分中…'; }

    API.post('/practice/sessions/' + state.session.sessionId + '/submit', { answers: answers }).then(
      function (res) {
        state.result = res;
        paintResult(res);
      },
      function (err) {
        if (btn) { btn.removeAttribute('aria-busy'); btn.textContent = '提交并判分'; }
        setNote((err && err.message) || '提交失败，再试一次', 'error');
      }
    );
  }

  function paintResult(res) {
    res.details.forEach(function (d) {
      var item = qs('.quiz-item[data-qid="' + d.questionId + '"]', list);
      if (!item) { return; }

      var status = qs('.quiz-status', item);
      if (status) {
        status.hidden = false;
        status.setAttribute('data-tone', d.correct ? 'success' : 'error');
        status.innerHTML = '<i data-lucide="' + (d.correct ? 'check' : 'x') + '" class="quiz-status__icon" ' +
          'style="width:14px;height:14px"></i><span>' + (d.correct ? '正确' : '错误') + '</span>';
      }

      qsa('.opt', item).forEach(function (b) {
        var key = b.getAttribute('data-key');
        if (key === d.answer) { b.setAttribute('data-state', 'correct'); }
        else if (d.given === key) { b.setAttribute('data-state', 'wrong'); }
        else { b.setAttribute('data-state', 'idle'); }
      });

      var explain = qs('.explain', item);
      var body = qs('.explain__body', item);
      if (explain && body) {
        var mine = d.given ? '你答的是 <span class="expr">' + esc(d.given) + '</span>，' : '';
        var right = '正确答案 <span class="expr">' + esc(d.answer) + '</span>。';
        var ENT = window.WK_ENT;
        /* 判分和正确答案是免费的；**题解是后台能配的另一项**（member_solution）。
           服务端没有权益时 explanation 直接就是 null（不是前端藏起来的）。
           这里换成一行"会员专享"的引导 —— 空一片会让人以为页面坏了。
           注意：有权益但库里那道题本来就没写题解时，什么都不加（不是缺权益）。 */
        var tail = (res.hasSolution === false && ENT)
          ? ENT.lockHTML('member_solution')
          : (d.explanation || '');
        body.innerHTML = mine + right + tail;
        explain.hidden = false;
      }
    });

    var actions = qs('#quiz-actions', list);
    if (actions) {
      /* 错题本满了会有几道进不去 —— 后台配的容量（免费版 50 道）。
         这种情况**必须说出来**：不说的话，学生只会觉得"我明明错了三道，怎么只多了一条"。 */
      var wrongCount = res.total - res.correct;
      var tail;
      if (wrongCount === 0) {
        tail = '全对。';
      } else if (typeof res.dropped === 'number' && res.dropped > 0) {
        tail = '错的 ' + wrongCount + ' 道里有 <b>' + res.dropped + '</b> 道没能进错题本 —— ' +
          '错题本满了（<a href="membership.html">开通会员</a>之后不限量）。';
      } else {
        tail = '错的 ' + wrongCount + ' 道已经进你的错题本。';
      }
      actions.innerHTML = '<p class="quiz-actions__note" data-tone="done">得分 <b>' + res.score +
        '</b> 分（对 ' + res.correct + ' / ' + res.total + '）。' + tail +
        '</p><a class="btn btn--ghost" href="mistakes.html">去错题本</a>' +
        '<a class="btn btn--ghost" href="practice-result.html">看这次的结果</a>';
    }
    icons();
  }

  /* ------------------------------------------------------------------ *
   * 起
   * ------------------------------------------------------------------ */
  function start(user) {
    injectGateStyle();
    if (!user) { renderGate(); return; }
    list.innerHTML = '<p class="quiz-loading">正在取题…</p>';
    API.post('/practice/sessions', { count: 20 }).then(
      function (sess) {
        state.session = sess;
        renderQuestions();
      },
      function (err) {
        /* **服务端说了缺哪一项就照它说**（403 + perk）。
           题库是后台能配的：免费版里勾掉 question_bank，这里立刻拿不到题 ——
           这时候给一张开通引导，而不是一句"取不到题，先确认接口在跑"（那是把人往错方向指）。 */
        if (err && err.status === 403 && err.code === 'PERK_REQUIRED') {
          var ENT = window.WK_ENT;
          var perk = err.perk || 'question_bank';
          list.innerHTML = ENT
            ? ENT.gateHTML(perk, '当前方案里没有「' + ENT.name(perk) + '」这一项，所以取不到题。')
            : '<p class="quiz-gate__desc">这一项要开通会员才能用。</p>';
          return;
        }
        list.innerHTML = '<p class="quiz-gate__desc">题目没取到：' +
          esc((err && err.message) || '未知错误') + '（先确认接口服务在跑、库里导过题）</p>';
      }
    );
  }

  AUTH.ready().then(start);
}());
