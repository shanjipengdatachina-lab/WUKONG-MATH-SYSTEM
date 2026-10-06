/* ==========================================================================
   IDE 外壳交互 (ide-shell.js)
   --------------------------------------------------------------------------
   左 / 右面板的显示与隐藏：
     · 顶栏两个面板开关
     · 面板内部的收起按钮（左栏目录、右栏本页）
     · 快捷键 ⌘/Ctrl + B 切左栏，⌘/Ctrl + ⌥/Alt + B 切右栏
   两栏状态记在本地，刷新后保持。
   页面若在 .reader-shell 上标了 data-left-default="open"（章节页），
   则左栏每次进来都是展开的，不受上次收起状态影响。
   侧栏底部的「全屏」按钮与两栏无关，任何带该按钮的页面都生效。
   侧栏里指向当前页的入口不再整页重载（重载会白白退出全屏）。
   全屏时点站内页面链接，顶层文档不跳转，改用覆盖区里的 iframe 装目标页，
   这样全屏不会被浏览器的"换页即结束全屏"规则带走。
   鼠标点完侧栏会主动失焦，侧栏随即收回原状（键盘操作保留焦点）。
   只有存在 .reader-shell 与相关按钮的页面才会生效，其余页面空跑。
   ========================================================================== */
(function () {
  'use strict';

  var STORE_LEFT = 'wkmath.shell.left';
  var STORE_RIGHT = 'wkmath.shell.right';

  /* ------------------------------------------------------------------ *
   * 0. 全屏模式（侧栏底部的「全屏」按钮）
   *    独立于左右栏：没有 .reader-shell 的页面同样要能整页全屏。
   * ------------------------------------------------------------------ */
  (function () {
    var btn = document.getElementById('toggle-fullscreen');
    if (!btn) return;

    var label = btn.querySelector ? btn.querySelector('.ide-rail__label') : null;

    function current() {
      return document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement || null;
    }
    function supported() {
      var el = document.documentElement;
      return !!(el && (el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen));
    }
    function sync() {
      var on = !!current();
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      /* 提示语里不再跟按键（原来是"全屏模式（Esc 退出）"）：
         用户要求去掉界面上的快捷键提示 —— 键照旧好使，只是不在提示里写出来。 */
      btn.setAttribute('title', on ? '退出全屏' : '全屏模式');
      if (label) label.textContent = on ? '退出全屏' : '全屏';
    }

    // 浏览器不给这个能力（例如 iOS Safari 只让视频全屏）就别留一个按不动的按钮
    if (!supported()) {
      btn.hidden = true;
      return;
    }

    btn.addEventListener('click', function () {
      var el = document.documentElement;
      if (current()) {
        var exit = document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen;
        if (exit) { try { exit.call(document); } catch (e) { /* 忽略 */ } }
      } else {
        var req = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
        if (req) { try { req.call(el); } catch (e) { /* 忽略 */ } }
      }
      sync();
    });

    ['fullscreenchange', 'webkitfullscreenchange', 'msfullscreenchange'].forEach(function (evt) {
      document.addEventListener(evt, sync);
    });

    sync();
  })();

  /* ------------------------------------------------------------------ *
   * 0.2 点「当前页」入口不再整页重载
   *     侧栏里已经打开的那一项（以及首页点 logo）以前会重新加载整个页面，
   *     而浏览器一旦重载文档就必然退出全屏（安全限制），所以这里直接拦掉。
   * ------------------------------------------------------------------ */
  (function () {
    function isSelfLink(href) {
      if (!href || href.indexOf('?') >= 0 || href.indexOf('#') >= 0) return false;
      var file = href.split('/').pop();
      var here = window.location.pathname.split('/').pop() || 'home.html';
      return file !== '' && file === here;
    }

    var links = document.querySelectorAll ? document.querySelectorAll('.ide-rail a[href]') : [];
    Array.prototype.forEach.call(links, function (link) {
      if (!isSelfLink(link.getAttribute('href'))) return;
      link.addEventListener('click', function (event) {
        if (event.defaultPrevented) return;      // 已经被覆盖区（0.3）接走了
        event.preventDefault();
        // 给一次可见回应：已经在本页，那就回到顶部
        if (window.scrollY > 8) window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });
  })();

  /* ------------------------------------------------------------------ *
   * 0.3 全屏时切栏目不再掉全屏
   *     浏览器规则：文档一卸载（换页）就结束全屏，任何网站都一样。
   *     所以全屏下点站内页面链接时，顶层文档不跳转，改为把目标页面装进
   *     一个覆盖区里的 iframe —— 顶层文档始终没卸载，全屏就保住了。
   *     覆盖区里的页面会带上 data-embed（隐藏自己的侧栏，导航交给外层）。
   *     退出全屏时收回覆盖区，用正常方式加载当前页。
   * ------------------------------------------------------------------ */
  (function () {
    // 自己就是被装进覆盖区的那个页面：藏掉侧栏，导航交给外层
    if (window.self !== window.top) {
      document.documentElement.setAttribute('data-embed', '');
      return;
    }

    function fullscreenOn() {
      return !!(document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement);
    }
    function here() {
      return window.location.pathname.split('/').pop() || 'home.html';
    }
    function fileOf(href) {
      if (!href || href.charAt(0) === '#' || href.indexOf('//') === 0) return null;
      if (/^[a-z][a-z0-9+.-]*:/i.test(href)) return null;      // http: / mailto: 等外链
      var file = href.split('#')[0].split('?')[0].split('/').pop();
      return /\.html$/i.test(file) ? file : null;
    }
    function linkInfo(link) {
      if (!link || !link.getAttribute) return null;
      var target = link.getAttribute('target');
      if (target && target !== '_self') return null;
      if (link.hasAttribute && link.hasAttribute('download')) return null;
      var href = link.getAttribute('href');
      var file = fileOf(href);
      return file ? { href: href, file: file } : null;
    }

    var box = null;        // 覆盖区
    var frame = null;      // 装页面的 iframe
    var shown = null;      // 覆盖区里当前是哪一页

    function pushUrl(file) {
      if (!file || !window.history || typeof window.history.pushState !== 'function') return;
      if (here() === file) return;
      try { window.history.pushState({ fsShell: 1 }, '', file); } catch (e) { /* 忽略 */ }
    }
    function syncRail() {
      var items = document.querySelectorAll ? document.querySelectorAll('.ide-rail a[href]') : [];
      Array.prototype.forEach.call(items, function (item) {
        var info = linkInfo(item);
        if (info && info.file === shown) {
          item.setAttribute('data-active', 'true');
          item.setAttribute('aria-current', 'page');
        } else if (item.getAttribute && item.getAttribute('aria-current')) {
          item.removeAttribute('data-active');
          item.removeAttribute('aria-current');
        }
      });
    }
    function onLoaded() {
      try {
        shown = frame.contentWindow.location.pathname.split('/').pop();
        if (frame.contentDocument && frame.contentDocument.title) document.title = frame.contentDocument.title;
      } catch (e) { /* 跨域就忽略（本站不会） */ }
      syncRail();
      pushUrl(shown);
    }
    function build() {
      box = document.createElement('div');
      box.className = 'fs-shell';
      frame = document.createElement('iframe');
      frame.className = 'fs-shell__frame';
      frame.setAttribute('title', '页面内容');
      box.appendChild(frame);
      document.body.appendChild(box);
      frame.addEventListener('load', onLoaded);
      var top = document.querySelector ? document.querySelector('.to-top') : null;
      if (top) top.hidden = true;      // 顶层那个"回到顶部"让位给覆盖区里的
    }
    function load(href, file) {
      if (!box) build();
      if (file === shown) return;
      shown = file;
      frame.setAttribute('src', href);
      syncRail();
      pushUrl(file);
    }

    document.addEventListener('click', function (event) {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      var link = event.target && event.target.closest ? event.target.closest('a[href]') : null;
      var info = linkInfo(link);
      if (!info) return;
      // 没进覆盖区、又不在全屏：照常跳转，一点也不改变原有行为
      if (!box && !fullscreenOn()) return;
      if (typeof event.preventDefault === 'function') event.preventDefault();
      if (info.file === (shown || here())) return;   // 就是当前这一页：原地不动
      load(info.href, info.file);
    }, true);

    window.addEventListener('popstate', function () {
      if (!box || !frame) return;
      var file = here();
      if (file === shown) return;
      frame.setAttribute('src', file);
    });

    ['fullscreenchange', 'webkitfullscreenchange', 'msfullscreenchange'].forEach(function (evt) {
      document.addEventListener(evt, function () {
        if (!box || fullscreenOn()) return;
        // 退出全屏：收回覆盖区，按正常方式加载当前页（这时不必再保持全屏）
        var url = shown || here();
        if (window.location && typeof window.location.replace === 'function') {
          window.location.replace(url);
        }
      });
    });
  })();

  /* ------------------------------------------------------------------ *
   * 0.4 用鼠标点完侧栏，侧栏自己收回去
   *     侧栏平时 56px，靠 :hover / :focus-within 展开成 212px。
   *     点过的按钮会一直占着焦点，鼠标移开也收不回去，所以鼠标点完
   *     主动失焦；键盘操作（Enter / 空格）触发的点击保留焦点，不影响键盘。
   * ------------------------------------------------------------------ */
  (function () {
    var rail = document.querySelector ? document.querySelector('.ide-rail') : null;
    if (!rail || !rail.addEventListener) return;

    rail.addEventListener('click', function (event) {
      if (event.detail === 0) return;        // 键盘触发：留住焦点
      var item = event.target && event.target.closest
        ? event.target.closest('.ide-rail__item, .ide-rail__account, .ide-rail__brand')
        : null;
      if (!item || typeof item.blur !== 'function') return;
      item.blur();
    });
  })();

  /* ------------------------------------------------------------------ *
   * 会话：登录后全站侧栏显示账号
   *
   * **这一段必须排在下面那个 early return 之前。**
   * 它是全站共用的（登录页 / 个人中心这些页面没有 .reader-shell），
   * 早退会把 window.WK_SHELL 一起跳掉 —— 那几页的侧栏就永远只能是静态样子。
   *
   * 本机这份 `wkmath.user` 只是**显示用的镜像**：真正的身份在服务端
   * （httpOnly Cookie，脚本读不到），每次进页面由 assets/js/auth-client.js
   * 问一次 /api/me 来校正。这份镜像只为了让侧栏立刻写得出姓名，
   * 不再决定“我是谁”。
   * ------------------------------------------------------------------ */

  var SESSION_KEY = 'wkmath.user';
  var DEMO_USER = { name: '林一鸣', grade: '七年级（下）', short: '林' };

  function readSession() {
    try {
      var raw = window.localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (err) {
      return null;
    }
  }

  function writeSession(user) {
    try {
      if (user) window.localStorage.setItem(SESSION_KEY, JSON.stringify(user));
      else window.localStorage.removeItem(SESSION_KEY);
    } catch (err) { /* 隐私模式下忽略 */ }
  }

  function accountEl() {
    return document.querySelector ? document.querySelector('.ide-rail__account') : null;
  }

  function markupLoggedIn() {
    var acct = accountEl();
    if (!acct) return false;
    var href = acct.getAttribute('href') || '';
    return href !== 'login.html' && href !== 'register.html';
  }

  function currentUser() {
    var saved = readSession();
    if (saved && saved.name) {
      return {
        name: saved.name,
        grade: saved.grade || DEMO_USER.grade,
        short: saved.short || saved.name.charAt(0)
      };
    }
    if (markupLoggedIn()) {
      return { name: DEMO_USER.name, grade: DEMO_USER.grade, short: DEMO_USER.short };
    }
    return null;
  }

  // 登录/退出后让侧栏跟着变；未登录时不强改页面上原来的样子
  function syncAccount() {
    var acct = accountEl();
    if (!acct) return;
    var user = currentUser();
    if (!user) return;
    acct.setAttribute('href', 'profile.html');
    acct.setAttribute('title', '个人中心 · ' + user.name + ' · ' + user.grade);
    var avatar = acct.querySelector('.ide-rail__avatar');
    if (avatar) avatar.textContent = user.short;
    var label = acct.querySelector('.ide-rail__label');
    if (label) label.textContent = user.name;
  }

  function signIn(user) { writeSession(user || DEMO_USER); syncAccount(); }

  // 退出：清会话，并把侧栏恢复成未登录的样子
  function revertAccount() {
    var acct = accountEl();
    if (!acct) return;
    acct.setAttribute('href', 'login.html');
    acct.setAttribute('title', '登录 / 注册');
    var avatar = acct.querySelector('.ide-rail__avatar');
    if (avatar) avatar.innerHTML = '<i data-lucide="user"></i>';
    var label = acct.querySelector('.ide-rail__label');
    if (label) label.textContent = '登录';
    if (window.lucide && window.lucide.createIcons) {
      try { window.lucide.createIcons(); } catch (err) { /* 忽略 */ }
    }
  }

  function signOut() {
    writeSession(null);
    revertAccount();
  }

  syncAccount();

  // 登录页：点"登录"就记下会话，再照常跳个人中心
  // ——只在这页**没有真的账号客户端**时才这么干（`assets/js/auth-client.js` 一旦在，
  //   登录要走服务端：那里是 httpOnly Cookie，点一下就在本机记个名字，等于没有登录态）。
  var loginSubmit = document.querySelector('[data-dom-id="login-submit"]');
  if (loginSubmit) {
    loginSubmit.addEventListener('click', function () {
      if (window.WK_AUTH) { return; }
      signIn(DEMO_USER);
    });
  }

  // 设置页：退出登录清掉本机会话
  var logoutBtn = document.querySelector('[data-dom-id="settings-logout"]');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', function () { signOut(); });
  }

  window.WK_SHELL = {
    user: DEMO_USER,
    signIn: signIn,
    signOut: signOut,
    session: readSession,
    current: currentUser,
    syncAccount: syncAccount
  };

  var shell = document.querySelector('.reader-shell');
  var leftBtn = document.getElementById('toggle-left');    // 顶栏：左栏开关
  var rightBtn = document.getElementById('toggle-right');  // 顶栏：右栏开关
  var treeBtn = document.getElementById('tree-collapse');  // 左栏内：收起
  var sideBtn = document.getElementById('side-collapse');  // 右栏内：收起

  if (!shell || (!leftBtn && !rightBtn && !treeBtn && !sideBtn)) return;

  // 页面可以声明「左栏默认展开」（例如章节页：目录就是入口），
  // 声明之后不再被上次的收起状态带走，进页面就能看到章节目录。
  var leftAlwaysOpen = shell.getAttribute('data-left-default') === 'open';

  function readStore(key) {
    try { return window.localStorage.getItem(key); } catch (e) { return null; }
  }
  function writeStore(key, value) {
    try { window.localStorage.setItem(key, value); } catch (e) { /* 隐私模式下忽略 */ }
  }

  function leftHidden() {
    return shell.getAttribute('data-left') === 'hidden';
  }
  function rightHidden() {
    return shell.getAttribute('data-right') === 'hidden';
  }

  /* 收起 / 展开这两颗按钮的图标**随状态换一个**，而不是把同一个箭头转 180°：
     面板形状的图标转过来会把"面板"画到另一侧去（左栏那颗一转就成了"面板在右边"），
     看着就不对了 —— 用户点名要换的就是这个箭头。
     lucide 会把 <i data-lucide> 换成 <svg>（原 <i> 就没了），所以整块重写再让它重画一次
     —— 跟下面头像那处同一个写法；图标名没变就跳过，省一次 SVG 重建。 */
  function setCollapseIcon(btn, name, cls) {
    if (!btn || btn.getAttribute('data-collapse-icon') === name) return;
    btn.setAttribute('data-collapse-icon', name);
    btn.innerHTML = '<i data-lucide="' + name + '" class="' + cls + '"></i>';
    if (window.lucide && window.lucide.createIcons) {
      try { window.lucide.createIcons(); } catch (err) { /* 忽略 */ }
    }
  }

  function syncPanels() {
    var lh = leftHidden();
    var rh = rightHidden();
    if (leftBtn) leftBtn.setAttribute('aria-pressed', lh ? 'false' : 'true');
    if (rightBtn) rightBtn.setAttribute('aria-pressed', rh ? 'false' : 'true');
    if (treeBtn) {
      treeBtn.setAttribute('aria-expanded', lh ? 'false' : 'true');
      treeBtn.setAttribute('aria-label', lh ? '展开目录' : '收起目录');
      treeBtn.setAttribute('title', lh ? '展开目录' : '收起目录');
      setCollapseIcon(treeBtn, lh ? 'panel-left-open' : 'panel-left-close', 'tree-collapse__icon');
    }
    if (sideBtn) {
      sideBtn.setAttribute('aria-expanded', rh ? 'false' : 'true');
      sideBtn.setAttribute('aria-label', rh ? '展开右栏' : '隐藏右栏');
      /* 提示语里不再跟快捷键（原来是"隐藏右栏（⌘/Ctrl + ⌥/Alt + B）"）——
         用户要求去掉界面上的快捷键提示；⌘/Ctrl + ⌥/Alt + B 本身照旧好使。 */
      sideBtn.setAttribute('title', rh ? '展开右栏' : '隐藏右栏');
      setCollapseIcon(sideBtn, rh ? 'panel-right-open' : 'panel-right-close', 'side-collapse__icon');
    }
  }

  function setLeft(hidden) {
    if (hidden) shell.setAttribute('data-left', 'hidden');
    else shell.removeAttribute('data-left');
    writeStore(STORE_LEFT, hidden ? 'hidden' : 'shown');
    syncPanels();
  }
  function setRight(hidden) {
    if (hidden) shell.setAttribute('data-right', 'hidden');
    else shell.removeAttribute('data-right');
    writeStore(STORE_RIGHT, hidden ? 'hidden' : 'shown');
    syncPanels();
  }

  if (leftBtn) leftBtn.addEventListener('click', function () { setLeft(!leftHidden()); });
  if (rightBtn) rightBtn.addEventListener('click', function () { setRight(!rightHidden()); });
  if (sideBtn) sideBtn.addEventListener('click', function () { setRight(!rightHidden()); });
  if (treeBtn) {
    treeBtn.addEventListener('click', function (event) {
      // 按钮位于 label 内部，阻止 label 去联动那个隐藏的 checkbox
      event.preventDefault();
      event.stopPropagation();
      setLeft(!leftHidden());
    });
  }

  document.addEventListener('keydown', function (event) {
    if (!(event.metaKey || event.ctrlKey) || event.code !== 'KeyB') return;
    event.preventDefault();
    if (event.altKey) setRight(!rightHidden());
    else setLeft(!leftHidden());
  });

  if (!leftAlwaysOpen && readStore(STORE_LEFT) === 'hidden') setLeft(true);
  if (readStore(STORE_RIGHT) === 'hidden') setRight(true);
  syncPanels();

})();
