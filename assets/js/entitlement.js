/* ==========================================================================
   权益（assets/js/entitlement.js）
   --------------------------------------------------------------------------
   后台在「套餐与服务项目」页配了什么，前台靠这一份读出来 —— **只读、只负责显示和引导**。
   真正"能不能用"的判定在服务端（apps/api/src/middleware/perk.ts）：
   前台把按钮藏起来不算权限（设计稿 §3.6）。

   那为什么还要有这一份？因为**有一类功能服务端拦不住**：典型是 3D 图谱 ——
   它的数据来自公开的知识树接口，服务端给不出"这一份数据只给会员"的切法。
   这种只能由前台按权益决定渲不渲染。这一份就是给它们用的。

   还有一件事它必须做对：**把缺的是哪一项说清楚**。
   只说"需要会员"等于没说 —— 用户不知道要买什么，也不知道自己缺的是什么。

   ⚠️ **用之前必须先 `WK_ENT.ready()`**：没等 ready 就直接问 `has()`，
   它一律回 false（保守，宁可当作没有）—— 但那会让你以为用户没权益，
   于是遮罩挂出来了、其实是自己没等数据。timeline-3d.js 就是这么用的，照抄即可。

   依赖：assets/js/api.js（取数）、assets/js/auth-client.js（身份）。
   ========================================================================== */
(function () {
  'use strict';

  var API = window.WK_API;
  var AUTH = window.WK_AUTH;
  if (!API) { return; }

  /** 服务项目的 code → 人话。跟后端 seed/plans.ts 里那份清单一一对应。 */
  var NAMES = {
    knowledge_tree: '知识结构与正文',
    tutorial_3d: '三维交互图谱',
    question_bank: '题库与做题',
    member_solution: '会员专属题解',
    mistake_capacity: '错题本容量',
    study_report: '学习报告',
    cloud_sync: '笔记与收藏云同步',
    priority_support: '答疑优先',
    offline_pack: '离线资料包',
  };

  function esc(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  var CSS_ID = 'ent-style';
  function injectStyle() {
    if (document.getElementById(CSS_ID)) { return; }
    var st = document.createElement('style');
    st.id = CSS_ID;
    st.textContent =
      '.ent-gate{border:1px dashed var(--math-border);border-radius:var(--math-radius-md);' +
      'padding:28px 24px;text-align:center;background:var(--math-surface)}' +
      '.ent-gate__title{margin:0 0 8px;font-size:calc(15px * var(--math-fs));font-weight:600;color:var(--math-foreground)}' +
      '.ent-gate__text{margin:0 0 16px;font-size:calc(13px * var(--math-fs));line-height:1.9;color:var(--math-ink-3)}' +
      '.ent-gate__acts{display:flex;gap:10px;justify-content:center;flex-wrap:wrap}' +
      '.ent-note{margin:10px 0 0;font-size:calc(13px * var(--math-fs));line-height:1.9;color:var(--math-ink-3)}' +
      '.ent-note--full{color:var(--math-state-warning)}' +
      '.ent-lock{display:inline-flex;align-items:center;gap:4px;font-size:calc(12px * var(--math-fs));' +
      'color:var(--math-primary);text-decoration:none}';
    document.head.appendChild(st);
  }

  var state = { loaded: false, ent: null };
  var once = null;

  function load() {
    /* 没登录 = 什么权益都没有（后台配的免费版也得先认人）。
       不 pull AUTH 的情况（页面没引 auth-client）也按没登录算。 */
    if (!AUTH) { state.loaded = true; return Promise.resolve(state); }
    return AUTH.ready().then(function (u) {
      if (!u) { state.loaded = true; state.ent = null; return state; }
      return API.get('/me/entitlement').then(
        function (ent) { state.ent = ent; state.loaded = true; return state; },
        function () { state.ent = null; state.loaded = true; return state; },
      );
    }, function () { state.ent = null; state.loaded = true; return state; });
  }

  /** 取一次就够 —— 一页里问多少遍都只发一个请求。 */
  function ready() {
    if (!once) { once = load(); }
    return once;
  }

  function has(code) {
    return !!(state.ent && state.ent.perks && state.ent.perks[code]);
  }

  /** 额度：null = 不限；数字 = 上限。没有这一项时也回 null（调用方先用 has 判）。 */
  function quota(code) {
    return has(code) ? state.ent.perks[code].quota : null;
  }

  function isMember() { return !!(state.ent && state.ent.isMember); }
  function planName() { return (state.ent && state.ent.plan && state.ent.plan.name) || '免费版'; }
  function name(code) { return NAMES[code] || code; }

  /** 一张"会员专享"的块。把缺的是哪一项、下一步去哪，都写清楚。 */
  function gateHTML(code, why) {
    injectStyle();
    return '<div class="ent-gate">' +
      '<p class="ent-gate__title">' + esc(name(code)) + ' · 会员专享</p>' +
      '<p class="ent-gate__text">' + (why || ('「' + esc(name(code)) + '」这一项在当前的方案里没有。')) + '</p>' +
      '<div class="ent-gate__acts">' +
      '<a class="btn btn--primary btn--sm" href="membership.html">看会员方案</a>' +
      (state.ent === null ? '<a class="btn btn--ghost btn--sm" href="login.html">先登录</a>' : '') +
      '</div></div>';
  }

  /** 把一块地方整个换成遮罩（用于服务端拦不住的那类功能）。 */
  function paintGate(code, el, why) {
    if (!el) { return; }
    el.innerHTML = gateHTML(code, why);
    el.setAttribute('data-ent-gated', code);
  }

  /** 行内小锁，塞在某一段标题后面用。 */
  function lockHTML(code) {
    injectStyle();
    return '<a class="ent-lock" href="membership.html" title="' + esc(name(code)) + ' · 会员专享">' +
      '<i data-lucide="lock" style="width:12px;height:12px"></i>会员专享</a>';
  }

  window.WK_ENT = {
    ready: ready, has: has, quota: quota, isMember: isMember,
    name: name, planName: planName, gateHTML: gateHTML, paintGate: paintGate, lockHTML: lockHTML,
    /** 调试用：拿到原始那份权益 */
    raw: function () { return state.ent; },
  };
}());
