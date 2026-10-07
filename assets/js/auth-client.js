/* ==========================================================================
   账号客户端 · 学生端与服务端会话（assets/js/auth-client.js）
   --------------------------------------------------------------------------
   改造前：`login.html` 上的"登录"是一个跳 `profile.html` 的链接，点一下往
   localStorage 写一个假的"林一鸣"（`ide-shell.js` 里的 DEMO_USER）。
   改造后：**服务端是身份的唯一来源** —— 登录 / 注册 / 重置密码都打真接口，
   会话在 httpOnly Cookie 里（前端读不到，也就不存在被脚本偷走一说）。

   本地那份 `wkmath.user` 降级成**显示用的镜像**：侧栏要立刻写出姓名/姓氏，
   不能让样式等一个网络往返。它不再决定"我是谁" —— 每次进页面都问一次 `/api/me`，
   服务端说没登录就把镜像擦掉。

   零构建：普通 <script>，依赖 `assets/js/api.js`（借它的 `WK_API.base`，
   不再自己算一遍接口地址 —— 地址只该有一处）。
   ========================================================================== */
(function () {
  'use strict';

  var API = window.WK_API;
  if (!API) { return; }

  var BASE = API.base;
  var MIRROR_KEY = 'wkmath.user';
  var TIMEOUT_MS = 12000;

  var state = { user: null, loaded: false };
  var readyPromise = null;
  /* 上一次问 `/me` **问到了没有**（服务端答了没）。见 reachable()。 */
  var lastReachable = null;

  /* --------------------------------------------------------------------------
     镜像：给侧栏看的，不是身份
     -------------------------------------------------------------------------- */
  function toMirror(u) {
    var name = u.nickname || u.username;
    return {
      id: u.id,
      username: u.username,
      name: name,
      grade: u.grade || '',
      short: name.charAt(0),
      role: u.role,
      perms: u.perms || []
    };
  }

  function mirrorOut() {
    try { window.localStorage.removeItem(MIRROR_KEY); } catch (e) { /* 隐私模式 */ }
  }

  /** 把身份交给侧栏（`ide-shell.js` 负责画）。它顺手把镜像写进 localStorage。 */
  function applyToShell(mirror) {
    if (window.WK_SHELL && window.WK_SHELL.signIn) { window.WK_SHELL.signIn(mirror); }
  }

  /** 把身份从界面和镜像里撤掉。**不动**跟人走的那份学习缓存（那是另一件事）。 */
  function shellOut() {
    if (window.WK_SHELL && window.WK_SHELL.signOut) { window.WK_SHELL.signOut(); }
    else { mirrorOut(); }
  }

  function clearShell() {
    shellOut();
    /* 学习数据是跟人走的，退出时一起擦掉 —— 共享设备上别把上一个人的进度留着 */
    if (API.dropLearningCache) { API.dropLearningCache(); }
  }

  /* --------------------------------------------------------------------------
     请求
     401 是"没登录"，不是错误 —— 上层自己按语境决定怎么处理，这里不弹任何东西。
     -------------------------------------------------------------------------- */
  function request(method, path, body) {
    var ctrl = typeof window.AbortController === 'function' ? new window.AbortController() : null;
    var timer = window.setTimeout(function () { if (ctrl) { ctrl.abort(); } }, TIMEOUT_MS);

    var opts = { method: method, credentials: 'include', headers: {} };
    if (body !== undefined) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    if (ctrl) { opts.signal = ctrl.signal; }

    return window.fetch(BASE + path, opts).then(
      function (res) {
        window.clearTimeout(timer);
        if (res.status === 204) { return null; }
        return res.text().then(function (text) {
          var parsed = null;
          try { parsed = text ? JSON.parse(text) : null; } catch (e) { parsed = null; }
          if (!res.ok) {
            var msg = (parsed && parsed.error && parsed.error.message) || ('接口回了 ' + res.status);
            var err = new Error(msg);
            /** @type {any} */ (err).status = res.status;
            /** @type {any} */ (err).code = (parsed && parsed.error && parsed.error.code) || 'UNKNOWN';
            throw err;
          }
          return parsed;
        });
      },
      function (err) {
        window.clearTimeout(timer);
        var e = new Error('连不上服务器，检查网络后重试');
        /** @type {any} */ (e).status = 0;
        /** @type {any} */ (e).cause = err;
        throw e;
      }
    );
  }

  /* --------------------------------------------------------------------------
     谁在登录
     -------------------------------------------------------------------------- */
  function ready() {
    if (!readyPromise) {
      readyPromise = request('GET', '/me').then(
        function (u) {
          state.user = u;
          state.loaded = true;
          lastReachable = true;
          applyToShell(toMirror(u));
          return u;
        },
        function (err) {
          /* **"服务端说没登录"（401）和"根本没答上"（连不上 / 超时）是两件事。**
             401 才是真的退登了 —— 擦镜像，并把跟人走的那份学习缓存一起擦掉
             （共享设备上别把上一个人的进度留着）。
             连不上只是**这一会儿问不到**：什么都不擦，镜像照留。
             原来两条走同一条 clearShell()，后果是**一次网络抖动就把离线缓存删了** ——
             而那份缓存存在的意义，正是为了断网时还能看（2026-10-07 手工验收查出来的）。
             登录闸不受这里影响：requireLogin() 看的是 ready() 的返回值，不是镜像。 */
          state.user = null;
          state.loaded = true;
          lastReachable = !(err && err.status === 0);
          if (lastReachable) {
            /* 服务端答了。401 是"确实没登录" → 连学习缓存一起清；
               其它错（5xx 之类）只是这一次问不成 → **只撤界面上的身份**，缓存留着。 */
            if (err && err.status === 401) { clearShell(); } else { shellOut(); }
          }
          return null;
        }
      );
    }
    return readyPromise;
  }

  /**
   * 上一次问 `/me` **问到了没有**。
   * `true` = 服务端答了（答的是"没登录"也算答了）；`false` = 连不上 / 超时。
   *
   * 为什么要有它：这两种情况下 `ready()` 都回 `null`，但**它们不是一回事** ——
   * 前者是"确实没登录"，后者是"这一会儿看不出你是谁"。
   * `api.js` 与 `entitlement.js` 要用它决定"退自己的缓存"还是"说问不到"，
   * 替用户断言一件我们并不知道的事（"你没有这一项"）是最要不得的那一种。
   */
  function reachable() { return lastReachable; }

  /**
   * 本机镜像里那个登录名（这台设备上一次登录过谁）。
   * **只用来认"本地这份缓存是谁的"** —— 绝不拿它当身份去决定发不发请求
   * （那会带着一个"看起来登录着"的假象去请求，见文件头那段）。
   * 没镜像 / 存坏了都回空串。
   */
  function mirrorName() {
    var raw = null;
    try { raw = window.localStorage.getItem(MIRROR_KEY); } catch (e) { return ''; }
    if (!raw) { return ''; }
    try {
      var u = JSON.parse(raw);
      return (u && u.username) || '';
    } catch (e) { return ''; }
  }

  function current() { return state.user; }

  function login(username, password) {
    return request('POST', '/auth/login', { username: username, password: password }).then(function (u) {
      state.user = u;
      state.loaded = true;
      readyPromise = Promise.resolve(u);
      applyToShell(toMirror(u));
      return u;
    });
  }

  function register(payload) {
    return request('POST', '/auth/register', payload).then(function (u) {
      state.user = u;
      state.loaded = true;
      readyPromise = Promise.resolve(u);
      applyToShell(toMirror(u));
      return u;
    });
  }

  function logout() {
    return request('POST', '/auth/logout').then(function () {
      state.user = null;
      readyPromise = Promise.resolve(null);
      clearShell();
    }, function (err) {
      /* 接口没通也把本机那份清掉：留着只会让人以为还登录着 */
      state.user = null;
      readyPromise = Promise.resolve(null);
      clearShell();
      throw err;
    });
  }

  function resetAsk(username) { return request('POST', '/auth/reset-password', { username: username }); }
  function resetConfirm(token, password) {
    return request('POST', '/auth/reset-password/confirm', { token: token, password: password });
  }

  /* --------------------------------------------------------------------------
     登录闸：把"要登录才能看"的页面收在这一处
     跳走之前把**当前这一页**记在 `next` 里，登录完直接送回来。
     -------------------------------------------------------------------------- */
  function requireLogin() {
    return ready().then(function (u) {
      if (u) { return u; }
      var here = window.location.pathname.split('/').pop() + window.location.search;
      window.location.replace('login.html?next=' + encodeURIComponent(here));
      return null;
    });
  }

  /** 当前这一页是"登录后要回到哪里" —— 只认站内相对地址，别被外链带走。 */
  function nextTarget(fallback) {
    var raw = '';
    try { raw = new URLSearchParams(window.location.search).get('next') || ''; } catch (e) { raw = ''; }
    if (!raw || /^[a-z]+:/i.test(raw) || raw.indexOf('//') === 0) { return fallback || 'profile.html'; }
    return raw;
  }

  window.WK_AUTH = {
    base: BASE,
    mirrorKey: MIRROR_KEY,
    ready: ready,
    reachable: reachable,
    mirrorName: mirrorName,
    current: current,
    login: login,
    register: register,
    logout: logout,
    resetAsk: resetAsk,
    resetConfirm: resetConfirm,
    requireLogin: requireLogin,
    nextTarget: nextTarget
  };
}());
