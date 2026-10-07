/* ==========================================================================
   接口层 · 学生端取数的唯一入口（assets/js/api.js）
   --------------------------------------------------------------------------
   学生端从"读静态文件 math-tree.js / 本机生成学习记录"改成"读后台接口"，
   唯一变化就是这一个文件。视图模块不再各自去求数据 —— 它们只等这一扇门：
   `WK_API.boot(启动函数)`。

   三条规矩（设计稿 §1.3 / Task 1.4）：
     1. **零构建**：这就是一个普通 <script>，没有打包产物、没有任何依赖。
     2. **不许白屏**：拉不到就退回**只读缓存**；缓存也没有，出一个说人话的兜底页。
     3. **页面只等这一扇门**：将来换缓存策略、加鉴权、改地址，都只改这一个文件。

   缓存为什么是只读的：服务器是唯一真相源。本地这份只用来"没网时还能看"，
   不做"本地改动稍后同步" —— 那套一上来就是另一个数量级的复杂度。
   ========================================================================== */
(function () {
  'use strict';

  var CACHE_KEY = 'wkmath.api.tree.v1';
  var LEARN_KEY = 'wkmath.api.learning.v1';
  var TIMEOUT_MS = 8000;
  /* 上传图片单独放宽：一张两三 MB 的照片在手机网络下 8 秒根本传不完，
     拿取数那套超时去卡它，等于"大一点就传不上"。 */
  var UPLOAD_TIMEOUT_MS = 60000;

  /* --------------------------------------------------------------------------
     接口地址
     生产是 Nginx 同域反代，所以默认用相对路径 `/api`（不用配、不会跨域，Cookie 也好办）。
     两种覆盖：
       ① 页面里先给 `window.WK_API_BASE`（显式，优先）
       ② 本地开发：学生端在 5173 / 5199、接口在 3000，跨了源 —— 命中这两个端口就自动指向 3000。
          两个端口都得认：`serve.rb` 的默认是 **5173**，而日常实际跑在 **5199**
          （只认 5199 的话，照默认起服务就会拉不到、直接掉进兜底页）。
          这条只在 localhost 命中，正式域名永远走不到。
     -------------------------------------------------------------------------- */
  var DEV_PORTS = ['5173', '5199'];

  var BASE = (function resolveBase() {
    if (typeof window.WK_API_BASE === 'string' && window.WK_API_BASE) {
      return window.WK_API_BASE.replace(/\/+$/, '');
    }
    var loopback = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    if (loopback && DEV_PORTS.indexOf(location.port) >= 0) {
      return location.protocol + '//' + location.hostname + ':3000/api';
    }
    return '/api';
  }());

  /* --------------------------------------------------------------------------
     静态资源地址
     上传接口回的 `url` 是**挂在接口那台机器根上**的（`/uploads/2026/10/xxx.jpg`），
     不是挂在 `/api` 底下的 —— 生产由 Nginx 把 `/uploads` 反代到接口，同域相对路径就够；
     本地开发学生端在 5173、接口在 3000，相对路径会指到 5173 去（那边没有这个目录），
     所以要把 `/api` 这一段摘掉、只留源站。
     -------------------------------------------------------------------------- */
  var ORIGIN = BASE.replace(/\/api$/, '');

  function assetUrl(url) {
    if (!url) { return ''; }
    if (/^https?:\/\//i.test(url)) { return url; }
    return ORIGIN + (url.charAt(0) === '/' ? url : '/' + url);
  }

  /* --------------------------------------------------------------------------
     本地只读缓存
     localStorage 会抛异常（隐私模式 / 配额满 / file://），所以每一处都包着 try。
     存不下**不是致命错**：这一次照样用网络那份，只是下次没得退。
     -------------------------------------------------------------------------- */
  function readCache(key) {
    try {
      var raw = window.localStorage.getItem(key);
      if (!raw) { return null; }
      var got = JSON.parse(raw);
      if (!got || !got.version || !got.data) { return null; }
      return got;
    } catch (e) {
      return null;
    }
  }

  function writeCache(key, version, data, who) {
    try {
      window.localStorage.setItem(
        key,
        JSON.stringify({ version: version, data: data, who: who || '', savedAt: Date.now() })
      );
      return true;
    } catch (e) {
      return false;
    }
  }

  /** 退出登录时把跟人走的那份缓存擦掉（共享设备上别把上一个人的数据留着）。 */
  function dropLearningCache() {
    try { window.localStorage.removeItem(LEARN_KEY); } catch (e) { /* 忽略 */ }
  }

  /* --------------------------------------------------------------------------
     通用取数：带超时的 GET，认 304
     -------------------------------------------------------------------------- */
  function getJson(path, cached, key, who) {
    var ctrl = typeof window.AbortController === 'function' ? new window.AbortController() : null;
    var timer = window.setTimeout(function () {
      if (ctrl) { ctrl.abort(); }
    }, TIMEOUT_MS);

    /* 版本走查询参数，**不用 If-None-Match**：后者不在 CORS 安全名单里，会先触发一次
       OPTIONS 预检 —— 实测那一路在 Chrome 里以 net::ERR_ABORTED 收场（服务端其实回了 304），
       每个页面白跑一趟预检、还退回缓存。查询参数不触发预检，一次往返就够。
       ETag 服务端照旧给，浏览器自己的 HTTP 缓存仍然受益。 */
    var url = BASE + path;
    if (cached && cached.version) { url += '?version=' + encodeURIComponent(cached.version); }

    var opts = {};
    /* **必须带 `credentials: 'include'`**：本地开发时学生在 5173、接口在 3000，
       这是跨源请求，而 fetch 的默认是 `same-origin` —— 不带这行就**不送 cookie**，
       `/me/learning` 直接 401，然后被下面那条"退回演示那一份"兜住。
       症状极隐蔽：页面照常显示林一鸣的数据（演示那份跟他自己的长得一模一样），
       于是"登录后看自己的"其实一直没生效，谁都不会发现。
       （生产是 Nginx 同域，本来就会送，但这条不能靠环境侥幸。） */
    opts.credentials = 'include';
    if (ctrl) { opts.signal = ctrl.signal; }

    return window.fetch(url, opts).then(
      function (res) {
        window.clearTimeout(timer);
        if (res.status === 304) {
          if (!cached) { throw new Error('服务器说没变，但本地没有缓存'); }
          return { version: cached.version, data: cached.data, from: 'cache' };
        }
        if (res.status === 401) { var e = new Error('未登录'); e.status = 401; throw e; }
        if (!res.ok) { throw new Error('接口回了 ' + res.status); }
        return res.json().then(function (body) {
          writeCache(key, body.version, body, who);
          return { version: body.version, data: body, from: 'network' };
        });
      },
      function (err) {
        window.clearTimeout(timer);
        throw err;
      }
    );
  }

  /* --------------------------------------------------------------------------
     取一份 JSON（**不缓存**）
     给学习中心那几页用（个人中心 / 错题本 / 收藏夹 / 笔记）。这些是"当场要准"的数据，
     不值得再搭一套缓存；取数仍然只走这一扇门，别的模块不许自己 fetch。
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
            var e = new Error(msg);
            e.status = res.status;
            e.code = (parsed && parsed.error && parsed.error.code) || 'UNKNOWN';
            /* 服务端说"缺的是哪一项服务项目"时会带上 perk（403 PERK_REQUIRED）——
               透给页面，它才能说出"缺的是哪一项"，而不是一句笼统的"要开通会员"。 */
            e.perk = (parsed && parsed.error && parsed.error.perk) || undefined;
            throw e;
          }
          return parsed;
        });
      },
      function () {
        window.clearTimeout(timer);
        var e = new Error('连不上服务器');
        e.status = 0;
        throw e;
      }
    );
  }

  /* --------------------------------------------------------------------------
     原样发一个 body —— **上传图片走这条**。
     不套 FormData、也不转 base64：服务端收的就是原始字节（见上传接口那段注释）。
     把 File / Blob 直接当 body，浏览器自己会按二进制发出去。
     -------------------------------------------------------------------------- */
  function requestRaw(path, body, contentType) {
    var ctrl = typeof window.AbortController === 'function' ? new window.AbortController() : null;
    var timer = window.setTimeout(function () { if (ctrl) { ctrl.abort(); } }, UPLOAD_TIMEOUT_MS);

    var opts = { method: 'POST', credentials: 'include', headers: {} };
    if (contentType) { opts.headers['Content-Type'] = contentType; }
    opts.body = body;
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
            var e = new Error(msg);
            e.status = res.status;
            e.code = (parsed && parsed.error && parsed.error.code) || 'UNKNOWN';
            throw e;
          }
          return parsed;
        });
      },
      function () {
        window.clearTimeout(timer);
        var e = new Error('连不上服务器');
        e.status = 0;
        throw e;
      }
    );
  }

  function get(path) { return request('GET', path); }
  function post(path, body) { return request('POST', path, body === undefined ? {} : body); }
  function patch(path, body) { return request('PATCH', path, body === undefined ? {} : body); }
  function del(path) { return request('DELETE', path); }
  /** 上传图片：原样发 body（File / Blob / ArrayBuffer），不套 JSON 也不套 FormData */
  function raw(path, body, contentType) { return requestRaw(path, body, contentType); }

  /* --------------------------------------------------------------------------
     知识树
     -------------------------------------------------------------------------- */
  /** 取一次树。网络不行就退缓存；缓存也没有才 reject。 */
  function tree() {
    var cached = readCache(CACHE_KEY);
    return getJson('/tree', cached, CACHE_KEY, '').catch(function (err) {
      if (cached) {
        /* 退缓存不是"静默降级"：留一条日志，免得数据看着对、其实早就过期了没人知道 */
        console.warn('[WK_API] 接口没拉通，用本地缓存（' + cached.version + '）：', err);
        return { version: cached.version, data: cached.data, from: 'cache', error: err };
      }
      throw err;
    });
  }

  /* --------------------------------------------------------------------------
     学习数据（个人中心 / 学习进度 / 时间轴用的那一整份）
     登录了取自己的（/me/learning），没登录取演示学生的（/learning/demo，公开）。

     **"我是谁"要问服务端，不读本机那个镜像。** 镜像（`wkmath.user`）是给侧栏
     立刻写得出姓名用的显示缓存；拿它当身份判据的话，会话过期时就会带着一个
     "看起来登录着"的假象去请求，然后被下面那条降级兜住 —— 又是一次"看着对、其实错"。

     **这一份拉不到不算致命**：视图那边还有本机生成的那条老路兜着，
     所以这里失败只记一条日志，不弹兜底页 —— 拿不到个人数据就把整页变成错误页，太重了。
     -------------------------------------------------------------------------- */
  function whoIsMine() {
    if (window.WK_AUTH && window.WK_AUTH.ready) {
      return window.WK_AUTH.ready().then(
        function (u) {
          if (u) { return u.username || ''; }
          /* **"这一会儿问不到"要退回镜像里那个登录名** —— 它是本地那份缓存的主人。
             不这么退的话，一次网络抖动就会让下面那句 `cached.who !== who` 成立，
             把自己那份缓存判成"别人的"直接丢掉（2026-10-07 手工验收查出来的）。
             镜像只用来认"这份缓存是谁的"，不拿它当身份去决定发不发请求。 */
          var asked = window.WK_AUTH.reachable ? window.WK_AUTH.reachable() : true;
          if (asked) { return ''; }
          return window.WK_AUTH.mirrorName ? window.WK_AUTH.mirrorName() : '';
        },
        function () { return ''; },
      );
    }
    return Promise.resolve('');
  }

  function learning() {
    return whoIsMine().then(function (who) {
      var cached = readCache(LEARN_KEY);
      /* 缓存是跟人走的：换了人（或者退出登录）就不能拿上一份用。
         注意 `who` 可能来自**镜像**（连不上时）—— 那正是为了"断网还能看自己那份"，
         见 whoIsMine() 里那段。 */
      if (cached && (cached.who || '') !== who) { cached = null; }

      var path = who ? '/me/learning' : '/learning/demo';
      return getJson(path, cached, LEARN_KEY, who).then(function (got) {
        return got;
      }, function (err) {
        if (cached) {
          console.warn('[WK_API] 学习数据没拉通，用本地缓存：', err);
          return { version: cached.version, data: cached.data, from: 'cache', error: err };
        }
        if (err && err.status === 401) {
          /* 服务端说这个会话没了 —— 退回演示那一份，别把页面留空 */
          return getJson('/learning/demo', null, LEARN_KEY, '');
        }
        throw err;
      });
    });
  }

  var readyPromise = null;

  /** 等树就绪。视图模块读的是 `window.MATH_TREE`（与改造前同一个全局，所以模块内部一行不用改）。 */
  function ready() {
    if (!readyPromise) {
      readyPromise = tree().then(
        function (got) {
          window.MATH_TREE = got.data.tree;
          window.WK_TREE_META = { version: got.version, from: got.from, base: BASE };
          return got.data.tree;
        },
        function (err) {
          readyPromise = null; /* 失败不缓存：留给"重试"一次机会 */
          throw err;
        }
      );
    }
    return readyPromise;
  }

  /** 学习数据：**失败了也不拦** —— 视图那边还有本机那条老路兜着，页面照常画。 */
  function withLearning() {
    return learning().then(
      function (got) {
        window.WK_LEARN_DATA = got.data;
        window.WK_LEARN_META = { version: got.version, from: got.from };
        return got.data;
      },
      function (err) {
        console.warn('[WK_API] 学习数据没取到，界面用本机演示规则：', err);
        return null;
      }
    );
  }

  /* 页面启动闸：等树就绪再跑 start；拉不到（且没缓存）就走兜底页，绝不留白屏。
     学习数据也**在 start 之前**取好：视图模块是在启动时同步读它的，晚一步就来不及。
     注意 `showFailure` 和这一行之间别插别的东西（体检脚本按这个距离认"有没有兜底"）。 */
  function boot(start) {
    ready().then(
      function (t) { withLearning().then(function () { start(t); }); },
      function (err) { showFailure(err); }
    );
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  var STYLE_ID = 'wk-api-fail-style';

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) { return; }
    var st = document.createElement('style');
    st.id = STYLE_ID;
    /* 自带样式，不依赖页面 CSS —— 出这页的时候，页面自己的样式可能压根没生效 */
    st.textContent =
      '.wk-api-fail{position:fixed;inset:0;z-index:99999;display:flex;flex-direction:column;' +
      'justify-content:center;align-items:center;gap:14px;padding:32px;text-align:center;' +
      'background:#0b0e14;color:#e8ecf4;font:16px/1.9 system-ui,-apple-system,"PingFang SC",sans-serif}' +
      '.wk-api-fail h1{font-size:20px;font-weight:600;margin:0}' +
      '.wk-api-fail p{margin:0;max-width:34em;color:#9aa6b8}' +
      '.wk-api-fail__why{font-size:13px;color:#6b7890}' +
      '.wk-api-fail button{margin-top:6px;padding:9px 22px;border:1px solid #35405a;border-radius:8px;' +
      'background:#161c28;color:#e8ecf4;font-size:15px;cursor:pointer}' +
      '.wk-api-fail button:hover{background:#1d2534}';
    document.head.appendChild(st);
  }

  /* --------------------------------------------------------------------------
     兜底页：连不上、且本地没缓存。
     写清楚三件事 —— 出了什么事、为什么、怎么办 —— 而不是把页面停在半空。
     -------------------------------------------------------------------------- */
  function showFailure(err) {
    var detail = err && err.message ? err.message : String(err);
    if (window.console && console.error) {
      console.error('[WK_API] 知识树拉不到，本地也没有缓存：', err);
    }

    function render() {
      injectStyle();
      var box = document.createElement('div');
      box.className = 'wk-api-fail';
      box.setAttribute('role', 'alert');
      box.innerHTML =
        '<h1>连不上服务器，这台设备上也没有缓存</h1>' +
        '<p>这一页的内容（章节 / 图谱 / 时间轴）都是从服务器取的。现在接口没通、本地也没存过，' +
        '所以没有数据可画 —— 但这不是白屏，是缺数据。</p>' +
        '<p class="wk-api-fail__why">' + escapeHtml(BASE + '/tree') + '：' + escapeHtml(detail) + '</p>' +
        '<button type="button" id="wk-api-retry">重试</button>';
      document.body.appendChild(box);
      var btn = document.getElementById('wk-api-retry');
      if (btn) {
        btn.addEventListener('click', function () { location.reload(); });
      }
    }

    if (document.body) { render(); } else { document.addEventListener('DOMContentLoaded', render); }
  }

  window.WK_API = {
    base: BASE,
    CACHE_KEY: CACHE_KEY,
    LEARNING_KEY: LEARN_KEY,
    tree: tree,
    learning: learning,
    get: get,
    post: post,
    patch: patch,
    del: del,
    raw: raw,
    asset: assetUrl,
    dropLearningCache: dropLearningCache,
    ready: ready,
    boot: boot,
    showFailure: showFailure
  };
}());
