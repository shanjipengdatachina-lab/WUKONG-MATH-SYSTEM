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

   ⚠️ **"问不到"不等于"没有"**（2026-10-07 手工验收查出来的）：
   接口拉不到时 `ent` 是 null、`has()` 一律 false，但这时候**不能**替用户断言
   "你的方案里没有这一项" —— 一个已经买了的会员断网打开 3D 页，
   会被告知"去开通"。所以那份权益有一张**只读缓存**（只在拉不到时用，不顶替请求），
   并且拉不到时挂的是一张写「现在问不到你的权益」的块（带重试），
   连调用方传进来的那句话都不采用 —— 那句话同样是在断言"没有"。

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

  var state = { loaded: false, ent: null, stale: false, unknown: false };
  var once = null;

  var CACHE_KEY = 'wkmath.api.entitlement.v1';

  /* --------------------------------------------------------------------------
     权益那份缓存：**只在拉不到时用**，不用它顶替请求。
     它很小（一张 perks 表），而"是不是会员"必须尽快反映后台的改动 ——
     套餐一改，下一个页面就该变；拿缓存顶替会把"改了没生效"变成一个查不出的怪事。
     所以只有一种情况读它：**接口没拉通**。
     -------------------------------------------------------------------------- */
  function readCache() {
    try {
      var raw = window.localStorage.getItem(CACHE_KEY);
      if (!raw) { return null; }
      var got = JSON.parse(raw);
      return (got && got.data) ? got : null;
    } catch (e) { return null; }
  }

  function writeCache(ent, who) {
    try {
      window.localStorage.setItem(
        CACHE_KEY, JSON.stringify({ data: ent, who: who || '', savedAt: Date.now() }));
    } catch (e) { /* 隐私模式 / 配额满：存不下不影响这一次 */ }
  }

  function load() {
    if (!AUTH) { state.loaded = true; return Promise.resolve(state); }

    return AUTH.ready().then(function (u) {
      var asked = AUTH.reachable ? AUTH.reachable() : true;
      var who = u ? (u.username || '') : '';

      /* 服务端明确说"没登录" → 确实什么权益都没有（后台配的免费版也得先认人）。 */
      if (!u && asked) { state.loaded = true; state.ent = null; return state; }
      /* 剩下两种都要问接口：登录了；或者**没问到**（断网）——
         后者也问，因为它会失败，而失败那一支正是退缓存的地方。 */
      if (!who) { who = AUTH.mirrorName ? AUTH.mirrorName() : ''; }

      return API.get('/me/entitlement').then(
        function (ent) {
          state.ent = ent; state.stale = false; state.unknown = false; state.loaded = true;
          writeCache(ent, who);
          return state;
        },
        function (err) {
          /* **"问不到"不等于"没有"。** 401 才是服务端明确说"没登录"；
             其它（连不上 / 超时 / 5xx）都算"这一会儿看不出" ——
             这时候还写「当前方案里没有这一项」，就是替用户断言一件我们并不知道的事，
             一个买了会员的人会被自己的页面拦在门外（2026-10-07 手工验收查出来的）。 */
          state.unknown = !(err && err.status === 401);
          var c = readCache();
          if (c && (c.who || '') === who) { state.ent = c.data; state.stale = true; }
          else { state.ent = null; state.stale = false; }
          state.loaded = true;
          if (state.unknown) {
            console.warn('[WK_ENT] 权益接口没拉通，' +
              (state.stale ? '先用本地缓存顶一下' : '本地也没有缓存') + '：', err);
          }
          return state;
        }
      );
    }, function () {
      state.unknown = true;
      state.loaded = true;
      return state;
    });
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

    /* **问不到 ≠ 没有。** 断网时 `ent` 是 null、`has()` 一律回 false ——
       这时候再说「当前方案里没有这一项」，就是替用户断言一件我们并不知道的事：
       一个已经买了的会员会看到"去开通"。所以这一支单独写，并给一次重试，
       连调用方传进来的 `why` 都不采用（那句话同样是在断言"没有"）。 */
    if (state.unknown) {
      return '<div class="ent-gate" data-ent-unknown="1">' +
        '<p class="ent-gate__title">' + esc(name(code)) + ' · 现在问不到你的权益</p>' +
        '<p class="ent-gate__text">不是你没开通 —— 是这一会儿连不上服务器，' +
        '<strong>看不出</strong>你的方案里有没有「' + esc(name(code)) + '」。等网络回来再打开这一页。</p>' +
        '<div class="ent-gate__acts">' +
        '<button type="button" class="btn btn--ghost btn--sm ent-gate__retry">重试</button>' +
        '</div></div>';
    }

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
    /* "问不到"那张上有颗重试 —— 重新问一遍整页（权益是页面启动时取的，
       单独重取还要把调用方那段渲染再跑一遍，不如整页重来干脆）。 */
    var retry = el.querySelector('.ent-gate__retry');
    if (retry) { retry.addEventListener('click', function () { window.location.reload(); }); }
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
