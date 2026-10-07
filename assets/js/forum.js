/* ============================================================
   论坛（演示版）：发帖 · 回复 · 专题
   · 数据存在本机浏览器（localStorage），首次进入写入一批演示数据
   · 论坛首页：专题筛选 + 最新 / 热门 + 内嵌发帖表单
   · 帖子详情：读 ?id= 渲染正文与楼层，可回复、可引用
   · 正文排版极简：空行分段、「- 」起头成列表、$…$ 认作公式
   ============================================================ */
(function () {
  'use strict';

  var KEY = 'wkmath.forum.v1';
  var VER = 1;
  var ME = '林一鸣';                 // 演示账号（与侧栏左下角一致）
  var MIN = 60 * 1000;
  var HOUR = 60 * MIN;
  var DAY = 24 * HOUR;

  var BOARDS = [
    { id: 'study', name: '学习交流', desc: '方法、笔记与学习节奏', note: '方法、笔记与学习节奏。欢迎分享你的听课笔记与复习安排。' },
    { id: 'help', name: '解题求助', desc: '卡住的题，发出来一起看', note: '卡住的题，发出来一起看。请写清已知条件与已经尝试的步骤。' },
    { id: 'exam', name: '真题讨论', desc: '历年真题的解法与坑', note: '历年真题的解法与坑。贴题请标注年份与地区。' }
  ];

  /* ---------------- 演示数据 ---------------- */
  function seed() {
    var now = Date.now();
    return {
      v: VER,
      posts: [
        {
          id: 'p1', board: 'help',
          title: '第十九章一次函数，分段讨论题怎么入手？',
          author: '陈知远', at: now - 2 * HOUR, views: 326,
          body: '最近做第十九章的题，一遇到 $y = kx + b$ 里带绝对值，或者题目分段给条件，就不知道从哪一步开始分类。\n\n比如这道：已知一次函数 $y = 2x - 4$，当 $-1 ≤ x ≤ 3$ 时，求 $y$ 的取值范围。我的做法是先把两端代入，算出 $x = -1$ 时 $y = -6$、$x = 3$ 时 $y = 2$，但不确定这样直接取两端是否总是成立。\n\n想问问大家，判断这类题有没有统一的入手顺序？还是必须先看 $k$ 的符号？',
          floors: [
            {
              who: '周予安', role: '热心答主', at: now - 1 * HOUR,
              text: '先看 $k$ 的符号是关键。这道题 $k = 2 > 0$，函数单调递增，所以最小值在左端点、最大值在右端点，取两端直接写就行。'
            },
            {
              who: '林一鸣', at: now - 52 * MIN,
              text: '补充一点：如果 $k < 0$，函数单调递减，两端就要对调，最小值落在右端点。所以先判单调性再取端点，不会错。'
            },
            {
              who: '郑向晚', at: now - 31 * MIN,
              text: '我把判断顺序整理成三步，考前当口诀背：\n- 先看 $k > 0$ 还是 $k < 0$\n- 再定函数在这段区间上的单调性\n- 最后把区间两端代入，取对应的最值'
            }
          ]
        },
        {
          id: 'p2', board: 'study',
          title: '数轴和相反数总是搞混，有没有好的记忆方法？',
          author: '林一鸣', at: now - 26 * HOUR, views: 214,
          body: '初学有理数的时候，$-(-3)$ 和 $|-3|$ 我总要看半天才反应过来。\n\n现在我的办法是先画一条数轴，把「相反数」想成关于原点对称，「绝对值」想成到原点的距离，两个动作分开做，正确率明显高了。',
          floors: [
            {
              who: '周予安', at: now - 22 * HOUR,
              text: '这个办法很稳。再补一句：相反数看符号，绝对值看距离，一句话各管一件事，就不会混。'
            }
          ]
        },
        {
          id: 'p3', board: 'help',
          title: '勾股定理的逆定理判断，为什么要先找最长边？',
          author: '周予安', at: now - 30 * HOUR, views: 189,
          body: '判断三边能不能组成直角三角形，书上每次都说「先找最长边」，我一直不太明白必要性。\n\n后来自己试了一组 $3, 4, 5$ 和三组错的数对，发现如果最长边找错，$a^2 + b^2$ 和 $c^2$ 的大小关系就完全没意义了。是这样理解吗？',
          floors: [
            {
              who: '陈知远', at: now - 28 * HOUR,
              text: '理解对了。逆定理的结论是「最长边的平方等于另外两边的平方和」，前提就是 $c$ 必须是最长边，否则这个等式本身不成立。'
            },
            {
              who: '郑向晚', at: now - 26 * HOUR,
              text: '实际做题时我习惯先排序再代入，多花十秒，能避免整道题做反。'
            },
            {
              who: '林一鸣', at: now - 25 * HOUR,
              text: '先排序再代入这个习惯我记下了，之前总嫌多一步，结果整道题做反过两次。'
            }
          ]
        },
        {
          id: 'p4', board: 'study',
          title: '一元二次方程配方法，配方那一步总是算错',
          author: '林一鸣', at: now - 3 * DAY, views: 152,
          body: '形如 $x^2 + bx + c = 0$ 的方程，配方法我能背下步骤，但一遇到 $b$ 是分数或者负数就容易算错。\n\n现在改成先把二次项系数化成 $1$，再单独算「一次项系数一半的平方」这一步，出错少多了。',
          floors: [
            {
              who: '陈知远', at: now - 3 * DAY + 3 * HOUR,
              text: '我也是这样分两步写，中间那一步单独抄一行，不跟其他变形混在一起。'
            }
          ]
        },
        {
          id: 'p5', board: 'study',
          title: '第二十二章二次函数，图象平移方向的记忆方法',
          author: '陈知远', at: now - 4 * DAY, views: 268,
          body: '顶点式 $y = a(x - h)^2 + k$ 里，$h$ 是「左加右减」、$k$ 是「上加下减」，我总把 $h$ 的方向记反。\n\n后来改成先写出顶点 $(h, k)$，直接看顶点从原点搬到了哪里，再描述平移，就不再背口诀了。',
          floors: [
            {
              who: '周予安', at: now - 4 * DAY + 5 * HOUR,
              text: '看顶点比背口诀可靠。口诀是为了快，顶点是为了对，先对再快。'
            },
            {
              who: '林一鸣', at: now - 3 * DAY - 12 * HOUR,
              text: '按顶点看方向这招好用，我把 $h$ 的符号画成一个小箭头贴在书上，翻到就会看一眼。'
            },
            {
              who: '郑向晚', at: now - 40 * MIN,
              text: '再补一个例子：$y = 2(x - 3)^2 + 1$ 的顶点是 $(3, 1)$，从原点搬到右上方，所以是「右移 3、上移 1」。'
            }
          ]
        },
        {
          id: 'p6', board: 'exam',
          title: '平行四边形判定，什么情况下用对角线判定更快？',
          author: '林一鸣', at: now - 6 * DAY, views: 143,
          body: '做了几套真题发现，只要题目给的是对角线互相平分，用对角线判定一步就结束了，比凑两组对边省事得多。\n\n但如果是给边的关系，还是老老实实用两组对边分别相等更快。大家是怎么选的？',
          floors: [
            {
              who: '郑向晚', at: now - 6 * DAY + 8 * HOUR,
              text: '我的原则是「给什么用什么」：给对角线就用对角线判定，给边就用边的判定，别绕。'
            }
          ]
        }
      ]
    };
  }

  /* ---------------- 存取 ---------------- */
  function save(db) {
    /* M5：接了后台之后**服务器是唯一真相源**，本地不再存一份 ——
       存了就会有两个真相（刷新时读库、改动只在本机看得见）。发帖/回复走接口。 */
    if (REMOTE) { return; }
    try { window.localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { /* 隐私模式下会失败，忽略 */ }
  }
  function load() {
    /* M5：服务器那一份已经适配成下面这个形状了，直接给它 */
    if (REMOTE) { return REMOTE; }
    var raw = null;
    try { raw = window.localStorage.getItem(KEY); } catch (e) { raw = null; }
    var db = null;
    if (raw) { try { db = JSON.parse(raw); } catch (e) { db = null; } }
    if (!db || db.v !== VER || !db.posts || !db.posts.length) {
      db = seed();
      save(db);
    }
    return db;
  }

  /* ==========================================================================
     M5 · 数据从后台来
     --------------------------------------------------------------------------
     `REMOTE` 一旦有值，`load()` 就把它给出去、`save()` 变成空操作 ——
     于是**下面那一整套渲染一个字都不用改**（列帖、进专题、看详情、画楼层全照旧），
     变的只是数据从哪儿来、写往哪儿去。

     为什么不干脆把论坛重写一遍：渲染里有不少细节（`timeAgo` / `heat` / `rich` / `lastAt`）
     已经调过好几轮，重写一遍等于把它们再踩一遍坑。改成"换数据源"是最小代价。

     适配：服务器回的是 `{id, boardCode, boardName, title, authorName, views, replies, at(ISO)}`，
     这里翻成本地那套 `{id, board, title, author, at(数字), views, floors[]}`。
     列表接口不返回每个楼层，所以 `floors` 先按条数占位（`length` 是对的，内容为空）——
     详情页会拿真楼层覆盖掉。
     ========================================================================== */
  var REMOTE = null;

  function api() { return window.WK_API && window.WK_API.get ? window.WK_API : null; }

  function toLocalPost(row, floors) {
    var at = Date.parse(row.at);
    return {
      id: String(row.id),
      board: row.boardCode,
      title: row.title,
      author: row.authorName,
      at: isNaN(at) ? Date.now() : at,
      views: row.views,
      body: row.body || '',
      floors: floors || new Array(row.replies || 0),
      mine: row.mine === true,
      pinned: row.pinned === true,
      good: row.good === true,
    };
  }

  /** 置顶/加精小标记 —— 列表里挂在标题前，颜色用 token 而不是写死。
      用 inline 样式是因为 forum.html / board.html / my-posts.html 各自带 style 块，
      在每个文件里加一遍样式不如这里集中管一份。 */
  function pinTag(p) {
    var s = 'display:inline-flex;align-items:center;height:18px;padding:0 6px;' +
      'border-radius:var(--math-radius-xs);font-size:calc(11px * var(--math-fs));' +
      'font-weight:600;margin-right:6px;line-height:1;letter-spacing:.04em;';
    var out = '';
    if (p.pinned) out += '<span class="post__pin" style="' + s +
      'background:var(--math-primary-tint);color:var(--math-primary);">置顶</span>';
    if (p.good) out += '<span class="post__good" style="' + s +
      'background:color-mix(in srgb, var(--math-state-warning) 16%, transparent);' +
      'color:var(--math-state-warning);">精</span>';
    return out;
  }

  function toLocalFloor(r) {
    var at = Date.parse(r.at);
    return {
      who: r.authorName, role: r.role || '',
      at: isNaN(at) ? Date.now() : at,
      text: r.text, mine: r.mine === true,
    };
  }

  /** 把服务器那几份数据取回来，装成 `REMOTE`。拿不到就返回 false（照老路走本机那份）。 */
  function pullRemote() {
    var A = api();
    if (!A) { return Promise.resolve(false); }
    return A.get('/forum/boards').then(function (b) {
      if (b && b.items && b.items.length) {
        BOARDS.length = 0;
        b.items.forEach(function (x) {
          BOARDS.push({ id: x.code, name: x.name, desc: x.desc || '', note: x.note || x.desc || '' });
        });
      }
      return A.get('/forum/posts');
    }).then(function (list) {
      var posts = (list.items || []).map(function (p) { return toLocalPost(p); });
      /* **原地更新**，不要整个换成新对象：页面里 `var db = load()` 早就把
         REMOTE 这个引用存下来了（发完帖再 pullRemote 一次时，换新对象会让
         db 还指着旧那份，列表就迟迟不刷新）。 */
      if (REMOTE) { REMOTE.v = VER; REMOTE.posts = posts; }
      else { REMOTE = { v: VER, posts: posts }; }
      return true;
    }, function () { return false; });
  }

  /** 当前登录的人（没有就用页面上那个演示名字） */
  function meName() {
    if (window.WK_AUTH && window.WK_AUTH.current && window.WK_AUTH.current()) {
      return window.WK_AUTH.current().nickname;
    }
    return ME;
  }

  /** 要登录才让做的事，都从这里过一道。
      **必须 await `WK_AUTH.ready()`** —— 它是异步问服务端的（`/api/me`）。
      直接读 `WK_AUTH.current()` 会踩一个很隐蔽的坑：页面刚打开那一两秒
      `current()` 还是 null，于是**明明登录着**的人点发帖却被送去登录页。
      （这个坑真踩了：回复提交后跳到了 login.html?next=...） */
  function needLogin(run) {
    if (!window.WK_AUTH || !window.WK_AUTH.ready) { run(); return; }
    window.WK_AUTH.ready().then(function (u) {
      if (u) { run(); return; }
      toast('发帖和回复要登录 —— 这就带你去登录页');
      var here = window.location.pathname.split('/').pop() + window.location.search;
      window.setTimeout(function () {
        window.location.assign('login.html?next=' + encodeURIComponent(here));
      }, 700);
    });
  }

  /* ---------------- 小工具 ---------------- */
  function toast(msg) {
    if (window.MathSite && typeof window.MathSite.toast === 'function') window.MathSite.toast(msg);
  }
  function icons() {
    if (window.MathSite && typeof window.MathSite.icons === 'function') window.MathSite.icons();
  }
  function esc(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function inline(s) {
    return esc(s).replace(/\$([^$]+)\$/g, '<span class="m">$1</span>');
  }
  /* 极简排版：空行分段；同一段里「- 」起头的行单独成列表 */
  function rich(text, pClass) {
    var open = pClass ? '<p class="' + pClass + '">' : '<p>';
    var blocks = String(text || '').replace(/\r\n/g, '\n').split(/\n{2,}/);
    var out = [];
    blocks.forEach(function (block) {
      var lines = block.split('\n').filter(function (l) { return l.trim() !== ''; });
      if (!lines.length) return;
      var buf = [];
      var mode = null;
      function flush() {
        if (!buf.length) return;
        out.push(mode === 'ul'
          ? '<ul>' + buf.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul>'
          : open + buf.join('<br>') + '</p>');
        buf = [];
      }
      lines.forEach(function (line) {
        var bullet = /^\s*[-·]\s+/.test(line);
        var next = bullet ? 'ul' : 'p';
        if (mode && next !== mode) flush();
        mode = next;
        buf.push(inline(bullet ? line.replace(/^\s*[-·]\s+/, '') : line));
      });
      flush();
    });
    return out.join('');
  }
  function timeAgo(at) {
    var d = Date.now() - (at || 0);
    if (d < MIN) return '刚刚';
    if (d < HOUR) return Math.floor(d / MIN) + ' 分钟前';
    if (d < DAY) return Math.floor(d / HOUR) + ' 小时前';
    if (d < 30 * DAY) return Math.floor(d / DAY) + ' 天前';
    var dt = new Date(at);
    return (dt.getMonth() + 1) + ' 月 ' + dt.getDate() + ' 日';
  }
  function boardOf(id) {
    for (var i = 0; i < BOARDS.length; i++) if (BOARDS[i].id === id) return BOARDS[i];
    return { id: id, name: id, desc: '', note: '' };
  }
  function lastAt(post) {
    return post.floors.length ? post.floors[post.floors.length - 1].at : post.at;
  }
  function query(name) {
    var m = new RegExp('[?&]' + name + '=([^&]*)').exec(window.location.search || '');
    return m ? decodeURIComponent(m[1]) : '';
  }
  function byId(id) { return document.getElementById(id); }
  function each(list, fn) { Array.prototype.forEach.call(list || [], fn); }
  function heat(p) { return p.floors.length * 3 + Math.round((p.views || 0) / 50); }

  /* ---------------- 论坛首页 ---------------- */
  function initHome() {
    var listEl = byId('forum-list');
    if (!listEl) return false;

    var countEl = byId('forum-count');
    var secTitle = byId('forum-sec-title');
    var boardLink = byId('forum-board-link');
    var box = byId('forum-compose-box');
    var openBtn = byId('forum-compose-open');
    var cancelBtn = byId('forum-compose-cancel');
    var submitBtn = byId('compose-submit');
    var titleIn = byId('compose-title');
    var boardIn = byId('compose-board');
    var bodyIn = byId('compose-body');

    var db = load();
    var state = { tab: query('tab') === 'hot' ? 'hot' : 'latest', board: query('board') || null };

    function cards() { return document.querySelectorAll('[data-board]'); }
    function tabs() { return document.querySelectorAll('[data-tab]'); }

    function visible() {
      var posts = db.posts.filter(function (p) { return !state.board || p.board === state.board; });
      posts.sort(state.tab === 'hot'
        ? function (a, b) { return heat(b) - heat(a) || b.at - a.at; }
        : function (a, b) { return b.at - a.at; });
      return posts;
    }

    function postHtml(p) {
      return '<a class="post" href="forum-thread.html?id=' + encodeURIComponent(p.id) + '">' +
        '<div class="post__body">' +
          '<p class="post__title">' + pinTag(p) + esc(p.title) + '</p>' +
          '<div class="post__meta">' +
            '<span class="post__tag">' + esc(boardOf(p.board).name) + '</span>' +
            '<span class="post__info">' + esc(p.author) + ' · <b>' + p.floors.length + '</b> 条回复 · ' + timeAgo(p.at) + '</span>' +
          '</div>' +
        '</div>' +
        '<i data-lucide="chevron-right" class="post__arrow"></i>' +
      '</a>';
    }

    function render() {
      each(cards(), function (card) {
        var id = card.getAttribute('data-board');
        var n = db.posts.filter(function (p) { return p.board === id; }).length;
        var countNode = card.querySelector ? card.querySelector('.board__count') : null;
        if (countNode) countNode.textContent = n + ' 主题';
        if (id === state.board) card.setAttribute('data-active', 'true');
        else card.removeAttribute('data-active');
      });
      each(tabs(), function (tab) {
        if (tab.getAttribute('data-tab') === state.tab) tab.setAttribute('data-active', 'true');
        else tab.removeAttribute('data-active');
      });
      if (countEl) {
        countEl.textContent = state.board
          ? boardOf(state.board).name + ' · ' + visible().length + ' 个主题'
          : '共 ' + db.posts.length + ' 个主题';
      }
      if (secTitle) {
        secTitle.textContent = state.board
          ? boardOf(state.board).name
          : (state.tab === 'hot' ? '热门主题' : '最新主题');
      }
      if (boardLink) {
        if (state.board) {
          boardLink.hidden = false;
          boardLink.setAttribute('href', 'board.html?board=' + encodeURIComponent(state.board));
          boardLink.textContent = '进入「' + boardOf(state.board).name + '」专题页';
        } else {
          boardLink.hidden = true;
        }
      }
      var posts = visible();
      listEl.innerHTML = posts.length
        ? posts.map(postHtml).join('')
        : '<p class="empty">这个专题还没有帖子，点右上角「发帖」写第一条。</p>';
      icons();
    }

    function syncUrl() {
      var url = 'forum.html';
      var qs = [];
      if (state.board) qs.push('board=' + encodeURIComponent(state.board));
      if (state.tab === 'hot') qs.push('tab=hot');
      if (qs.length) url += '?' + qs.join('&');
      if (window.history && typeof window.history.replaceState === 'function') {
        try { window.history.replaceState(null, '', url); } catch (e) { /* 忽略 */ }
      }
    }

    each(cards(), function (card) {
      card.addEventListener('click', function (event) {
        if (typeof event.preventDefault === 'function') event.preventDefault();
        var id = card.getAttribute('data-board');
        state.board = (state.board === id) ? null : id;
        syncUrl();
        render();
      });
    });
    each(tabs(), function (tab) {
      tab.addEventListener('click', function (event) {
        if (typeof event.preventDefault === 'function') event.preventDefault();
        state.tab = tab.getAttribute('data-tab');
        syncUrl();
        render();
      });
    });

    function setBox(open) {
      if (!box) return;
      box.hidden = !open;
      if (openBtn) openBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open && titleIn && typeof titleIn.focus === 'function') titleIn.focus();
    }
    if (openBtn) {
      openBtn.addEventListener('click', function (event) {
        if (typeof event.preventDefault === 'function') event.preventDefault();
        setBox(!(box && !box.hidden));
      });
    }
    if (cancelBtn) {
      cancelBtn.addEventListener('click', function (event) {
        if (typeof event.preventDefault === 'function') event.preventDefault();
        setBox(false);
      });
    }
    if (submitBtn) {
      submitBtn.addEventListener('click', function (event) {
        if (typeof event.preventDefault === 'function') event.preventDefault();
        var title = (titleIn && titleIn.value ? titleIn.value : '').trim();
        var body = (bodyIn && bodyIn.value ? bodyIn.value : '').trim();
        var board = (boardIn && boardIn.value) || BOARDS[0].id;
        if (!title) { toast('先写个标题'); if (titleIn && titleIn.focus) titleIn.focus(); return; }
        if (!body) { toast('正文还空着'); if (bodyIn && bodyIn.focus) bodyIn.focus(); return; }

        /* M5：接了后台就发到服务器（未登录先去登录）—— 这样换个浏览器也看得到自己发的帖 */
        if (REMOTE && api()) {
          needLogin(function () {
            submitBtn.setAttribute('aria-busy', 'true');
            api().post('/forum/posts', { board: board, title: title, body: body }).then(function () {
              submitBtn.removeAttribute('aria-busy');
              if (titleIn) titleIn.value = '';
              if (bodyIn) bodyIn.value = '';
              setBox(false);
              toast('已发布');
              return pullRemote();
            }).then(function () {
              state.tab = 'latest';
              state.board = null;
              syncUrl();
              render();
            }, function (err) {
              submitBtn.removeAttribute('aria-busy');
              toast((err && err.message) || '发布失败，再试一次');
            });
          });
          return;
        }

        var post = {
          id: 'p' + Date.now().toString(36),
          board: board, title: title, body: body,
          author: ME, at: Date.now(), views: 0, floors: []
        };
        db.posts.unshift(post);
        save(db);
        if (titleIn) titleIn.value = '';
        if (bodyIn) bodyIn.value = '';
        state.tab = 'latest';
        state.board = null;
        syncUrl();
        setBox(false);
        render();
        toast('已发布，去帖子里等回复吧');
      });
    }

    if (query('compose')) setBox(true);      // 支持 forum.html?compose=1 直接展开
    render();
    return true;
  }

  /* ---------------- 帖子详情 ---------------- */
  function initThread() {
    var bodyEl = byId('thread-body');
    if (!bodyEl) return false;

    var db = load();
    var id = query('id');
    var post = null;
    for (var i = 0; i < db.posts.length; i++) if (db.posts[i].id === id) post = db.posts[i];
    if (!post) post = db.posts[0];               // 直接打开详情页时的兜底

    var titleEl = byId('thread-title');
    var tagEl = byId('thread-tag');
    var metaEl = byId('thread-meta');
    var viewsEl = byId('thread-views');
    var floorsEl = byId('thread-floors');
    var boardEl = byId('thread-board');
    var replyBox = byId('reply-text');
    var submitBtn = byId('reply-submit');

    post.views = (post.views || 0) + 1;          // 记一次浏览
    save(db);

    if (titleEl) document.title = post.title + ' · 悟空数学';
    if (titleEl) titleEl.textContent = post.title;
    if (tagEl) tagEl.textContent = boardOf(post.board).name;
    if (boardEl) boardEl.textContent = boardOf(post.board).name;
    /* 占位文字里的名字要跟着这一帖的作者走（原来是写死的"陈知远"） */
    if (replyBox) replyBox.placeholder = '回复' + post.author + '的帖子。公式用 $…$ 包起来，例如 $k > 0$';

    var editing = false;      /* 编辑模式开关 */
    var draft = '';           /* 编辑中的草稿，取消就丢掉 */
    /** 正文区：平时渲染富文本，编辑态换成一个 textarea + 保存/取消 */
    function renderBody() {
      if (!bodyEl) return;
      if (!editing) { bodyEl.innerHTML = rich(post.body); return; }
      bodyEl.innerHTML =
        '<textarea id="post-edit" class="thread__editor" rows="8"></textarea>' +
        '<div class="thread__editacts">' +
          '<button type="button" class="thread__save" data-edit="save">保存</button>' +
          '<button type="button" class="thread__cancel" data-edit="cancel">取消</button>' +
        '</div>';
      var ta = byId('post-edit');
      if (ta) ta.value = draft;
    }

    function metaHtml() {
      var s = '<a class="thread__author" href="user.html">' + esc(post.author) + '</a> · <b>' +
        post.floors.length + '</b> 条回复 · ' + timeAgo(post.at);
      /* 作者本人能改删自己的帖；未登录/不是作者的帖不显示这两个按钮 */
      if (post.mine && !editing) {
        s += ' · <a class="thread__act" href="#" data-act="edit">改</a>';
        s += ' · <a class="thread__act thread__act--danger" href="#" data-act="delete">删</a>';
      }
      if (post.pinned) s += ' · <span class="thread__mark">置顶</span>';
      if (post.good) s += ' · <span class="thread__mark thread__mark--good">精</span>';
      return s;
    }
    function floorHtml(f, i) {
      return '<article class="floor">' +
        '<div class="floor__no">#' + (i + 2) + '</div>' +
        '<div class="floor__body">' +
          '<div class="floor__head">' +
            '<span class="floor__who">' + esc(f.who) + '</span>' +
            (f.role ? '<span class="floor__role">' + esc(f.role) + '</span>' : '') +
            '<span class="floor__time">' + timeAgo(f.at) + '</span>' +
          '</div>' +
          rich(f.text, 'floor__text') +
          '<div class="floor__acts">' +
            '<a class="floor__act" href="#" data-act="reply" data-who="' + esc(f.who) + '">回复</a>' +
            '<a class="floor__act" href="#" data-act="quote" data-who="' + esc(f.who) + '">引用</a>' +
          '</div>' +
        '</div>' +
      '</article>';
    }
    function render() {
      if (metaEl) metaEl.innerHTML = metaHtml();
      if (viewsEl) viewsEl.innerHTML = '浏览 <b>' + (post.views || 0) + '</b>';
      renderBody();
      if (floorsEl) {
        floorsEl.innerHTML = post.floors.length
          ? post.floors.map(floorHtml).join('')
          : '<p class="empty">还没有人回复，来说说你的思路。</p>';
      }
      icons();
    }
    render();

    /** M5：从服务器重取这一帖（发了回复、或进来时要先拿到真楼层）。
        浏览数不要自己再加 —— 服务端在 GET 详情时已经 +1 了。 */
    function reloadThread() {
      if (!REMOTE || !api()) { return Promise.resolve(); }
      return api().get('/forum/posts/' + encodeURIComponent(id)).then(function (d) {
        post.views = d.views;
        post.body = d.body || '';
        post.floors = (d.replies || []).map(toLocalFloor);
        post.mine = d.mine === true;
        post.pinned = d.pinned === true;
        post.good = d.good === true;
        /* 正文靠 render() 里的 renderBody() 落笔 —— 列表接口不返回正文，
           所以要等这一趟才有内容 */
        render();
      }, function () { /* 取不到就保持原样，别把已经渲染好的页面弄没了 */ });
    }
    if (REMOTE) { reloadThread(); }

    if (floorsEl) {
      floorsEl.addEventListener('click', function (event) {
        var node = event.target && event.target.closest ? event.target.closest('[data-act]') : null;
        if (!node || !replyBox) return;
        if (typeof event.preventDefault === 'function') event.preventDefault();
        var who = node.getAttribute('data-who') || '';
        var act = node.getAttribute('data-act');
        var cur = replyBox.value || '';
        if (act === 'quote') {
          var src = post.floors.filter(function (f) { return f.who === who; })[0];
          replyBox.value = (cur ? cur + '\n\n' : '') + '> ' + who + '：' +
            String(src ? src.text : '').split('\n')[0];
        } else if (cur.indexOf('@' + who) < 0) {
          replyBox.value = '@' + who + ' ' + cur;
        }
        if (typeof replyBox.focus === 'function') replyBox.focus();
      });
    }

    if (submitBtn) {
      submitBtn.addEventListener('click', function (event) {
        if (typeof event.preventDefault === 'function') event.preventDefault();
        var text = (replyBox && replyBox.value ? replyBox.value : '').trim();
        if (!text) { toast('先写点内容再发表'); if (replyBox && replyBox.focus) replyBox.focus(); return; }

        /* M5：接了后台就发到服务器（未登录先去登录） */
        if (REMOTE && api()) {
          needLogin(function () {
            submitBtn.setAttribute('aria-busy', 'true');
            api().post('/forum/posts/' + post.id + '/replies', { text: text }).then(function () {
              submitBtn.removeAttribute('aria-busy');
              if (replyBox) replyBox.value = '';
              toast('回复已发表');
              return reloadThread();
            }, function (err) {
              submitBtn.removeAttribute('aria-busy');
              toast((err && err.message) || '回复失败，再试一次');
            });
          });
          return;
        }

        post.floors.push({ who: ME, at: Date.now(), text: text });
        save(db);
        if (replyBox) replyBox.value = '';
        render();
        toast('回复已发表');
      });
    }

    /* ---- 作者改/删自己的帖（M5）---- */
    if (metaEl) {
      metaEl.addEventListener('click', function (event) {
        var node = event.target && event.target.closest ? event.target.closest('[data-act]') : null;
        if (!node) return;
        var act = node.getAttribute('data-act');
        if (act !== 'edit' && act !== 'delete') return;
        if (typeof event.preventDefault === 'function') event.preventDefault();
        /* 改删都落在服务端，没连服务器就只能提示一句 */
        if (!REMOTE || !api()) { toast('改/删帖子要连上服务器才行'); return; }

        if (act === 'edit') {
          if (editing) return;
          editing = true;
          draft = post.body || '';
          render();
          var ta = byId('post-edit');
          if (ta && ta.focus) ta.focus();
          return;
        }
        if (window.confirm && !window.confirm('删掉这一帖？回复会一起删，不能恢复。')) return;
        api().del('/forum/posts/' + encodeURIComponent(post.id)).then(function () {
          toast('已删除');
          window.location.href = 'forum.html';
        }, function (err) {
          toast((err && err.message) || '删除失败，再试一次');
        });
      });
    }

    /* 编辑态里的保存/取消 */
    if (bodyEl) {
      bodyEl.addEventListener('click', function (event) {
        var node = event.target && event.target.closest ? event.target.closest('[data-edit]') : null;
        if (!node) return;
        if (typeof event.preventDefault === 'function') event.preventDefault();
        var act = node.getAttribute('data-edit');
        if (act === 'cancel') { editing = false; render(); return; }
        if (act !== 'save') return;

        var ta = byId('post-edit');
        var text = (ta && ta.value ? ta.value : '').trim();
        if (text.length < 2) { toast('正文太短了'); return; }
        if (!REMOTE || !api()) { editing = false; post.body = text; save(db); render(); toast('已保存'); return; }

        api().patch('/forum/posts/' + encodeURIComponent(post.id), { body: text }).then(function () {
          editing = false;
          post.body = text;
          render();
          toast('已保存');
        }, function (err) {
          toast((err && err.message) || '保存失败，再试一次');
        });
      });
    }
    return true;
  }

  /* ---------------- 专题页（board.html） ---------------- */
  function initBoard() {
    var listEl = byId('board-list');
    if (!listEl) return false;

    var db = load();
    var boardId = query('board') || 'help';        // 直接打开专题页时的默认专题
    var info = boardOf(boardId);
    var state = { sort: query('sort') === 'post' || query('sort') === 'replies' ? query('sort') : 'reply' };

    var crumbEl = byId('board-crumb-name');
    var titleEl = byId('board-title');
    var descEl = byId('board-desc');
    var statsEl = byId('board-stats');
    if (crumbEl) crumbEl.textContent = info.name;
    if (titleEl) titleEl.textContent = info.name;
    if (descEl) descEl.textContent = info.note;
    if (statsEl) statsEl.textContent = '';
    document.title = info.name + ' · 悟空数学';

    function sorts() { return document.querySelectorAll('[data-sort]'); }
    function list() {
      var posts = db.posts.filter(function (p) { return p.board === boardId; });
      posts.sort(state.sort === 'post'
        ? function (a, b) { return b.at - a.at; }
        : state.sort === 'replies'
          ? function (a, b) { return b.floors.length - a.floors.length || b.at - a.at; }
          : function (a, b) { return lastAt(b) - lastAt(a); });
      return posts;
    }
    function rowHtml(p) {
      return '<a class="trow" href="forum-thread.html?id=' + encodeURIComponent(p.id) + '">' +
        '<div class="trow__body">' +
          '<p class="trow__title">' + pinTag(p) + inline(p.title) + '</p>' +
          '<div class="trow__meta">' +
            '<span class="trow__tag">' + esc(info.name) + '</span>' +
            '<span class="trow__info">' + esc(p.author) + ' · <b>' + p.floors.length +
              '</b> 条回复 · ' + timeAgo(lastAt(p)) + '</span>' +
          '</div>' +
        '</div>' +
        '<i data-lucide="chevron-right" class="trow__arrow"></i>' +
      '</a>';
    }
    function render() {
      var posts = list();
      if (statsEl) {
        statsEl.textContent = posts.length + ' 主题 · ' +
          posts.reduce(function (n, p) { return n + p.floors.length; }, 0) + ' 条回复';
      }
      each(sorts(), function (node) {
        if (node.getAttribute('data-sort') === state.sort) node.setAttribute('data-active', 'true');
        else node.removeAttribute('data-active');
      });
      listEl.innerHTML = posts.length
        ? posts.map(rowHtml).join('')
        : '<p class="empty">这个专题还没有帖子，去论坛发一条。</p>';
      icons();
    }
    each(sorts(), function (node) {
      node.addEventListener('click', function (event) {
        if (typeof event.preventDefault === 'function') event.preventDefault();
        state.sort = node.getAttribute('data-sort');
        render();
      });
    });
    render();
    return true;
  }

  /* ---------------- 我的帖子（my-posts.html） ---------------- */
  function initMine() {
    var postsEl = byId('mine-posts');
    var repliesEl = byId('mine-replies');
    if (!postsEl && !repliesEl) return false;

    var db = load();
    var mine = db.posts.filter(function (p) { return p.mine === true || p.author === ME; });
    mine.sort(function (a, b) { return b.at - a.at; });
    var replies = [];
    db.posts.forEach(function (p) {
      p.floors.forEach(function (f) { if (f.who === ME) replies.push({ post: p, floor: f }); });
    });
    replies.sort(function (a, b) { return b.floor.at - a.floor.at; });

    var descEl = byId('mine-desc');
    var postsCount = byId('mine-count-posts');
    var repliesCount = byId('mine-count-replies');
    var postsTab = byId('mine-tab-posts');
    var repliesTab = byId('mine-tab-replies');

    function paint() {
    if (descEl) {
      descEl.innerHTML = '共 <b class="num">' + mine.length + '</b> 篇帖子与 <b class="num">' +
        replies.length + '</b> 条回复。';
    }
    if (postsCount) postsCount.textContent = String(mine.length);
    if (repliesCount) repliesCount.textContent = String(replies.length);

    if (postsEl) {
      postsEl.innerHTML = mine.length
        ? mine.map(function (p) {
          return '<a class="prow" href="forum-thread.html?id=' + encodeURIComponent(p.id) + '">' +
            '<div class="prow__body">' +
              '<p class="prow__title">' + pinTag(p) + inline(p.title) + '</p>' +
              '<div class="prow__meta">' +
                '<span class="prow__tag">' + esc(boardOf(p.board).name) + '</span>' +
                '<span class="prow__info"><b>' + p.floors.length + '</b> 条回复 · ' + timeAgo(p.at) + '</span>' +
              '</div>' +
            '</div>' +
            '<i class="prow__arrow" data-lucide="chevron-right"></i>' +
          '</a>';
        }).join('')
        : '<p class="empty">还没有发过帖子，去论坛发一条。</p>';
    }
    if (repliesEl) {
      repliesEl.innerHTML = replies.length
        ? replies.map(function (item) {
          return '<a class="prow" href="forum-thread.html?id=' + encodeURIComponent(item.post.id) + '">' +
            '<div class="prow__body">' +
              '<p class="prow__title">' + inline(item.post.title) + '</p>' +
              '<p class="prow__quote">' + inline(item.floor.text.split('\n')[0]) + '</p>' +
              '<div class="prow__meta">' +
                '<span class="prow__tag">' + esc(boardOf(item.post.board).name) + '</span>' +
                '<span class="prow__info">' + timeAgo(item.floor.at) + '</span>' +
              '</div>' +
            '</div>' +
            '<i class="prow__arrow" data-lucide="chevron-right"></i>' +
          '</a>';
        }).join('')
        : '<p class="empty">还没有回复过别人的帖子。</p>';
    }
    icons();
    }

    /* M5：接了后台就用服务器的"我的帖子 / 我的回复" —— 列表接口不带楼层内容，
       所以回复那半边必须另取一次，不能靠占位。 */
    if (REMOTE && api()) {
      api().get('/forum/mine').then(function (d) {
        mine = (d.posts.items || []).map(function (p) { return toLocalPost(p); });
        replies = (d.replies.items || []).map(function (r) {
          var at = Date.parse(r.at);
          return {
            post: { id: String(r.postId), title: r.postTitle, board: r.boardCode },
            floor: { at: isNaN(at) ? Date.now() : at, text: r.text },
          };
        });
        paint();
      }, function () { /* 取不到就保持本机那份 */ });
    }

    paint();

    function show(which) {
      if (postsEl) postsEl.hidden = which !== 'posts';
      if (repliesEl) repliesEl.hidden = which !== 'replies';
      if (postsTab) {
        if (which === 'posts') postsTab.setAttribute('data-active', 'true');
        else postsTab.removeAttribute('data-active');
      }
      if (repliesTab) {
        if (which === 'replies') repliesTab.setAttribute('data-active', 'true');
        else repliesTab.removeAttribute('data-active');
      }
    }
    if (postsTab) {
      postsTab.addEventListener('click', function (event) {
        if (typeof event.preventDefault === 'function') event.preventDefault();
        show('posts');
      });
    }
    if (repliesTab) {
      repliesTab.addEventListener('click', function (event) {
        if (typeof event.preventDefault === 'function') event.preventDefault();
        show('replies');
      });
    }
    show(query('tab') === 'replies' ? 'replies' : 'posts');
    return true;
  }

  /** 页面启动：能连后台就先把手头的数据换成后台那份，再走原来那套渲染。
      连不上就照老路读本机 localStorage —— 论坛别看不了（未登录也能看帖，这是用户定的）。 */
  function initLocal() {
    return initHome() || initThread() || initBoard() || initMine();
  }

  function init() {
    if (!api()) { return initLocal(); }
    /* 拉得到用后台那份、拉不到就用本机那份 —— 两条路最后都走同一套渲染 */
    return pullRemote().then(initLocal);
  }

  window.__FORUM__ = {
    KEY: KEY, BOARDS: BOARDS, ME: ME,
    seed: seed, load: load, save: save,
    esc: esc, inline: inline, rich: rich, timeAgo: timeAgo, heat: heat, lastAt: lastAt,
    boardOf: boardOf, query: query,
    initHome: initHome, initThread: initThread, initBoard: initBoard, initMine: initMine, init: init
  };

  init();
})();
