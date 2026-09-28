/* ==========================================================================
   全站黑板入口 (board-link.js)
   --------------------------------------------------------------------------
   在各类「题目 / 知识点 / 方法 / 易错 / 公式 / 笔记」条目旁注入一个「白板」按钮，
   点击即跳到数字白板，并把这条内容原样带到黑板上，用户不必重抄。

   载体：whiteboard.html?t=正文&g=来源&x=补充（选项 / 说明等）
   实现要点：
     · 申明式规则表，一行一个目标，注入幂等（data-board-done 标记）
     · 事件在捕获阶段拦截，避免触发条目自身的跳转
     · 图标沿用站点图标库，注入后重新渲染一次
     · 图知识图谱的节点面板由脚本动态渲染，用 MutationObserver 跟进
   ========================================================================== */
(function () {
  'use strict';

  var TARGET = 'whiteboard.html';

  function txt(el) {
    return el ? String(el.textContent || '').replace(/\s+/g, ' ').trim() : '';
  }
  function pick(root, sel) {
    if (!root || typeof root.querySelector !== 'function') return '';
    return txt(root.querySelector(sel));
  }
  function optionsOf(root) {
    if (!root || typeof root.querySelectorAll !== 'function') return '';
    var list = root.querySelectorAll('.opt, .opt__text, .option');
    var out = [];
    for (var i = 0; i < list.length && i < 6; i++) {
      var t = txt(list[i]);
      if (t && out.indexOf(t) < 0) out.push(t);
    }
    return out.join('；');
  }

  function buildUrl(payload) {
    var parts = ['t=' + encodeURIComponent(payload.text || '')];
    if (payload.tag) parts.push('g=' + encodeURIComponent(payload.tag));
    if (payload.extra) parts.push('x=' + encodeURIComponent(payload.extra));
    return TARGET + '?' + parts.join('&');
  }

  /* ---------- 规则表：目标 → 上板内容 ----------
     说明：只挂在「可演算的内容条目」上（题目 / 错题 / 方法 / 易错 / 公式 / 笔记 / 知识点卡片 / 图谱节点）。
     章节页目录树、章首页的节与知识点列表等密集列表里不挂按钮，保持列表干净。 */
  var RULES = [
    {
      name: '考点速练·题目',
      sel: 'article.quiz-item',
      before: '.quiz-submit, .quiz__actions',
      payload: function (el) {
        return { text: pick(el, '.quiz-stem'), tag: pick(el, '.quiz-head .quiz-tag'), extra: optionsOf(el) };
      }
    },
    {
      name: '练习结果·题目',
      sel: '.arow',
      payload: function (el) {
        return { text: pick(el, '.arow__stem'), tag: pick(el, '.arow__tag'), extra: optionsOf(el) };
      }
    },
    {
      name: '考点总览·条目',
      sel: '.erow',
      before: '.erow__go',
      payload: function (el) {
        return { text: pick(el, '.erow__name'), tag: pick(el, '.erow__meta') };
      }
    },
    {
      name: '错题本·题目',
      sel: '.mrow',
      before: '.mrow__right',
      payload: function (el) {
        return { text: pick(el, '.mrow__stem'), tag: pick(el, '.mrow__tag') };
      }
    },
    {
      name: '错题详情·题干',
      sel: '.qstem',
      payload: function (el) {
        return { text: txt(el), tag: pick(document, '.qtag, .kp-tag'), extra: optionsOf(el.parentNode) };
      }
    },
    {
      name: '方法速学·方法',
      sel: 'a.mrow',
      before: '.mrow__right',
      payload: function (el) {
        return { text: pick(el, '.mrow__name'), tag: '方法速学', extra: pick(el, '.mrow__use') };
      }
    },
    {
      name: '易错速析·易错点',
      sel: '.prow',
      before: '.prow__arrow, .prow__right',
      payload: function (el) {
        return { text: pick(el, '.prow__title'), tag: '易错速析', extra: pick(el, '.prow__desc') };
      }
    },
    {
      name: '公式速查·公式',
      sel: '.frow',
      before: '.frow__right',
      payload: function (el) {
        return { text: pick(el, '.frow__name'), tag: '公式速查', extra: pick(el, '.frow__formula') };
      }
    },
    {
      name: '知识点卡片·标题',
      sel: '.kp-title-row',
      payload: function (el) {
        return { text: pick(el, '.kp-title'), tag: '知识点', extra: pick(document, '.kp-essence') };
      }
    },
    {
      name: '笔记·条目',
      sel: 'article.note',
      payload: function (el) {
        return {
          text: pick(el, '.note__title'),
          tag: pick(el, '.note__tag') || '笔记',
          extra: pick(el, '.note__body')
        };
      }
    }
  ];

  /* ---------- 样式（只注入一次） ---------- */
  function ensureStyles() {
    if (document.getElementById('board-link-styles')) return;
    var s = document.createElement('style');
    s.id = 'board-link-styles';
    s.textContent = [
      '.board-chip{display:inline-flex;align-items:center;gap:4px;flex:none;',
      'height:22px;padding:0 8px;margin-left:8px;',
      'border:1px solid var(--math-border);border-radius:999px;background:var(--math-background);',
      'color:var(--math-ink-3);font:inherit;font-size:12px;line-height:1;cursor:pointer;vertical-align:middle;',
      'transition:color 140ms cubic-bezier(.2,.8,.2,1),border-color 140ms cubic-bezier(.2,.8,.2,1),background-color 140ms cubic-bezier(.2,.8,.2,1)}',
      '.board-chip:hover{border-color:var(--math-primary-200);background:var(--math-primary-soft);color:var(--math-primary)}',
      '.board-chip:focus-visible{outline:2px solid var(--math-primary);outline-offset:2px}',
      '.board-chip__icon{width:13px;height:13px}',
      '.board-chip--compact{padding:0 6px}',
      '.board-chip--compact .board-chip__text{display:none}',
      '#mm-panel .board-chip{margin-left:8px}'
    ].join('');
    var host = document.head || document.body || document.documentElement;
    if (host && typeof host.appendChild === 'function') host.appendChild(s);
  }

  function makeChip(payload, rule) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'board-chip' + (rule && rule.compact ? ' board-chip--compact' : '');
    btn.setAttribute('data-board', buildUrl(payload));
    btn.setAttribute('aria-label', '送上白板：' + (payload.text || '').slice(0, 24));
    btn.title = '送上白板演算';
    btn.innerHTML = '<i data-lucide="presentation" class="board-chip__icon"></i>' +
      '<span class="board-chip__text">白板</span>';
    return btn;
  }

  function injectInto(el, rule) {
    if (!el || typeof el.getAttribute !== 'function') return false;
    if (el.getAttribute('data-board-done')) return false;
    var payload = rule.payload(el);
    if (!payload || !payload.text) return false;
    el.setAttribute('data-board-done', '1');

    var chip = makeChip(payload, rule);
    var anchor = rule.before && typeof el.querySelector === 'function' ? el.querySelector(rule.before) : null;
    if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(chip, anchor);
    else if (rule.after && typeof el.querySelector === 'function' && el.querySelector(rule.after)) {
      var after = el.querySelector(rule.after);
      after.parentNode.insertBefore(chip, after.nextSibling);
    } else el.appendChild(chip);
    return true;
  }

  function run(root) {
    var host = root || document;
    var count = 0;
    RULES.forEach(function (rule) {
      var list;
      try {
        list = host.querySelectorAll ? host.querySelectorAll(rule.sel) : [];
      } catch (e) { list = []; }
      for (var i = 0; i < list.length; i++) {
        if (injectInto(list[i], rule)) count++;
      }
    });
    if (count) refreshIcons();
    return count;
  }

  function refreshIcons() {
    try {
      if (window.lucide && typeof window.lucide.createIcons === 'function') window.lucide.createIcons();
    } catch (e) { /* 忽略 */ }
  }

  /* ---------- 知识图谱节点面板（脚本动态渲染） ---------- */
  function watchPanel() {
    var panel = document.getElementById('mm-panel');
    if (!panel || typeof window.MutationObserver !== 'function') return;
    var render = function () {
      if (!panel.querySelector) return;
      var head = panel.querySelector('.mm-panel__head');
      if (!head || panel.querySelector('[data-board]')) return;
      var title = panel.querySelector('.mm-panel__title');
      var kind = panel.querySelector('.mm-panel__kind');
      if (!title) return;
      var chip = makeChip({ text: txt(title), tag: txt(kind) || '知识图谱' }, {});
      head.appendChild(chip);
      refreshIcons();
    };
    try {
      new window.MutationObserver(render).observe(panel, { childList: true, subtree: true });
    } catch (e) { /* 忽略 */ }
    render();
  }

  /* ---------- 点击：捕获阶段拦截，避免触发条目自身跳转 ---------- */
  function bindClick() {
    document.addEventListener('click', function (e) {
      var t = e.target;
      var chip = t && t.closest ? t.closest('[data-board]') : null;
      if (!chip) return;
      if (e.defaultPrevented) return;      // 已被全屏覆盖区接走（全屏时不换文档）
      if (typeof e.preventDefault === 'function') e.preventDefault();
      if (typeof e.stopPropagation === 'function') e.stopPropagation();
      var url = chip.getAttribute('data-board');
      if (url && window.location) window.location.href = url;
    }, true);
  }

  /* ---------- 动态渲染的内容（换章后的正文、搜索面板等）跟进 ---------- */
  function watchBody() {
    if (typeof window.MutationObserver !== 'function' || !document.body) return;
    if (typeof setTimeout !== 'function') return;
    var timer = null;
    try {
      new window.MutationObserver(function () {
        if (timer) return;
        timer = setTimeout(function () { timer = null; run(document); }, 160);
      }).observe(document.body, { childList: true, subtree: true });
    } catch (e) { /* 忽略 */ }
  }

  function boot() {
    ensureStyles();
    run(document);
    watchPanel();
    watchBody();
    bindClick();
  }

  if (document.readyState === 'loading' && document.addEventListener) {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  /* 供自动化自检使用 */
  window.__BOARD_LINK__ = {
    buildUrl: buildUrl,
    txt: txt,
    pick: pick,
    optionsOf: optionsOf,
    rules: RULES,
    run: run,
    makeChip: makeChip
  };
})();
