/* ==========================================================================
   时间轴 · 数轴 (timeline.js)
   --------------------------------------------------------------------------
   一屏一根**完整的**数轴。可以拖、可以一直放大 —— 视图模型与白板同源
   （世界坐标 + zoomAt + fitContent + 自动疏密的网格），所以"拖动 / 缩放 /
   适配 / 网格"这四件事的手感与白板一致（见 whiteboard.js 的同一组函数）。

   轴上的刻度来自图谱（window.MATH_TREE），不是设计稿里编的那几组数：

     学段 → 册 / 板块 → 章 → 节 → 知识点

   把每个"知识点"摊成一格；一个"节"底下没有细分知识点时，节自己就是一格。
   缩小时只剩学段 / 册这种大刻度，放大时章、节、知识点一层层自然出来 ——
   这就是"刻度随缩放细分"，也是"永远是一条完整的数轴、缩小时只显示重要的部分"。

   本文件只负责视图与刻度：
     · 颜色一律从 tokens.css 读（不写死值），所以亮 / 中 / 暗三套配色与七个
       高亮色自动生效；
     · 字号乘 --math-fs（显示设置里的"大 / 特大"直接管到画布里的字）。
   ========================================================================== */

(function () {
  'use strict';

  var main = document.querySelector('[data-tk]');
  if (!main) { return; }

  var wrap = main.querySelector('[data-tk-wrap]');
  var canvas = main.querySelector('[data-tk-canvas]');
  var ctx = canvas && canvas.getContext ? canvas.getContext('2d') : null;
  if (!wrap || !canvas || !ctx) { return; }

  var whoEl = main.querySelector('[data-tk-who]');
  var elNow = main.querySelector('[data-tk-now]');
  var elProgress = main.querySelector('[data-tk-progress]');
  var elZoom = main.querySelector('[data-tk-zoom]');
  var dock = main.querySelector('[data-tk-dock]');
  var pop = main.querySelector('#tk-pop');
  var popBtn = dock.querySelector('#tk-pop-toggle');
  var gridBox = main.querySelector('#tk-grids');
  var barBox = main.querySelector('#tk-bar-levels');
  /* 数轴整体大小（「网格与尺寸」浮层里那根滑块）—— 与横向缩放是两件事 */
  var axisRange = main.querySelector('[data-tk-axis-zoom]');
  var axisValue = main.querySelector('[data-tk-axis-zoom-value]');
  var btnGrid = dock.querySelector('#tk-grid');
  var btnMastery = dock.querySelector('#tk-mastery');
  var btnPlan = dock.querySelector('#tk-plan');
  var btnOut = dock.querySelector('#tk-zoom-out');
  var btnIn = dock.querySelector('#tk-zoom-in');
  var btnFit = dock.querySelector('#tk-zoom-fit');
  var btnHelp = dock.querySelector('#tk-help');
  var help = main.querySelector('[data-tk-help]');
  var hoverEl = main.querySelector('[data-tk-hover]');
  var cardEl = main.querySelector('[data-tk-card]');
  var cardHead = main.querySelector('[data-tk-card-head]');
  var cardName = main.querySelector('[data-tk-card-name]');
  var cardSubject = main.querySelector('[data-tk-card-subject]');
  var cardBox = main.querySelector('[data-tk-card-body]');
  var btnCardClose = main.querySelector('[data-tk-card-close]');
  /* 图例条（不是面板）：工具条正上方那一行 —— 七档掌握度 + 两种节点 + 四类标记 */
  var legendEl = main.querySelector('[data-tk-legend-bar]');
  var legendStates = main.querySelector('[data-tk-legend-states]');
  var legendMarks = main.querySelector('[data-tk-legend-marks]');
  var btnLegend = dock.querySelector('#tk-legend');
  /* 右侧控制栏（用户第 14 条）：筛选卡 + 阶段浮层 + 两个显示开关 */
  var side = main.querySelector('[data-tk-side]');
  var leftEl = main.querySelector('.tk-left');
  var filtersEl = main.querySelector('[data-tk-filters]');
  var filtersHead = main.querySelector('[data-tk-filters-head]');
  var filtersSubject = main.querySelector('[data-tk-filters-subject]');
  var filterStatusBox = main.querySelector('[data-tk-filter-status]');
  var filterDiffBox = main.querySelector('[data-tk-filter-diff]');
  var filterMarkBox = main.querySelector('[data-tk-filter-mark]');
  var btnFilterClear = main.querySelector('[data-tk-filter-clear]');
  var btnFilter = side ? side.querySelector('#tk-filter') : null;
  var btnLevels = side ? side.querySelector('#tk-levels') : null;
  var btnReadout = side ? side.querySelector('#tk-readout-toggle') : null;
  /* 阶段那一排胶囊住在**筛选卡**里（2026-09-30 用户："阶段可以整合到筛选里"）——
     原来那颗独立的「阶段」按钮与它那个浮层一起撤了：这里不再有按钮变量、也不再有浮层元素。 */
  var stageChips = main.querySelector('[data-tk-stage-chips]');
  var btnFiltersClose = main.querySelector('[data-tk-filters-close]');
  /* 时间段对比（第 13 条）与方阵（第 18 条）：两张同样式样的可拖面板 */
  var termsEl = main.querySelector('[data-tk-terms]');
  var termsHead = main.querySelector('[data-tk-terms-head]');
  var termsSubject = main.querySelector('[data-tk-terms-subject]');
  var termsBody = main.querySelector('[data-tk-terms-body]');
  var btnTerms = side ? side.querySelector('#tk-terms') : null;
  var btnTermsClose = main.querySelector('[data-tk-terms-close]');
  var matrixEl = main.querySelector('[data-tk-matrix]');
  var matrixHead = main.querySelector('[data-tk-matrix-head]');
  var matrixSubject = main.querySelector('[data-tk-matrix-subject]');
  var matrixBody = main.querySelector('[data-tk-matrix-body]');
  var btnMatrix = side ? side.querySelector('#tk-matrix') : null;
  var btnMatrixClose = main.querySelector('[data-tk-matrix-close]');
  /* 缩略条（第 9 条）：住在工具条正上方那一列里，不属于可拖浮层 */
  var miniEl = main.querySelector('[data-tk-mini]');
  var miniStrip = main.querySelector('[data-tk-mini-strip]');
  var miniTrack = main.querySelector('[data-tk-mini-track]');
  var miniWin = main.querySelector('[data-tk-mini-win]');
  var miniRangeEl = main.querySelector('[data-tk-mini-range]');

  /* ------------------------------------------------------------------ *
   * 主题 / 字体：全部来自 CSS 令牌
   *   为什么不写死一组颜色：这一页要跟着"亮 / 中 / 暗"与七个高亮色走，
   *   写死一套就等于把主题锁死了（verify_display 也是按这条查的）。
   *   拿不到令牌时浏览器会给一个合法颜色（通常是黑），不会画崩。
   * ------------------------------------------------------------------ */

  var probe = null;
  function readColor(name) {
    if (!probe) {
      probe = document.createElement('span');
      probe.setAttribute('aria-hidden', 'true');
      probe.style.cssText = 'position:absolute;left:-9999px;top:0;width:0;height:0';
      document.body.appendChild(probe);
    }
    probe.style.color = 'var(' + name + ')';
    try { return window.getComputedStyle(probe).color || 'currentColor'; } catch (err) { return 'currentColor'; }
  }
  function readVar(name, fallback) {
    var v = '';
    try { v = window.getComputedStyle(document.documentElement).getPropertyValue(name); } catch (err) { v = ''; }
    v = (v || '').trim();
    return v || fallback;
  }

  var C = {};
  var FONT = 'sans-serif';
  var FS = 1;

  function readTheme() {
    C.background = readColor('--math-background');
    C.line = readColor('--math-line');
    C.lineStrong = readColor('--math-line-strong');
    C.ink = readColor('--math-foreground');
    C.ink2 = readColor('--math-ink-2');
    C.ink3 = readColor('--math-ink-3');
    C.ink4 = readColor('--math-ink-4');
    C.primary = readColor('--math-primary');
    C.surface = readColor('--math-surface');
    FONT = readVar('--math-font-sans', 'sans-serif');
    FS = parseFloat(readVar('--math-fs', '1')) || 1;
    STATUS_COLOR = {};      /* 换主题要把状态色重新解一遍（缓存里的旧色不能留） */
    C.stage = {};           /* 学段色同理：换主题 / 换高亮色都得重解 */
    Object.keys(STAGE_TOKEN).forEach(function (k) {
      C.stage[k] = readColor(STAGE_TOKEN[k]) || C.ink4;
    });
  }

  /* 四个学段各一支标识色（值是 tokens.css 里的令牌名）—— "用不同的颜色来代表不同的阶段" */
  var STAGE_TOKEN = {
    primary: '--math-stage-primary',
    junior: '--math-stage-junior',
    senior: '--math-stage-senior',
    olympiad: '--math-stage-olympiad'
  };
  function stageColor(stage) {
    return (C.stage && C.stage[stage]) || C.ink4 || C.line;
  }

  /* 学习状态 → 画布上的颜色：令牌名由 timeline-data.js 给，值从 tokens.css 解出来 */
  var STATUS_COLOR = {};
  function statusColor(name) {
    if (!STATUS_COLOR[name]) {
      var token = (window.WK_LEARNING && window.WK_LEARNING.tokenOf) ? window.WK_LEARNING.tokenOf(name) : '--math-bar-idle';
      STATUS_COLOR[name] = readColor(token);
    }
    return STATUS_COLOR[name];
  }

  /* 画布里的字号是**世界字号**：要除以当前缩放，屏幕上才是那个像素大小 ——
     于是放大缩小只改"刻度出现在哪一级"，不改字的大小。 */
  function worldFont(weight, size) {
    return weight + ' ' + (size * FS * state.axis / view.scale).toFixed(3) + 'px ' + FONT;
  }

  /* ------------------------------------------------------------------ *
   * 1. 数据：把图谱摊成一维的刻度序列
   * ------------------------------------------------------------------ */

  /* 摊平图谱（buildAxis）与它那两个帮手（STAGE_CN / gradeOf / nameAt）搬到了共享模块
     `assets/js/timeline-axis.js` —— 2D 与 3D 用的必须是**同一根轴**，规则只留一份。
     这里只保留别名，下面照旧 `window.WK_AXIS.build()`。 */

  /* 摊平图谱的规则住在共享模块 `assets/js/timeline-axis.js`（2D 与 3D 共用**同一根轴**）。 */
  var STAGE_CN = window.WK_AXIS.stageCN;
  var nameAt = window.WK_AXIS.nameAt;
  var axis = window.WK_AXIS.build();
  var ITEMS = axis.items;
  var SEGS = axis.segs;
  var N = ITEMS.length;

  /* ------------------------------------------------------------------ *
   * 1b. 学习记录（演示数据 · 见 timeline-data.js）
   *   每个格子挂上自己的记录；每一"段"（学段 / 册 / 章 / 节）再汇总一份 ——
   *   轴上那些圆点就是按这一份上色的：点看一眼就知道这一段学得怎么样。
   * ------------------------------------------------------------------ */

  /* 这一轴是谁的（用户第 11 条）：
     未登录 → 演示学生（可切换，默认第一个）；登录了 → 自己的。
     身份从 ide-shell.js 的会话来：`current()` 未登录返回 null。 */
  var WHO = pickViewer();
  var LEARN = (window.WK_LEARNING && window.WK_LEARNING.build)
    ? window.WK_LEARNING.build(ITEMS, learnOptions()) : null;
  var SUMMARY = LEARN ? window.WK_LEARNING.summary(LEARN) : null;

  function viewerList() {
    return (window.WK_LEARNING && window.WK_LEARNING.students) || [];
  }

  function pickViewer() {
    var u = (window.WK_SHELL && window.WK_SHELL.current) ? window.WK_SHELL.current() : null;
    if (u && u.name) {
      return { name: u.name, grade: u.grade || '', short: u.short || u.name.charAt(0), mine: true, student: -1 };
    }
    var s = viewerList()[0] || { name: '演示学生', grade: '', short: '演' };
    return { name: s.name, grade: s.grade || '', short: s.short || s.name.charAt(0), mine: false, student: 0 };
  }

  /* 生成参数：登录了按账号在本机推一份（没有后端），未登录用那个演示学生的写死参数 */
  function learnOptions() {
    if (WHO.mine) {
      return (window.WK_LEARNING && window.WK_LEARNING.forAccount)
        ? window.WK_LEARNING.forAccount(WHO) : {};
    }
    var s = viewerList()[WHO.student] || {};
    return { seed: s.seed, progress: s.progress };
  }

  /* ------------------------------------------------------------------ *
   * 1c. 学员自己贴的标记（用户 2026-09-30 定的四个口径）
   *   · **在哪里打** —— 在知识点卡片里打（点一格弹出卡片，卡片里那排开关）；
   *   · **能打几个** —— 可以同时挂几个（"既难点又待复习"是常态，不是二选一）；
   *   · **"前置未满足"** —— 系统算的，学员改不了（见 timeline-data.js 的 MARKS.own）；
   *   · **怎么撤销** —— 再点一次同一颗就是取消。
   *
   * 存法：演示数据是**确定性生成**的，学员改过的那几格单独记一份"覆盖表"在本机
   * （`wkmath.timeline.marks.v1`），键是知识点编号（MATH-KP-0234 那种）而不是格子序号 ——
   * 序号会随视图 / 数据重排而漂，编号是跟着那**一个知识点**走的。
   * 表里只放"学员动过手"的格子；没动过的那些仍旧完全由演示规则说了算。
   * ------------------------------------------------------------------ */
  var MARKS_KEY = 'wkmath.timeline.marks.v1';
  var markEdits = loadMarkEdits();

  /* 学员能改的只有 `own` 那三类；先把表里认不出来的值剔掉（手改 localStorage / 旧版本留下的） */
  function ownMarkKeys() {
    var list = (window.WK_LEARNING && window.WK_LEARNING.ownMarks)
      ? window.WK_LEARNING.ownMarks() : [];
    return list.map(function (m) { return m.key; });
  }

  function loadMarkEdits() {
    var raw = null;
    try { raw = window.localStorage.getItem(MARKS_KEY); } catch (err) { raw = null; }
    var obj = null;
    try { obj = raw ? JSON.parse(raw) : null; } catch (err) { obj = null; }
    if (!obj || typeof obj !== 'object') { return {}; }
    var allow = ownMarkKeys();
    var out = {};
    Object.keys(obj).forEach(function (id) {
      var v = obj[id];
      if (!v || typeof v.length !== 'number') { return; }
      var keep = [];
      for (var i = 0; i < v.length; i += 1) {
        if (allow.indexOf(v[i]) >= 0 && keep.indexOf(v[i]) < 0) { keep.push(v[i]); }
      }
      out[id] = keep;
    });
    return out;
  }

  function saveMarkEdits() {
    try { window.localStorage.setItem(MARKS_KEY, JSON.stringify(markEdits)); }
    catch (err) { /* 存不了也照样当场生效，只是刷新后回到演示规则 */ }
  }

  /* 把覆盖表盖到这一份记录上（每次重建记录都要再盖一次：换学生 / 换账号时 LEARN 会重算） */
  function applyMarkEdits() {
    if (!LEARN) { return; }
    Object.keys(markEdits).forEach(function (id) {
      var parts = id.split('-');
      var n = parseInt(parts[parts.length - 1], 10);
      if (!isFinite(n) || n < 1 || n > LEARN.length) { return; }
      LEARN[n - 1].marks = markEdits[id].slice();
    });
  }

  /* 这一格挂着的**全部**标记（学员自评那几类 + 系统算的"前置未满足"）——
     画布、筛选、卡片三处都从这一个口子拿，别各自去摸 marks / blocked 两个字段。 */
  function marksOf(rec) {
    if (!rec) { return []; }
    var out = (rec.marks || []).slice();
    if (rec.blocked) { out.push('block'); }
    return out;
  }

  /* 点一下卡片里那颗标记：没打就贴上、打了就摘掉（再点一次 = 撤销），然后立刻落盘 */
  function toggleMark(index, key) {
    var it = ITEMS[index];
    if (!it || !it.rec) { return null; }
    if (ownMarkKeys().indexOf(key) < 0) { return it.rec.marks; }   /* 系统那颗不许改 */
    var cur = (it.rec.marks || []).slice();
    var at = cur.indexOf(key);
    if (at >= 0) { cur.splice(at, 1); } else { cur.push(key); }
    /* 按 MARKS 的固定顺序排一下：不然"先点难点再点重点"和反过来在轴上画出来的次序不一样 */
    var order = ownMarkKeys();
    cur.sort(function (a, b) { return order.indexOf(a) - order.indexOf(b); });
    it.rec.marks = cur;
    markEdits[idOf(index)] = cur.slice();
    saveMarkEdits();
    return cur;
  }

  /* 把一份学习记录接到轴上：每格挂自己的，每一"段"再汇总一份（轴上的点按这份上色） */
  function applyLearn() {
    if (!LEARN) { return; }
    ITEMS.forEach(function (it, i) { it.rec = LEARN[i]; });
    SEGS.forEach(function (list) {
      list.forEach(function (seg) {
        seg.rec = window.WK_LEARNING.rollup(LEARN, seg.start, seg.end);
      });
    });
    applyMarkEdits();
  }

  applyLearn();

  /* ------------------------------------------------------------------ *
   * 2. 视图（与白板同一套）
   * ------------------------------------------------------------------ */

  var view = { scale: 1, x: 0, y: 0, w: 800, h: 520, dpr: 1, fit: 1 };
  var MIN_SCALE = 0.05;
  var MAX_SCALE = 400;
  var FRESH = true;             // 首次进场要自动适配一次
  var LABEL_BOTTOM = 166;       // 轴下方的标签区（屏幕像素）：六级文字各自可能占几行，适配时给它留位
                                // （最下面那一行是"年级"的 [132, 146]；学段名与区间 2026-09-30 已撤掉，
                                //   所以比原来的 196 收回来一档）

  /* 彩色条的三档高度（屏幕像素，掌握度 100 时的高度）。
     为什么高度用**屏幕像素**而不是世界单位：世界高度会跟着缩放一起长，
     放大到十倍，一根条就有两千多像素高 —— 屏幕上只剩条子的一个下角，
     那还看什么掌握度分布。钉在屏幕上之后，放大只改"一格多宽"，
     整条轴的剖面永远是一个舒服的高度，"低/中/高"这个档也就才有意义。 */
  var BAR_LEVELS = [
    { key: 'low',  label: '低', screen: 96 },
    { key: 'mid',  label: '中', screen: 150 },
    { key: 'high', label: '高', screen: 224 }
  ];

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
  /* 屏幕像素 → 世界单位。
     乘上 `state.axis` 的那一层是**数轴整体的放大倍数**（用户 2026-09-30：
     "数轴它可以放大……但数轴本身它大不了……那字都还比较小"）：
     横向"能看多少格"是缩放（view.scale）管的，而轴本身（线宽、点、刻度、文字、彩条）
     由它统一放大缩小 —— 两件事分开，才既能"看得更细"又能"看得更大"。 */
  function px(v) { return (v * state.axis) / view.scale; }

  /* 缩放：横向锚在鼠标那一列，**竖向不缩**。
     为什么不照白板那样连竖向一起缩：白板的板面是二维的，东西铺满整屏，缩了还看得见；
     数轴是一维的 —— 轴就是世界 y=0 那一条线，竖向跟着缩，放大几次它就飘出屏幕，
     屏幕上只剩一片空白（真机上第一次试就撞到：2400% 时整屏空的）。
     锚在轴上之后：放大时轴不动、彩条变高变宽，跟"看一根数轴"的直觉一致。
     竖向要看更多空间，用拖动（拖是二维的，一切照旧）。 */
  function zoomAt(sx, factor) {
    var next = clamp(view.scale * factor, MIN_SCALE, MAX_SCALE);
    if (Math.abs(next - view.scale) < 1e-6) { return; }
    var k = next / view.scale;
    view.x = sx - (sx - view.x) * k;
    view.scale = next;
    scheduleRedraw();
  }
  function zoomBy(factor) { zoomAt(view.w / 2, factor); }

  /* 适配：横向把整条轴铺满，纵向让"彩条 + 轴 + 标签"这一整块在屏幕里居中。
     竖向不能在 world 坐标里算 —— 彩条的高度是屏幕像素（见 BAR_LEVELS），
     不是世界尺寸，混着算必然一边对一边错。所以这里横向用世界宽度定比例，
     竖向直接把轴摆到"上留彩条、下留标签"的那个高度上。 */
  function fitContent() {
    var pad = 72;
    var world = N + 2.4;
    var s = clamp((view.w - pad * 2) / Math.max(1, world), MIN_SCALE, MAX_SCALE);
    view.scale = s;
    view.fit = s;
    /* 适配就是"整条数轴刚好铺满" —— 它同时是缩放读数里那个 100% 的基准 */
    MIN_SCALE = s * 0.25;
    MAX_SCALE = s * 220;
    view.x = pad + ((view.w - pad * 2) - world * s) / 2 - (-1.2) * s;
    recenter();
  }

  /* 只重新摆竖向、不动缩放：换"低/中/高"时用这个 ——
     用户放大到某一处正在看，换个高度不该把他弹回 100%。 */
  function recenter() {
    var barH = barScreen();
    /* 刻度与文字关掉时就不用给它留那 188px 了（不然轴下面吊着一大片空白，还叫什么"干净视图"） */
    var below = (state.levels ? LABEL_BOTTOM : 26) * state.axis;
    var y = (view.h - (barH + below)) / 2 + barH;
    /* 竖向的夹取：轴上面要放得下彩条、轴下面要放得下标签。
       整轴放大到装不下时（高彩条 × 2 倍），**保标签** —— 宁可切掉条子的顶，
       也不能把轴和文字挤出屏幕（那时屏幕上就真的只剩一片空白了）。 */
    var upper = Math.max(36, view.h - below);
    view.y = clamp(y, Math.min(barH, upper), upper);
    scheduleRedraw();
  }

  function resize() {
    var dpr = window.devicePixelRatio || 1;
    var w = Math.max(1, Math.round(wrap.clientWidth || view.w));
    var h = Math.max(1, Math.round(wrap.clientHeight || view.h));
    var first = view.w !== w || view.h !== h;
    view.w = w;
    view.h = h;
    view.dpr = dpr;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    if (canvas.style) { canvas.style.width = w + 'px'; canvas.style.height = h + 'px'; }
    if (first && FRESH) { FRESH = false; fitContent(); return; }
    /* 舞台尺寸变了：卡片要重新夹回可见范围（拖到右下角再缩窗口，不夹就飘出去了） */
    if (cardEl && !cardEl.hidden) { placeWin('card'); }
    if (first) { scheduleRedraw(); }
  }

  /* ------------------------------------------------------------------ *
   * 3. 画：网格 → 轴 → 刻度
   * ------------------------------------------------------------------ */

  /* 数轴整体大小的上下限（倍数）。上限 2 是量出来的：彩条档"高"（224px）乘 2 再加标签区，
     一屏 700px 左右刚好放得下；再大就得靠竖向拖动去看，手感反而差。 */
  var AXIS_MIN = 0.7;
  var AXIS_MAX = 2;

  var state = {
    grid: false, gridSize: 40, bar: 1, mastery: false,
    levels: true,                       /* 刻度与文字这一层画不画（右侧那条第二颗开关） */
    readout: true,                      /* 左上角"这一轴是谁的 + 读数"显不显示 */
    axis: 1,                            /* **数轴整体大小**（1 = 标准）：轴、刻度、文字、点、彩条一起放大缩小 */
    filter: { status: [], diff: [], mark: [], term: [] }   /* 筛选：空数组 = 这一维不筛 */
  };
  /* mastery：掌握度彩条层（条子 + 点的状态色）要不要画。
     **默认关**（用户原话："默认时不显示这些彩色的。它只有刻度，只有这些文字的点。
     放大的时候就可以展示一下。还有这个有按钮控制显示，它才显示。"）——
     默认这一页就是一根干干净净的轴：刻度 + 带名字的点；按「掌握度」才长出彩色。 */
  var GRID_STEPS = [20, 40, 80];      // 网格疏密：一格 = 多少个知识点
  var rafPending = false;

  /* 彩条高度也归"数轴整体大小"管：整轴放大时条子跟着长，不然放大之后条子反而变矮了。 */
  function barScreen() { return (BAR_LEVELS[state.bar] || BAR_LEVELS[1]).screen * state.axis; }

  function scheduleRedraw() {
    if (rafPending) { return; }
    rafPending = true;
    var run = function () { rafPending = false; redraw(); };
    if (typeof window.requestAnimationFrame === 'function') { window.requestAnimationFrame(run); }
    else { run(); }
  }

  function redraw() {
    var v = view;
    /* 清屏必须**按像素密度**清：canvas 的坐标是设备像素（w*dpr × h*dpr），
       若退回单位变换只 fillRect(0,0,w,h)，就只擦掉了左上角 1/dpr² 那一块 ——
       高dpr屏（Retina 是 2）上剩下四分之三留着上一帧，一拖动就把旧文字糊成一片。
       白板的 redraw() 也是这么写的（先 setTransform(dpr,…) 再铺底），这里对齐它。
       这一条踩过一次真机：无头浏览器 dpr=1，怎么截图都是好的。 */
    ctx.setTransform(v.dpr, 0, 0, v.dpr, 0, 0);
    ctx.fillStyle = C.background;
    ctx.fillRect(0, 0, v.w, v.h);
    ctx.setTransform(v.dpr * v.scale, 0, 0, v.dpr * v.scale, v.dpr * v.x, v.dpr * v.y);
    if (state.grid) { drawGrid(); }
    drawBars();
    drawCards();
    drawAxis();
    /* 刻度与文字这一层归右侧那颗开关管（关掉就只剩轴、点与彩条 —— 看分布时更干净）；
       节点标记（当前 / 观察）不算刻度，照旧画。 */
    if (state.levels) { drawLevels(); }
    drawDots();
    if (state.levels) { drawMinor(); }
    drawMarks();
    drawNodes();
    /* 划过那一格的竖线 + 亮起来的那颗点画在最上面（它是"名字指着谁"的答案，不能被压住） */
    drawHoverMark();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    syncReadout();
    syncStageChips();
    syncMini();               /* 缩略条要跟着视野实时动（它就是"当前屏幕所展示的范围"） */
  }

  /* 彩色条：每个知识点从轴上长一根。
     **高矮 = 这颗知识点的难度**（综合判定，见 timeline-data.js 的 diff）——
     学没学都有高度：高矮说的是"这个点有多硬"，颜色说的才是"学到什么程度了"。
     颜色 = 学习状态（没学过的就是"未开始"那档灰，不是没有条子）。

     形状是**圆头**的（用户原话："数值出来这个色条的时候，它应该是一个圆形的，比较舒服"）：
     顶端走一个二次曲线收圆，像一根根立着的胶囊，而不是一排方角栅栏。

     宽度按**世界单位**给（跟着轴一起缩放：缩小时是一条密密的梳齿，放大后每根都分开），
     高度按**屏幕像素**给（见 BAR_LEVELS 的注释：世界高度会跟着放大长到屏幕外去）。 */
  function drawBars() {
    if (!state.mastery || !LEARN || !N) { return; }
    var range = visibleIndexRange();
    var half = 0.42;                       /* 一格 0.84 宽，留出 0.16 的缝 */
    var rMax = px(3.4);                    /* 圆头半径最多 3.4px（屏幕上） */
    ctx.save();
    var painted = null;
    for (var i = range.from; i <= range.to; i += 1) {
      var rec = ITEMS[i].rec;
      if (!rec) { continue; }
      /* 已经拆成卡片画的那几格，就不再画整格这一根（不然两根叠在一起） */
      if (cardsOpen(rec)) { continue; }
      var color = statusColor(rec.status);
      if (color !== painted) { ctx.fillStyle = color; painted = color; }
      /* 被筛掉的**只是变淡**（用户口径：数轴永远是一条完整的数轴） */
      ctx.globalAlpha = passFilter(rec) ? 1 : FILTER_ALPHA;
      barPath(ITEMS[i].x - half, half * 2, px(heightOf(rec.diff)), rMax);
    }
    ctx.restore();
  }

  /* 圆头柱子：一根根立着的胶囊（顶端走二次曲线收圆，不是方角栅栏） */
  function barPath(x0, w, h, rMax) {
    var r = Math.max(0, Math.min(rMax, w / 2, h));
    var x1 = x0 + w;
    ctx.beginPath();
    ctx.moveTo(x0, 0);
    ctx.lineTo(x0, -h + r);
    ctx.quadraticCurveTo(x0, -h, x0 + r, -h);
    ctx.lineTo(x1 - r, -h);
    ctx.quadraticCurveTo(x1, -h, x1, -h + r);
    ctx.lineTo(x1, 0);
    ctx.closePath();
    ctx.fill();
  }

  /* 难度（1.0–5.0）→ 屏幕上的条子高度。
     最低的一档也留 0.34 的高度：难度 1 要是画成零高，"简单"就变成了"没有"，
     跟"这根条子不存在"分不开 —— 参考图里所有条子也都是有高度的。 */
  function heightOf(diff) {
    var t = (clamp(diff, 1, 5) - 1) / 4;   /* 1 → 0，5 → 1 */
    return (0.34 + 0.66 * t) * barScreen();
  }

  /* ---------------- 最细那一档：把一格展开成它的卡片 ---------------- *
     参考图最细那一档（知识点视图）画的不是一根柱子，而是这个知识点名下的**那几张卡**，
     图底部自己写着三条规则：**宽度 = 卡片权重、高度 = 卡片难度、颜色 = 卡片状态**。
     一格宽到这个程度，就把它的 1 格宽度按权重分给那几张卡，并排画进去：
     卡片太窄就只画柱子，宽一点写卡片名，再宽一点把正确率也写上。

     2026-09-30 用户看过之后改了两条口径（都在下面 drawCards 里）：
       · **高度那一维去掉** —— 同一格里的卡**齐平**，都取这个知识点自己的难度；
       · 掌握度没开时**整层不画**（原来"只画结构、涂中性灰"，用户放大后看见一排灰条）。 */
  var CARD_MIN_W = 56;      /* 一格宽到这么多屏幕像素才拆卡 */
  var CARD_TYPE_W = 34;     /* 一张卡宽到这么多才写得下卡片名 */
  var CARD_ACC_W = 52;      /* 再到这么多才写得下正确率 */

  function cardsOpen(rec) {
    return view.scale >= CARD_MIN_W && !!(rec && rec.cards && rec.cards.length);
  }

  function drawCards() {
    /* 掌握度没开就**整层不画**（用户 2026-09-30：他在数轴上没开掌握度，放大到最细却看见
       一排灰白色的条儿，问"这是什么东西"）。原来是"关了掌握度只画结构、统一涂中性灰" ——
       于是没开颜色也会凭空多出一排灰条。口径改成：这一层连同颜色一起归「掌握度」管。 */
    if (!state.mastery || !LEARN || !N || view.scale < CARD_MIN_W) { return; }
    var range = visibleIndexRange();
    var rMax = px(3.2);
    var gap = px(1.4);                   /* 卡与卡之间的缝（屏幕 1.4px） */
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (var i = range.from; i <= range.to; i += 1) {
      var rec = ITEMS[i].rec;
      if (!cardsOpen(rec)) { continue; }
      ctx.globalAlpha = passFilter(rec) ? 1 : FILTER_ALPHA;   /* 一格的卡跟着这一格一起淡 */
      var cards = rec.cards;
      var sum = 0;
      var k;
      for (k = 0; k < cards.length; k += 1) { sum += cards[k].weight; }
      var usable = 1 - gap * (cards.length - 1);
      if (!sum || usable <= 0.15) { continue; }
      /* 高度**整格齐平**，都取这个知识点自己的难度（用户 2026-09-30 定的口径）。
         原来用的是**每张卡自己的**难度（参考图那三条规则里的"高度 = 卡片难度"），
         但卡片难度是各自掷出来的、区间还跟知识点对不上，于是同一格里高矮参差、
         甚至某张卡比它所属的那一整格还高。改成齐平之后，这一层只回答
         "这一格由几块组成、每块学到什么程度"（宽 = 权重、色 = 状态），
         高度不再携带信息 —— "这一格有多硬"在整格那一层已经给过了。 */
      var h = px(heightOf(rec.diff));
      var x = i + gap / 2;
      for (k = 0; k < cards.length; k += 1) {
        var card = cards[k];
        var w = usable * card.weight / sum;
        if (w <= 0) { continue; }
        /* 颜色 = 卡片状态（整体归「掌握度」那颗按钮管：那一层不开，这里根本不画） */
        var color = statusColor(card.status);
        ctx.fillStyle = color;
        barPath(x, w, h, rMax);
        var wPx = w * view.scale;
        if (wPx >= CARD_TYPE_W) {
          ctx.fillStyle = color;
          ctx.font = worldFont(400, 9);
          ctx.fillText(card.acc + '%', x + w / 2, -h - px(13));
          if (wPx >= CARD_ACC_W) {
            ctx.font = worldFont(500, 9.5);
            ctx.fillStyle = C.ink3;
            ctx.fillText(card.type, x + w / 2, -h - px(24));
          }
        }
        x += w + gap;
      }
    }
    ctx.restore();
  }

  /* 网格：疏密就是用户选的那一档（一圈 = 20 / 40 / 80 个知识点）。
     以前这里为了"格子永远看得清"把格距折半再折半，结果三档在多数缩放下会折成同一个格距 ——
     用户报的"网格大小设定无效"就是这个（20 与 80 换了一模一样）。
     现在的做法：疏密**只听设定**，只在太密画不出来时**隔整数倍画**（2 倍、3 倍…），
     倍数只会让格子更疏、不会把两档折成一样，所以三档在任何缩放下都看得出区别。 */
  function drawGrid() {
    var step = state.gridSize;
    var gap = step * view.scale;
    var every = gap < 9 ? Math.ceil(9 / gap) : 1;
    var unit = step * every;
    var left = -view.x / view.scale;
    var right = (view.w - view.x) / view.scale;
    var top = -view.y / view.scale;
    var bottom = (view.h - view.y) / view.scale;
    ctx.save();
    ctx.strokeStyle = C.line;
    ctx.lineWidth = px(1);
    ctx.beginPath();
    for (var x = Math.ceil(left / unit) * unit; x <= right; x += unit) {
      ctx.moveTo(x, top);
      ctx.lineTo(x, bottom);
    }
    for (var y = Math.ceil(top / unit) * unit; y <= bottom; y += unit) {
      ctx.moveTo(left, y);
      ctx.lineTo(right, y);
    }
    ctx.stroke();
    ctx.restore();
  }

  /* 轴本身：一条**点线**（参考图里就是这样的：一串小圆点串成一根轴，
     节点像珠子一样穿在上面，而不是"一根实线 + 一堆刻度线"）。
     两端的短竖线保留：那是轴的端点，缩到最小时还知道轴从哪儿到哪儿。 */
  function drawAxis() {
    var x0 = -1;
    var x1 = N + 1;
    ctx.save();
    ctx.strokeStyle = C.lineStrong;
    ctx.lineCap = 'round';
    /* 点线：线宽 1.6px、实 0.1 + 空 4 —— 圆头一收就成了"一串点" */
    ctx.lineWidth = px(1.6);
    ctx.setLineDash([0.1 / view.scale, 4 / view.scale]);
    ctx.beginPath();
    ctx.moveTo(x0, 0);
    ctx.lineTo(x1, 0);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineWidth = px(1.5);
    ctx.beginPath();
    ctx.moveTo(x0, px(-5)); ctx.lineTo(x0, px(5));
    ctx.moveTo(x1, px(-5)); ctx.lineTo(x1, px(5));
    ctx.stroke();
    ctx.restore();
  }

  /* 六级**标记 + 标签**，文字出现的顺序就是用户定的：
     **分段 → 年级 → 册 → 章 → 节 → 知识点**（由下往上，越靠轴越细）。
     标记按用户口径分两种（原话："数轴是一条线。几个阶段，然后有一些大的点来显示。
     你可以给它一些刻度，用粗一点的线，或者高一点的线，这都没有问题"）：
       · 分段（小学 / 初中 / 高中 / 竞赛）—— **一颗大点**标在轴上，名字 + 区间落在最下面一行；
       · 年级 / 册 · 板块 / 章 / 节 —— **刻度线**，越粗的级线越长也越粗；
       · 知识点 —— 用轴下那一排**小点**当刻度（"点就是知识点"），不再另画线。
     need 是"这一级值得画出来"的最低屏幕宽度，低于它整段跳过 —— 缩小时先丢知识点、
     再丢节、再丢章，剩下上面几级；放大时反过来一层层长出来。 */
  /* 每一级给几行位置（行位是屏幕像素，越粗的级越靠下）。
     一行放不下就往下挪一行 —— 用户看过截图后提的："左侧文字挡住了；应该继续往下移动的"。
     一级最多占 3 行，级与级之间留出空档，不会叠到一起。 */
  /* 标记分三种（照参考图）：
       · `ring` 空心圆 —— 学段。参考图里四个学段都是"穿在轴上的空心圆"；
       · `dot`  实心小点 —— 章。参考图里章节点就是轴上的小实心点；
       · `tick` 刻度线 —— 年级 / 册 / 节（这几级没有参考图，沿用"越粗的级线越长"）。
     学段的名字分两行（名字 + 区间），所以 rows 给两个 —— 这一条 2026-09-30 已撤（学段不写名字了）。 */
  var LADDER = [
    /* 学段（分段）那一级**不写名字**了（用户 2026-09-30，见 drawLevel），
       所以它没有 rows；它只剩"穿在轴上的空心圆"这个标记。 */
    { size: 14,   weight: 700, color: 'ink',   gap: 24, need: 0,  tick: 0,  ring: 6.4 },
    { size: 12.5, weight: 600, color: 'ink2',  gap: 20, need: 40, rows: [132, 146], tick: 32 },
    { size: 12,   weight: 600, color: 'ink2',  gap: 18, need: 30, rows: [108, 122], tick: 26 },
    { size: 11.5, weight: 500, color: 'ink2',  gap: 14, need: 20, rows: [82, 96], dot: 2.9 },
    { size: 11,   weight: 400, color: 'ink3',  gap: 12, need: 12, rows: [54, 68], tick: 12 },
    { size: 10.5, weight: 400, color: 'ink4',  gap: 10, need: 5,  rows: [18, 32, 46] }
  ];
  var DOT_ROW = 9;      /* 点吊在轴下方 9px：轴上留一条彩色的珠串 */
  var DOT_R = 2.6;      /* 点的大小（屏幕像素半径）—— 一颗点就是一个知识点，颗颗一样大 */
  var DOT_GAP = 3.4;    /* 两颗点至少留这么远，挤到看不清就隔几颗画一颗 */
  var FILTER_ALPHA = 0.16;  /* 被筛掉的格子画多淡：**只是变淡，不从轴上消失**（见 passFilter） */

  function visibleIndexRange() {
    var from = Math.floor(-view.x / view.scale);
    var to = Math.ceil((view.w - view.x) / view.scale);
    return { from: clamp(from - 1, 0, Math.max(0, N - 1)), to: clamp(to + 1, 0, Math.max(0, N - 1)) };
  }

  /* **名字只写一级** —— 用户 2026-09-29 的更正：
     "底部的名字不可能各个层级都出现啊……只出现当前的；他上一级别的就在左边一层层对应出现。"
     所以：
       · **当前这一级**（屏幕上画得出来的**最细**那一级，见 currentLabelDepth）——
         逐段写名字，照旧居中 / 挪行 / 名字落在屏幕外就不画；
       · **更粗的几级**（分段 / 年级 / 册 / 章 / 节 …）—— 名字**不再逐段铺满整条轴**，
         每级只在屏幕左边钉一条："视野左缘那一段"的名字，一级一行、往下排成面包屑。
     六级**标记**（分段大点 / 册·章·节刻度线 / 知识点小点）照旧都画，不受这一条影响 ——
     收掉的只是"名字"这一层。 */

  /* 把名字截到段里放得下为止（末尾加"…"）—— 参考图里就是"有理数…""一元二…"这种写法。
     比"放不下就整条不写"好：轴上一眼能看到更多段，不会忽然空一片。
     连一个字的宽度都放不下（或只剩省略号也放不下）就返回空串，调用方整条放弃。 */
  function fitLabel(name, screenW) {
    var limit = screenW - 6;               /* 左右各留 3px 的缝 */
    if (limit <= 0) { return ''; }
    var out = name;
    while (out.length > 1) {
      out = out.slice(0, -1);
      if (ctx.measureText(out + '…').width * view.scale <= limit) { return out + '…'; }
    }
    return ctx.measureText('…').width * view.scale <= limit ? '…' : '';
  }

  function currentLabelDepth(range) {
    /* 由细到粗找第一级"**大多数**段的名字都写得出来"的。
       两个"不是"，都是踩过的坑：
         · 不是"有一段够宽" —— 会被个别特别宽的格子带偏（适配时 185 个章里只要有一两个
           span 特别大，整条轴就只剩章名了，册 / 年级 / 分段全被顶掉）；
         · 不是只比 spec.need —— need 管的是"这一格看得见"，不是"名字写得下"。只看 need 的话，
           某些缩放档会挑中一级、可它的名字一个都写不出来（判据跟画名字那一条不一致），
           轴上就空一片。所以这里用的是**跟 drawLevel 写名字时同一条判据**。
       循环到**第 1 级为止**、不落到第 0 级：学段那一级 2026-09-30 起不写名字了
       （见 drawLevel 里那条 depth === 0 的 continue），名字这层不认它 ——
       不然窄一点的窗口上"学段全都写得下"会把它选中，而它一个字都不画，轴上就一个名字都没有。
       一级都挑不出来时退回"年级"（第 1 级）。 */
    for (var d = LADDER.length - 1; d >= 1; d -= 1) {
      var spec = LADDER[d];
      var list = SEGS[d];
      if (!list || !list.length) { continue; }
      ctx.save();
      ctx.font = worldFont(spec.weight, spec.size);
      var seen = 0;
      var fit = 0;
      for (var k = 0; k < list.length; k += 1) {
        var seg = list[k];
        if (seg.end < range.from || seg.start > range.to) { continue; }
        seen += 1;
        var screenW = (seg.end - seg.start) * view.scale;
        /* 门槛跟着"轴整体大小"走：字大了，同一段就装不下原来那么多名字了
           （后半句那条 measureText 里已经带着 state.axis，见 worldFont）。 */
        if (screenW >= spec.need * state.axis &&
            screenW >= ctx.measureText(seg.name).width * view.scale * 0.5) { fit += 1; }
      }
      ctx.restore();
      if (seen && fit * 2 >= seen) { return d; }
    }
    return 1;               /* 一级都挑不出来时退回"年级"（学段那级不写名字，见上面） */
  }

  function drawLevels() {
    var range = visibleIndexRange();
    var cur = currentLabelDepth(range);
    for (var d = 0; d < LADDER.length; d += 1) {
      drawLevel(d, range, cur);
    }
  }

  function drawLevel(depth, range, labelDepth) {
    var isCurrent = depth === labelDepth;
    var spec = LADDER[depth];
    var list = SEGS[depth];
    if (!list || !list.length) { return; }
    /* rows[i]：第 i 行上最后一个标签的右边界（世界单位）。从左往右排，
       放不下就往下挪行，所以这里要按行各记一份。 */
    var rows = [];
    /* 学段那一级（depth 0）**没有 rows** —— 它不写名字（见下面那条 continue），只画空心圆。
       这里要挨得住"没有 rows"：踩过一次 —— 直接读 spec.rows.length 会抛 TypeError，
       整个 drawLevels 断在那儿，轴、点、标签、缩略条一起不画（画布上只剩半帧）。 */
    var rowCount = spec.rows ? spec.rows.length : 0;
    for (var r0 = 0; r0 < rowCount; r0 += 1) { rows.push(-1e9); }
    ctx.save();
    ctx.font = worldFont(spec.weight, spec.size);
    ctx.lineWidth = px(1);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    var visLeft = -view.x / view.scale;
    var visRight = (view.w - view.x) / view.scale;
    /* 面包屑问的是"视野左缘落在哪一段里"。适配时（或拖到两头）视野左缘会跑到轴外，
       先夹回轴的范围再问 —— 不夹的话左边那一列会整列空掉（适配那一刻就是这样）。 */
    var first = SEGS[0] && SEGS[0].length ? SEGS[0][0].start : 0;
    var last = SEGS[0] && SEGS[0].length ? SEGS[0][SEGS[0].length - 1].end : N;
    var edge = clamp(visLeft, first, last);

    for (var k = 0; k < list.length; k += 1) {
      var seg = list[k];
      if (seg.end < range.from || seg.start > range.to) { continue; }
      var x0 = seg.start;
      var x1 = seg.end;
      var screenW = (x1 - x0) * view.scale;
      /* 这一段够不够画一眼（缩小时"只显示重要的部分"就靠这一条）。
         够不够**画标记**看它；够不够**写名字**另外说 —— 见下。
         门槛同样随"轴整体大小"抬高：刻度点画大了，太窄的一段也就塞不下了。 */
      var wide = screenW >= spec.need * state.axis;
      /* 视野左缘正落在这一段里 —— 更粗的那几级（面包屑）只有这一段会写名字 */
      var coversLeft = (x0 <= edge && edge <= x1);

      if (wide) {
        if (spec.ring) {
          /* 学段：**穿在轴上的空心圆**（参考图里四个学段都是这样）。
             先铺一圈底色把点线那一段遮掉，看起来才像"点线穿过一个圆" */
          var mid = (x0 + x1) / 2;
          ctx.fillStyle = C.background;
          ctx.beginPath();
          ctx.arc(mid, 0, px(spec.ring + 1.4), 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = C.lineStrong;
          ctx.lineWidth = px(1.6);
          ctx.beginPath();
          ctx.arc(mid, 0, px(spec.ring), 0, Math.PI * 2);
          ctx.stroke();
        } else if (spec.dot) {
          /* 章：轴上一颗小实心点（参考图里章节点就是这样的），同样先把点线断开 */
          ctx.fillStyle = C.background;
          ctx.beginPath();
          ctx.arc(x0, 0, px(spec.dot + 1.8), 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = C.ink2;
          ctx.beginPath();
          ctx.arc(x0, 0, px(spec.dot), 0, Math.PI * 2);
          ctx.fill();
        } else if (spec.tick) {
          /* 年级 / 册 / 节：刻度线，越粗的级线越长 */
          ctx.strokeStyle = C.lineStrong;
          ctx.lineWidth = px(spec.tick >= 26 ? 1.6 : 1);
          ctx.beginPath();
          ctx.moveTo(x0, 0);
          ctx.lineTo(x0, px(spec.tick));
          ctx.stroke();
        }
      }

      /* **学段这一级不写名字**（用户 2026-09-30："左侧还出现很多什么小学、初中、高中的文字，
         就直接去掉就行了。因为我们左上方已经有了"）。左上方那两行读数里已经写着
         "小学 / 六年级 / 六年级上册 / …"，轴上再钉一个"小学 001–380"就是同一句话说两遍。
         学段本身**靠那颗空心圆认**（标记照画，见上面 wide 那一段）—— 认得出"这里换段了"就够。 */
      if (depth === 0) { continue; }

      /* 名字这一层：
         · 比"当前这一级"更**细**的级 —— 一个名字都不写（用户要的是"只出现当前的"）；
         · 更**粗**的几级 —— 只写"视野左缘那一段"这一条，钉在屏幕左边、一级一行；
         · 当前这一级 —— 逐段写（下面还要按"装不装得下半个名字"再筛一道）。 */
      if (depth > labelDepth) { continue; }
      if (!isCurrent && !coversLeft) { continue; }
      if (!wide && !coversLeft) { continue; }

      var text = seg.name;
      var textW = ctx.measureText(text).width;               /* 世界宽 */
      /* 段本身至少要装得下半个名字，才值得往外写。
         钉在左边当面包屑的那几条**不看这一条** —— 它们不占段的宽度，左边一行只放一条，
         不然"上一级别"会因为自己的格太窄而从左边那一列里消失。 */
      if (isCurrent && !coversLeft && screenW < textW * view.scale * 0.5) { continue; }
      /* 连**半个名字**都放不下时，才**用"…"截断**（参考图里"有理数…""一元二…"就是这个写法）——
         原来这一档是"整条不写"，轴上一空一片；截一下至少还认得出是哪一段。
         装得下半个名字的就写全（多出来的字靠下面的"挪行"避让）：
         中文册名如"一年级上册"挤一挤还看得清，不该被截成"一年…"。 */
      if (isCurrent && !coversLeft && screenW < textW * view.scale * 0.5) {
        text = fitLabel(seg.name, screenW);
        if (!text) { continue; }
        textW = ctx.measureText(text).width;
      }

      var cx;
      var pinned = coversLeft || (x0 <= visLeft && x1 - x0 > visRight - visLeft);
      if (pinned) {
        /* 视野左缘正落在这一段里 / 这一段比视野还宽（放大之后就是这样）：钉在左边，
           否则它居中在段心里早就跑到屏幕外了 —— 那就"不知道自己现在在哪一段"了 */
        cx = visLeft + px(12) + textW / 2;
      } else {
        cx = (x0 + x1) / 2;
        if (cx < visLeft || cx > visRight) {
          /* **名字本身就落在屏幕外**：不画。
             以前这里会把屏幕外的名字夹到左边缘，结果几条挤在同一点糊成一团
             （用户截图上那段重影就是这个：加法定运算律 / 减的运算律 / 乘的运算律 叠在一起）。 */
          continue;
        }
        /* 段装得下名字、名字也在视野里：只是别贴着边被切掉半个字 */
        cx = Math.max(visLeft + px(12) + textW / 2, Math.min(cx, visRight - px(12) - textW / 2));
      }

      ctx.fillStyle = C[spec.color];
      /* 这一行放不下就**往下挪一行**（用户原话："应该继续往下移动的"）；
         几行都放不下才放弃。 */
      var left = cx - textW / 2;
      var row = -1;
      for (var r2 = 0; r2 < rows.length; r2 += 1) {
        if (left >= rows[r2] + px(spec.gap)) { row = r2; break; }
      }
      if (row < 0) { continue; }
      rows[row] = cx + textW / 2;
      ctx.fillText(text, cx, px(spec.rows[row]));
    }
    ctx.restore();
  }

  /* 轴上那一排点：**一颗点 = 一个知识点**（用户原话："我们用点来代替刻度；点就是知识点"）。
     颜色分两种情形，跟「掌握度」那颗按钮绑在一起：
       · 默认（掌握度关）：一律中性灰。"它只有刻度，只有这些文字的点" —— 轴上不跳颜色；
       · 掌握度开：按学习状态上色。绿的一片是学得好的，蓝的一片是在学的，灰的一片是还没碰的。
     挤到看不清时按固定间隔隔几颗画一颗 —— 间隔锚在 0 号上（不是锚在可视范围上），
     这样左右拖动时点不会跟着跳。 */
  function drawDots() {
    if (!N) { return; }
    var range = visibleIndexRange();
    var step = Math.max(1, Math.ceil(DOT_GAP / view.scale));
    var r = px(DOT_R);
    var y = px(DOT_ROW);
    ctx.save();
    /* 两趟画：先把**被筛掉的**淡着一遍，再把命中的盖上来 ——
       一趟一个透明度就不会每颗点都切一次 fillStyle。没筛的时候第一趟直接跳过。 */
    for (var pass = 0; pass < 2; pass += 1) {
      if (pass === 0 && !filterOn()) { continue; }
      ctx.globalAlpha = pass === 0 ? FILTER_ALPHA : 1;
      var painted = null;
      for (var i = Math.ceil(range.from / step) * step; i <= range.to; i += step) {
        var rec = ITEMS[i].rec;
        if (pass === 0 ? passFilter(rec) : !passFilter(rec)) { continue; }
        var color = (state.mastery && rec) ? statusColor(rec.status) : C.ink4;
        if (color !== painted) { ctx.fillStyle = color; painted = color; }
        ctx.beginPath();
        ctx.arc(ITEMS[i].x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  /* ---------- 轴上那四类标记的小图标（用户："轴上也在对应知识点上画小图标"）----------
     图标**不另画一套**：直接取页面上那份 lucide 的路径（`lucide.Star` 之类是
     `[[标签, 属性], …]` 的数组），拼成 Path2D 再描边 —— 与图例条、筛选里的小图标
     是同一份数据，不会"图例里一个样、轴上又一个样"。
     格子太窄就不画：769 格挤在 1200px 里每格 1.5px，硬塞一排图标是噪声不是信息 ——
     那种缩放档要看"哪些格被标了"，用右侧的筛选（标记那一维）。 */
  var MARK_MIN_W = 12;          /* 一格宽到这么多屏幕像素才画它的标记图标 */
  var MARK_ICON_SIZE = 10;      /* 图标屏幕边长（像素） */
  var MARK_ICON_GAP = 3;        /* 一颗知识点挂了好几个标记时，图标之间的缝（像素） */
  var MARK_PATHS = {};          /* key → Path2D（lucide 是 24×24 的格子，画的时候再缩） */

  /* lucide 的导出名是 PascalCase（star → Star，rotate-ccw → RotateCcw） */
  function iconKey(name) {
    return String(name).split('-').map(function (s) {
      return s.charAt(0).toUpperCase() + s.slice(1);
    }).join('');
  }

  function markPath(key) {
    if (MARK_PATHS[key] !== undefined) { return MARK_PATHS[key]; }
    var m = markOf(key);
    var node = (m && window.lucide) ? window.lucide[iconKey(m.icon)] : null;
    var p = null;
    if (node && node.length) {
      p = new Path2D();
      for (var i = 0; i < node.length; i += 1) {
        var tag = node[i][0];
        var at = node[i][1] || {};
        if (tag === 'path' && at.d) { p.addPath(new Path2D(at.d)); }
        else if (tag === 'rect') { p.rect(+at.x || 0, +at.y || 0, +at.width || 0, +at.height || 0); }
        else if (tag === 'circle') { p.arc(+at.cx || 0, +at.cy || 0, +at.r || 0, 0, Math.PI * 2); }
        else if (tag === 'line') { p.moveTo(+at.x1 || 0, +at.y1 || 0); p.lineTo(+at.x2 || 0, +at.y2 || 0); }
      }
    }
    MARK_PATHS[key] = p;
    return p;
  }

  function drawMarks() {
    if (!N || view.scale < MARK_MIN_W) { return; }
    var range = visibleIndexRange();
    var size = px(MARK_ICON_SIZE);
    var gap = px(MARK_ICON_GAP);
    var k = size / 24;                 /* lucide 的图标画在 24×24 的格子里 */
    ctx.save();
    /* 线宽：缩放之后还要是 1.7px —— 所以先除掉 k（见下面的 scale） */
    ctx.lineWidth = px(1.7) / k;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (var i = range.from; i <= range.to; i += 1) {
      var rec = ITEMS[i].rec;
      var keys = marksOf(rec);
      if (!keys.length) { continue; }
      /* 一颗知识点可以挂好几个标记（用户 2026-09-30 定的"多选"）—— 它们并排排在格子上方。
         一整排要占 `MARK_ICON_SIZE × n + 缝`，这一格在屏幕上装不下就**整排不画**：
         宁可空着，也不能挤到隔壁那一格的头上（挤过去就成了"这一格被标了"，是假的）。 */
      var need = (MARK_ICON_SIZE * keys.length + MARK_ICON_GAP * (keys.length - 1)) * state.axis;
      if (view.scale < need) { continue; }
      ctx.save();
      ctx.globalAlpha = passFilter(rec) ? 1 : FILTER_ALPHA;
      var span = keys.length * size + (keys.length - 1) * gap;   /* 整排的世界宽 */
      /* 位置：掌握度开着就落在**彩条顶端**上面一点；关着就**贴轴**（用户 2026-09-30 定的）——
         彩条不画的时候，"彩条顶端"那个高度上什么都没有，图标会悬在半空（用户放大后看见的
         就是这种"没东西托着的图标"）。贴轴之后标记始终看得见，也不再依赖彩条那一层。 */
      var top = state.mastery ? (-px(heightOf(rec.diff)) - px(4) - size) : (-px(6) - size);
      for (var m = 0; m < keys.length; m += 1) {
        var p = markPath(keys[m]);
        if (!p) { continue; }
        ctx.save();
        ctx.strokeStyle = markColor(keys[m]);
        ctx.translate(ITEMS[i].x - span / 2 + m * (size + gap), top);
        ctx.scale(k, k);
        ctx.stroke(p);
        ctx.restore();
      }
      ctx.restore();
    }
    ctx.restore();
  }

  /* 更细的一档：一格宽到一定程度时，格内再分 5 份画小刻度。
     将来"知识点内部的部分"（定义 / 理解 / 应用…）就落在这些位置上 —— 现在先把刻度画出来。 */
  function drawMinor() {
    if (view.scale < 56) { return; }
    var sub = 5;
    var range = visibleIndexRange();
    ctx.save();
    ctx.strokeStyle = C.line;
    ctx.lineWidth = px(1);
    ctx.beginPath();
    for (var i = range.from; i <= range.to + 1 && i <= N; i += 1) {
      for (var k = 1; k < sub; k += 1) {
        var x = i + k / sub;
        ctx.moveTo(x, 0);
        ctx.lineTo(x, px(4));
      }
    }
    ctx.stroke();
    ctx.restore();
  }

  /* ------------------------------------------------------------------ *
   * 4. 读数（左上角）
   * ------------------------------------------------------------------ */

  /* 读数就两行（用户 2026-09-30："左上角的面板就是先当前的知识点和掌握情况即可"）：
       第一行 —— 当前知识点（编号 + 名字）；
       第二行 —— 它的掌握情况（图谱路径 · 状态 · 掌握度）。
     划到别的格子上时两行都跟着换成**划过的那一格** —— 第 7 条要的"边上也出现对应的名字"。
     （原来那三行"769 格 · 4 分段 / …""已学 336 / 769 · 总进度 43.7%""视野 第 1 – 769 格"
     按这条收掉了：整条轴的规模不常驻在读数里，需要时看刻度、卡片与图例条。） */

  /* 读的是哪一格：手停在轴上就读划过的，否则读"学到哪儿了"那一格 */
  function readIndex() { return hoverIndex >= 0 ? hoverIndex : now; }

  function nowText() {
    var i = readIndex();
    if (!ITEMS[i]) { return ''; }
    return (hoverIndex >= 0 ? '划过 · ' : '当前 · ') + idOf(i).slice(-4) + ' ' + ITEMS[i].name;
  }

  function progressText() {
    var i = readIndex();
    var it = ITEMS[i];
    if (!it) { return ''; }
    var rec = it.rec;
    var parts = pathOf(it).split(' / ');
    if (parts.length > 1) { parts.pop(); }   /* 最后一段就是它的名字，第一行已经写了 */
    var head = parts.join(' / ');
    var tail = rec ? rec.status + ' · 掌握 ' + rec.mastery + '%' : '还没有学习记录';
    return (head ? head + ' · ' : '') + tail;
  }

  function syncReadout() {
    if (elNow) { elNow.textContent = nowText(); }
    if (elProgress) { elProgress.textContent = progressText(); }
    if (elZoom) { elZoom.textContent = Math.round(view.scale / view.fit * 100) + '%'; }
  }

  /* ------------------------------------------------------------------ *
   * 4b. 这一轴是谁的（用户第 11 条 + 2026-09-29 的收束）
   *   用户原话："演示学生啊。还有未登录啊……你需要收束一下，它现在太多了……
   *   演示学生这块就是谁登录，然后就用谁的就行。"
   *   所以这里只剩**一行**：谁登录就写谁的，没登录就写那个演示学生 ——
   *   不再摆一排可切换的胶囊（那是上一版的写法，太占地方、也太吵）。
   *   数据照旧：未登录看演示那份（设计稿的 43.7%），登录了按账号在本机推（见 learnOptions）。
   * ------------------------------------------------------------------ */

  /* 换了数据（换账号 / 换记录）时重算一遍：段汇总 → 当前学习节点 → 读数 → 重画。
     "学到哪儿了"是新那份的，所以 findNow() 必须跟着重算（启动时算的那次不算数了）。 */
  function rebuildLearn() {
    if (!window.WK_LEARNING || !window.WK_LEARNING.build) { return; }
    LEARN = window.WK_LEARNING.build(ITEMS, learnOptions());
    SUMMARY = window.WK_LEARNING.summary(LEARN);
    applyLearn();
    closeCard();                        /* 卡片盯着的那一格，数据换了要收掉（不能留着旧数） */
    findNow();
    if (elNow) { elNow.textContent = nowText(); }
    if (elProgress) { elProgress.textContent = progressText(); }
    renderWho();
    syncTerms();                       /* 换了人：月份那几行的数据全变了 */
    if (matrixEl && !matrixEl.hidden) { buildMatrix(); }   /* 方阵也一样（颜色全变了） */
    scheduleRedraw();
  }

  function whoNode(cls, text) {
    var node = document.createElement('span');
    node.className = cls;
    node.textContent = text;
    return node;
  }

  /* 一行就说完：谁是主语 + 从哪来的。不再有可点的东西（用户："不再切换"）。 */
  function renderWho() {
    if (!whoEl) { return; }
    whoEl.textContent = '';
    whoEl.appendChild(whoNode('tk-who__lead', WHO.mine ? '我' : '演示学生'));
    whoEl.appendChild(whoNode('tk-who__chip is-on', WHO.grade ? WHO.name + ' · ' + WHO.grade : WHO.name));
    whoEl.appendChild(whoNode('tk-who__note',
      WHO.mine ? '本机演示数据 · 按账号在本机算的' : '演示数据 · 登录后看自己的'));
  }

  /* ------------------------------------------------------------------ *
   * 5. 手势：拖 / 滚轮 / 双指（与白板同一套规则，手感才一致）
   *     · 拖动（鼠标左键 / 单指）= 平移
   *     · 滚轮 = 平移；⌘/Ctrl + 滚轮 = 缩放（触控板捏合也走这一条）
   *     · 双指 = 捏合缩放 + 平移
   *     · 双击 = 向该点放大一档
   * ------------------------------------------------------------------ */

  function canvasPoint(e) {
    var rect = canvas.getBoundingClientRect ? canvas.getBoundingClientRect() : { left: 0, top: 0 };
    return { x: e.clientX - (rect.left || 0), y: e.clientY - (rect.top || 0) };
  }

  var drag = null;
  var pinching = false;

  function onDown(e) {
    if (pinching) { return; }
    /* 鼠标：**左键**与**右键**都接（右键 = 平移时间轴，用户 2026-09-30："时间轴上的刻度
       相当于右键拖动时间轴"）；中键 / 侧键不理。
       左键眼下与右键一样是平移，另外"点一下 = 弹卡片"（见 onUp）—— 用户说
       "左键现在是一会儿再设置"，所以先维持现状，等他定了再改这里。 */
    if (e.pointerType === 'mouse' && typeof e.button === 'number' && e.button !== 0 && e.button !== 2) { return; }
    if (typeof e.preventDefault === 'function') { e.preventDefault(); }
    if (typeof canvas.setPointerCapture === 'function') {
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* 忽略 */ }
    }
    var p = canvasPoint(e);
    drag = { id: e.pointerId, x: p.x, y: p.y, moved: 0, button: e.button === undefined ? 0 : e.button };
    setCanvasCursor('is-panning');
  }

  /* 光标跟着手势换（用户 2026-09-30："图标默认不应该是小手"，滚轮时要"向左右双箭头，
     滚回去就是往里收、表示缩小"）。三态：
       · 空       → 交给 CSS，即那个**小圆圈**（默认态）
       · is-zoom-in  → 左右双箭头**往外张**（放大，见 timeline.html 里的 data-URI 光标）
       · is-zoom-out → 左右双箭头**往中间收**（缩小）
       · is-panning  → 四向"移动"（正在拖视野）
     滚轮没有"结束"事件，所以配一个小定时器：220ms 没再滚就把光标收回默认。 */
  var zoomCursorTimer = 0;
  function setCanvasCursor(name) {
    if (!canvas.classList) { return; }
    canvas.classList.remove('is-zoom-in');
    canvas.classList.remove('is-zoom-out');
    canvas.classList.remove('is-panning');
    if (name) { canvas.classList.add(name); }
  }
  function flashZoomCursor(zoomingIn) {
    setCanvasCursor(zoomingIn ? 'is-zoom-in' : 'is-zoom-out');
    if (zoomCursorTimer && window.clearTimeout) { window.clearTimeout(zoomCursorTimer); }
    if (!window.setTimeout) { return; }
    zoomCursorTimer = window.setTimeout(function () {
      zoomCursorTimer = 0;
      if (!drag) { setCanvasCursor(''); }
    }, 220);
  }

  function onMove(e) {
    if (!drag || drag.id !== e.pointerId || pinching) {
      /* 没在拖：报出划过的那一格 */
      if (!pinching) {
        var hp = canvasPoint(e);
        showHover(indexAt(hp.x), hp.x, hp.y);
      }
      return;
    }
    var p = canvasPoint(e);
    var dx = p.x - drag.x;
    var dy = p.y - drag.y;
    drag.x = p.x;
    drag.y = p.y;
    drag.moved += Math.abs(dx) + Math.abs(dy);
    view.x += dx;
    view.y += dy;
    if (hoverEl) { hoverEl.hidden = true; }
    /* 这里**不**改"观察点"。用户 2026-09-30："我右键拖动的时候，我已经选中的那观察点
       不应该移动，不应该跟随我的鼠标移动" —— 拖视野只动视野，观察点是你**点**出来的，
       只有再点一格（或方阵上点一格）才换。原先跟到"视野正中那一格"是第 8 条的旧口径
       （"滑动的时候，卡片面板要不断刷新"），它跟"观察点"这个记号打架：拖着拖着，
       空心环开始自己一路跳，学生就不知道自己看的是哪一个了。 */
    scheduleRedraw();
  }

  function onUp(e) {
    if (!drag || drag.id !== e.pointerId) { return; }
    var moved = drag.moved;
    var which = drag.button;
    drag = null;
    if (typeof canvas.releasePointerCapture === 'function') {
      try { canvas.releasePointerCapture(e.pointerId); } catch (err) { /* 忽略 */ }
    }
    if (canvas.style) { canvas.style.cursor = ''; }
    setCanvasCursor('');
    /* 几乎没动 = 点了一下：这一格成为观察节点，弹出它的知识点卡片。
       **只认左键**：右键从头到尾都是"拖动时间轴"那一件事（用户 2026-09-30），
       右键松开不该顺手弹出卡片。 */
    if (moved < 5 && which === 0) {
      var p = canvasPoint(e);
      select(indexAt(p.x));
    }
  }

  /* 滚轮 = 放大缩小（用户 2026-09-30："鼠标滚轮的滚轮是用来放大缩小的"）。
     原来"滚轮平移、⌘/Ctrl+滚轮才缩放"那一套撤了 —— 平移交给右键拖动。
     锚点是指针：指针底下那一格不动，往哪滚就是围着哪儿放大 / 缩小。
     ⌘/Ctrl + 滚轮照旧也走这一条（触控板捏合一直走的就是它），不让老习惯落空。 */
  function onWheel(e) {
    if (typeof e.preventDefault === 'function') { e.preventDefault(); }
    var p = canvasPoint(e);
    var dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    if (!dy) { return; }
    flashZoomCursor(dy < 0);     /* 往上滚 = 放大（往外张），往下滚 = 缩小（往中间收） */
    zoomAt(p.x, Math.pow(1.0018, -dy));
  }

  var pinch = null;
  function touchInfo(e) {
    var t0 = e.touches[0];
    var t1 = e.touches[1];
    var rect = canvas.getBoundingClientRect ? canvas.getBoundingClientRect() : { left: 0, top: 0 };
    return {
      d: Math.sqrt(Math.pow(t1.clientX - t0.clientX, 2) + Math.pow(t1.clientY - t0.clientY, 2)),
      cx: (t0.clientX + t1.clientX) / 2 - (rect.left || 0),
      cy: (t0.clientY + t1.clientY) / 2 - (rect.top || 0)
    };
  }
  function onTouchStart(e) {
    if (e.touches && e.touches.length === 2) {
      pinching = true;
      drag = null;
      pinch = touchInfo(e);
      if (typeof e.preventDefault === 'function') { e.preventDefault(); }
    }
  }
  function onTouchMove(e) {
    if (!(e.touches && e.touches.length === 2)) { return; }
    if (typeof e.preventDefault === 'function') { e.preventDefault(); }
    var info = touchInfo(e);
    if (!pinch) { pinch = info; return; }
    if (pinch.d > 0) {
      var next = clamp(view.scale * (info.d / pinch.d), MIN_SCALE, MAX_SCALE);
      var real = next / view.scale;
      view.x = info.cx - (pinch.cx - view.x) * real;
      view.scale = next;
    } else {
      view.x += info.cx - pinch.cx;
      view.y += info.cy - pinch.cy;
    }
    pinch = info;
    scheduleRedraw();
  }
  function onTouchEnd(e) {
    if (!e.touches || e.touches.length < 2) { pinch = null; pinching = false; }
  }

  /* ------------------------------------------------------------------ *
   * 6. 悬停名字 / 观察节点 / 知识点卡片（用户第 7、8 条）
   *   · 划过任何一个知识点：手边跟着出现它的名字，左上角读数也换成它
   *     （"边上也出现对应的名字"）；
   *   · 点一下：这一格成为**观察节点**，右边弹出它的知识点卡片；
   *   · 卡片开着的时候拖视野：卡片跟着刷成**视野正中那一格**
   *     （"滑动的时候，卡片面板要不断刷新"）—— 边拖边看，不用先关掉再点。
   * ------------------------------------------------------------------ */

  var pin = -1;          /* 观察节点的下标（卡片正盯着的那一格） */
  var hoverIndex = -1;   /* 鼠标正划过的格子（读数两行也跟着它走，见 nowText / progressText） */

  /* 屏幕 x → 格子下标。一格的世界宽度是 1、中心在 i + 0.5，所以减掉半个再四舍五入 */
  function indexAt(sx) {
    if (!N || Math.abs(view.scale) < 1e-9) { return -1; }
    return Math.round(clamp((sx - view.x) / view.scale - 0.5, 0, N - 1));
  }

  /* 知识点编号：照参考图的写法（MATH-KP-0234） */
  function idOf(index) {
    var s = String(index + 1);
    while (s.length < 4) { s = '0' + s; }
    return 'MATH-KP-' + s;
  }

  /* 这一格在图谱里的完整路径：分段 / 年级 / 册 · 板块 / 章 / 节 / 知识点。
     相邻两级同名时只写一次（图谱里"章 = 节 = 知识点"同名很常见，
     比如 章"整式的加减" 底下又有 节"整式的加减"）。 */
  function pathOf(it) {
    var parts = [];
    for (var d = 0; d <= 4; d += 1) {
      var n = nameAt(it.chain, d);
      if (n && n !== it.name && parts[parts.length - 1] !== n) { parts.push(n); }
    }
    parts.push(it.name);
    return parts.join(' / ');
  }

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) { node.className = cls; }
    if (text !== undefined && text !== null) { node.textContent = text; }
    return node;
  }

  /* 光标旁的小气泡：只有名字和一行状态，别挡住轴 */
  function showHover(index, sx, sy) {
    /* 换格才重画：划过时鼠标一动就是几十次 pointermove，格没换还重画白烧帧 */
    if (index !== hoverIndex) { scheduleRedraw(); }
    hoverIndex = index;
    var it = ITEMS[index];
    if (!it || !hoverEl) { return; }
    var rec = it.rec;
    hoverEl.textContent = '';
    hoverEl.appendChild(el('span', 'tk-hover__name', it.name));
    if (rec) {
      hoverEl.appendChild(el('span', 'tk-hover__meta',
        rec.status + (rec.mastery ? ' · 掌握 ' + rec.mastery + '%' : '') + ' · 难度 ' + rec.diff.toFixed(1)));
    }
    hoverEl.hidden = false;
    /* 贴着光标，靠右时翻到左边，别顶出屏幕 */
    var w = hoverEl.offsetWidth || 180;
    hoverEl.style.left = Math.max(8, Math.min(sx + 14, view.w - w - 8)) + 'px';
    hoverEl.style.top = Math.max(8, sy - 46) + 'px';
    syncReadout();
  }

  function hideHover() {
    var was = hoverIndex >= 0;
    hoverIndex = -1;
    if (hoverEl) { hoverEl.hidden = true; }
    if (was) { scheduleRedraw(); }
    syncReadout();
  }

  /* 选中一格 = 观察节点 + 弹出知识点卡片 */
  function select(index) {
    if (index < 0 || index >= N) { return; }
    pin = index;
    renderCard(index);
    if (cardEl) { cardEl.hidden = false; }
    placeWin('card');                 /* 先摆好位置再让它量高度（首次打开要量一次才知道边界） */
    syncMatrixPick();                 /* 方阵上那一格也圈起来（同一个"观察节点"） */
    scheduleRedraw();
  }

  function closeCard() {
    pin = -1;
    if (cardEl) { cardEl.hidden = true; }
    syncMatrixPick();
    scheduleRedraw();
  }

  /* ---------- 四张浮层（知识点卡片 / 筛选 / 时间段对比 / 方阵）的位置：可拖、拖过之后记住 ----------
     照白板那一套：屏幕像素定位、标题栏当抓手、拖动中挂 is-dragging、
     松手把位置写进 localStorage。
     图例**不在这里** —— 它不是面板，是工具条正上方那一行（见 7c）。 */

  var WIN_KEY = 'wkmath.timeline.v1';
  var SIDE_GAP = 74;              /* 右侧那条竖工具条的占地（18 + 46 + 余量）：浮层默认躲开它 */
  var WIN_KEYS = ['card', 'filter', 'terms', 'matrix'];
  var winAt = { card: null, filter: null, terms: null, matrix: null };
  var winDrag = null;

  function winEl(which) {
    if (which === 'filter') { return filtersEl; }
    if (which === 'terms') { return termsEl; }
    if (which === 'matrix') { return matrixEl; }
    return cardEl;
  }
  function winHead(which) {
    if (which === 'filter') { return filtersHead; }
    if (which === 'terms') { return termsHead; }
    if (which === 'matrix') { return matrixHead; }
    return cardHead;
  }

  function loadWinAt() {
    winAt = { card: null, filter: null, terms: null, matrix: null };
    try {
      var raw = window.localStorage.getItem(WIN_KEY);
      var got = raw ? JSON.parse(raw) : null;
      if (!got) { return; }
      /* 早先只有卡片一张，存的是直接一个 {left, top} —— 认一下，别把用户拖好的位置丢了。
         老版本里还存过 legend 的位置，现在图例不是面板了，那条读进来也没有用，直接忽略。 */
      if (typeof got.left === 'number') { winAt.card = { left: got.left, top: got.top }; }
      WIN_KEYS.forEach(function (k) { if (got[k]) { winAt[k] = got[k]; } });
    } catch (err) { winAt = { card: null, filter: null, terms: null, matrix: null }; }
  }

  function saveWinAt() {
    try { window.localStorage.setItem(WIN_KEY, JSON.stringify(winAt)); } catch (err) { /* 忽略 */ }
  }

  /* 默认摆位：卡片靠右上、筛选靠右中（两张各占一边，不打架）；
     不论默认还是拖过的位置，都夹在舞台里 —— 拖出去就够不着了。
     两张都在右边，都要让开那条竖工具条，不然会被压在它下面。 */
  function placeWin(which) {
    var el = winEl(which);
    if (!el || el.hidden) { return; }
    var w = el.offsetWidth || 280;
    var h = el.offsetHeight || 160;
    if (!winAt[which]) {
      /* 四张各占一个角：左列"看全局"（方阵在上、筛选在下），右列"看一格"（卡片在上、
         时间段在下）—— 每列上下一张，开两张也不打架。位置拖过之后按记下来的走。 */
      var rightCol = view.w - w - SIDE_GAP;
      var leftCol = Math.max(8, rightCol - w - 12);
      var bottom = Math.max(20, view.h - h - 96);
      if (which === 'matrix') {
        winAt[which] = { left: leftCol, top: 72 };
      } else if (which === 'filter') {
        winAt[which] = { left: leftCol, top: bottom };
      } else if (which === 'terms') {
        winAt[which] = { left: rightCol, top: bottom };
      } else {
        winAt[which] = { left: rightCol, top: 72 };
      }
    }
    winAt[which].left = clamp(winAt[which].left, 8, Math.max(8, view.w - w - 8));
    winAt[which].top = clamp(winAt[which].top, 8, Math.max(8, view.h - h - 8));
    el.style.left = Math.round(winAt[which].left) + 'px';
    el.style.top = Math.round(winAt[which].top) + 'px';
  }

  function winDown(which, e) {
    var el = winEl(which);
    if (!winAt[which]) { placeWin(which); }
    if (!winAt[which]) { return; }
    /* 抓手是标题栏的**空白处**，不是标题栏里的控件。
       点到 ✕ 上就交给它自己处理 —— 不躲开的话，这一下会被标题栏吃掉：
       `setPointerCapture` 之后浏览器把后面那个 click 改派给了捕获元素（标题栏），
       ✕ 自己的 click 根本不响，"面板拖得动、却关不掉"。白板的 winDown 里就是这条
       （那里连 tab / 注释开关一起躲），这里是 ✕ 一个按钮，按同一口径躲整类控件。 */
    var t = e.target;
    if (t && typeof t.closest === 'function' &&
        t.closest('button, a, input, select, textarea, [contenteditable="true"]')) {
      return;
    }
    winDrag = {
      which: which, id: e.pointerId,
      sx: e.clientX, sy: e.clientY,
      ax: winAt[which].left, ay: winAt[which].top
    };
    if (el) { el.classList.add('is-dragging'); }
    var head = winHead(which);
    if (head && typeof head.setPointerCapture === 'function') {
      try { head.setPointerCapture(e.pointerId); } catch (err) { /* 忽略 */ }
    }
    /* 这里**不** preventDefault（与白板一致）：标题栏靠 CSS 的 user-select / touch-action
       挡住选中与手势，preventDefault 会把里面那颗 ✕ 的点击一起挡掉。 */
  }

  function winMove(which, e) {
    if (!winDrag || winDrag.which !== which) { return; }
    if (e.pointerId !== undefined && e.pointerId !== winDrag.id) { return; }
    winAt[which].left = winDrag.ax + (e.clientX - winDrag.sx);
    winAt[which].top = winDrag.ay + (e.clientY - winDrag.sy);
    placeWin(which);
    if (typeof e.preventDefault === 'function') { e.preventDefault(); }
  }

  function winUp(which, e) {
    if (!winDrag || winDrag.which !== which) { return; }
    if (e && e.pointerId !== undefined && e.pointerId !== winDrag.id) { return; }
    var el = winEl(which);
    if (el) { el.classList.remove('is-dragging'); }
    winDrag = null;
    saveWinAt();
  }

  /* 每个抓手各挂各的（把名字闭包进去）—— 比在事件里 closest() 反查更稳 */
  function bindWinDrag() {
    WIN_KEYS.forEach(function (which) {
      var head = winHead(which);
      if (!head || !head.addEventListener) { return; }
      head.addEventListener('pointerdown', function (e) { winDown(which, e); });
      head.addEventListener('pointermove', function (e) { winMove(which, e); });
      head.addEventListener('pointerup', function (e) { winUp(which, e); });
      head.addEventListener('pointercancel', function (e) { winUp(which, e); });
    });
  }

  function renderCard(index) {
    var it = ITEMS[index];
    if (!it || !cardBox) { return; }
    var rec = it.rec;
    /* 标题栏（也是抓手）：名字 + ✕ + 抓手图标，与白板面板同构 */
    if (cardName) { cardName.textContent = it.name; }
    if (cardSubject) {
      cardSubject.textContent = idOf(index) + (rec ? ' · ' + rec.status : '');
    }
    cardBox.textContent = '';
    if (!rec) {
      cardBox.appendChild(el('p', 'tk-card__empty', '这一格还没有学习记录'));
      return;
    }

    var meta = el('div', 'tk-card__meta');
    /* 状态徽标就是**这档状态色的文字**。2026-09-30 中途试过"填色块 + 深字"
       （那会儿颜色是亮纯色，当文字压在白卡上读不清）；后来深色底板撤了、七档回到
       "自己就看得清"的明度，这一块又不用了 —— 颜色当文字正好。 */
    var badge = el('span', 'tk-card__badge', rec.status);
    badge.style.color = statusColor(rec.status);
    meta.appendChild(badge);
    meta.appendChild(el('span', 'tk-card__mastery tk-mono',
      rec.mastery ? '掌握度 ' + rec.mastery + '%' : '还没开始'));
    cardBox.appendChild(meta);

    var bar = el('div', 'tk-card__bar');
    var fill = el('span', 'tk-card__bar-fill');
    fill.style.width = rec.mastery + '%';
    fill.style.background = statusColor(rec.status);
    bar.appendChild(fill);
    cardBox.appendChild(bar);

    /* 标记（用户 2026-09-30）：**学员自己贴的**（重点 / 难点 / 待复习）点一下就贴上、
       再点一下摘掉，几个可以同时挂着；"前置未满足"是**系统算的**，只当一行说明摆着 ——
       点不动、也摘不掉（它是提醒，不是自评）。 */
    var markBox = el('div', 'tk-card__marks');
    markBox.appendChild(el('div', 'tk-card__label', '我的标记'));
    var chips = el('div', 'tk-card__marks-row');
    var mine = rec.marks || [];
    ((window.WK_LEARNING && window.WK_LEARNING.ownMarks) ? window.WK_LEARNING.ownMarks() : [])
      .forEach(function (m) {
      var on = mine.indexOf(m.key) >= 0;
      var b = el('button', 'tk-mark' + (on ? ' is-on' : ''));
      b.type = 'button';
      b.setAttribute('data-tk-mark', m.key);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      var ic = document.createElement('i');
      ic.setAttribute('data-lucide', m.icon);
      ic.setAttribute('aria-hidden', 'true');
      if (on) { ic.style.color = readColor(m.token); }
      b.appendChild(ic);
      b.appendChild(document.createTextNode(m.name));
      b.addEventListener('click', (function (k) {
        return function () { tapMark(index, k); };
      }(m.key)));
      chips.appendChild(b);
    });
    markBox.appendChild(chips);
    if (rec.blocked) {
      var sys = markOf('block');
      var sysRow = el('div', 'tk-card__mark-sys');
      var sIcon = document.createElement('i');
      sIcon.setAttribute('data-lucide', sys ? sys.icon : 'lock');
      sIcon.setAttribute('aria-hidden', 'true');
      if (sys) { sIcon.style.color = readColor(sys.token); }
      sysRow.appendChild(sIcon);
      sysRow.appendChild(document.createTextNode(
        (sys ? sys.name : '前置未满足') + ' · 系统判定，不能自己改'));
      markBox.appendChild(sysRow);
    }
    cardBox.appendChild(markBox);
    refreshIcons();

    /* 五因子：掌握度是这五项加权出来的 —— 权重与分数都摆出来，别让它像个黑箱 */
    if (rec.factors && window.WK_LEARNING && window.WK_LEARNING.factors) {
      var box = el('div', 'tk-card__factors');
      box.appendChild(el('div', 'tk-card__label', '掌握度五因子'));
      window.WK_LEARNING.factors.forEach(function (f) {
        var row = el('div', 'tk-card__factor');
        row.appendChild(el('span', 'tk-card__factor-name', f.name));
        row.appendChild(el('span', 'tk-card__factor-weight tk-mono', Math.round(f.weight * 100) + '%'));
        var track = el('span', 'tk-card__factor-track');
        var dot = el('span', 'tk-card__factor-dot');
        dot.style.width = Math.max(2, rec.factors[f.key]) + '%';
        dot.style.background = statusColor(rec.status);
        track.appendChild(dot);
        row.appendChild(track);
        row.appendChild(el('span', 'tk-card__factor-value tk-mono', rec.factors[f.key]));
        box.appendChild(row);
      });
      cardBox.appendChild(box);
    }

    var rows = el('dl', 'tk-card__rows');
    [['难度', rec.diff.toFixed(1)],
     ['卡片', (rec.cards || []).length + ' 张'],
     ['学习日', rec.learnedAt || '还没学'],
     ['下次复习', rec.reviewAt || '—']
    ].forEach(function (p) {
      rows.appendChild(el('dt', null, p[0]));
      rows.appendChild(el('dd', null, p[1]));
    });
    cardBox.appendChild(rows);

    cardBox.appendChild(el('div', 'tk-card__path', pathOf(it)));

    /* 卡片：这个知识点内部再细分就是这些（概念 / 公式 / 例题 / 变式 / 错题 / 复习） */
    var cards = rec.cards || [];
    if (cards.length) {
      var list = el('div', 'tk-card__cards');
      list.appendChild(el('div', 'tk-card__label', '卡片 ' + cards.length + ' 张'));
      cards.forEach(function (c) {
        var row = el('div', 'tk-card__card');
        row.appendChild(el('span', 'tk-card__card-no tk-mono', (c.no < 10 ? '0' : '') + c.no));
        row.appendChild(el('span', 'tk-card__card-type', c.type));
        row.appendChild(el('span', 'tk-card__card-acc tk-mono', c.acc + '%'));
        row.appendChild(el('span', 'tk-card__card-diff tk-mono', '难度 ' + c.diff.toFixed(1)));
        var st = el('span', 'tk-card__card-state', c.status);
        st.style.color = statusColor(c.status);
        row.appendChild(st);
        row.appendChild(el('span', 'tk-card__card-at tk-mono', c.at));
        list.appendChild(row);
      });
      cardBox.appendChild(list);
    }
  }

  /* 卡片里点一下某颗标记：改数据 → 重画卡片（按下态）→ 重画轴（那一格的小图标）。
     两处都要刷：卡片是"我改了没有"的回执，轴上是这个改动的**结果**。 */
  function tapMark(index, key) {
    if (toggleMark(index, key) === null) { return; }
    renderCard(index);
    scheduleRedraw();
  }

  /* ------------------------------------------------------------------ *
   * 6b. 两种节点在轴上怎么画（用户第 10 条："当前我们学习的节点和当前观察的节点
   *     要有不同的颜色划分出来，然后在数轴上进行展示"）
   *
   *   · **当前学习节点**（学到哪儿了）—— 主色（绿，跟参考图的"当前 0328"一致）**实心**；
   *   · **当前观察节点**（点出来的那一格）—— 墨色**空心**。
   *
   *   两套颜色**加上形状**（实心 / 空心 + 标签底不同）一起分，不靠颜色一条腿走路：
   *   色弱、或者图例不在眼前时，也分得清"这是事实"还是"我在看"。
   * ------------------------------------------------------------------ */

  var now = -1;              /* 当前学习节点：最后一个有学习记录的格子 */

  function findNow() {
    now = -1;
    for (var i = 0; i < N; i += 1) {
      var rec = ITEMS[i].rec;
      if (rec && rec.status !== '未开始') { now = i; }
    }
    return now;
  }

  /* 圆角矩形（胶囊标签用） */
  function roundRect(x, y, w, h, r) {
    var rr = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.lineTo(x + w - rr, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
    ctx.lineTo(x + w, y + h - rr);
    ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
    ctx.lineTo(x + rr, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
    ctx.lineTo(x, y + rr);
    ctx.quadraticCurveTo(x, y, x + rr, y);
    ctx.closePath();
  }

  /* 节点上方那颗胶囊：写"当前 0336" / "观察 0301"。实心的填节点色、字走底色 */
  function nodeTag(text, x, y, color, filled) {
    ctx.font = worldFont(600, 10.5);
    var pad = px(7);
    var h = px(18);
    var w = ctx.measureText(text).width + pad * 2;
    roundRect(x - w / 2, y - h, w, h, px(9));
    if (filled) {
      ctx.fillStyle = color;
      ctx.fill();
      ctx.fillStyle = C.background;
    } else {
      ctx.strokeStyle = color;
      ctx.lineWidth = px(1);
      ctx.stroke();
      ctx.fillStyle = color;
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y - h / 2);
  }

  /* 一个节点：竖引导线（从标签一路穿到标签区）+ 上方的胶囊 + 轴上那颗点 */
  function markNode(index, color, tag, filled, tagY) {
    var x = ITEMS[index].x;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.globalAlpha = filled ? 0.5 : 0.3;
    ctx.lineWidth = px(1);
    ctx.beginPath();
    ctx.moveTo(x, tagY);
    /* 刻度与文字关掉时，下面没有东西可指 —— 引线收到轴上为止（不然吊一条长线进空白） */
    ctx.lineTo(x, state.levels ? px(LABEL_BOTTOM + 10) : 0);
    ctx.stroke();
    ctx.globalAlpha = 1;
    if (filled) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, px(DOT_ROW), px(DOT_R + 1.8), 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.strokeStyle = color;
      ctx.lineWidth = px(1.8);
      ctx.beginPath();
      ctx.arc(x, px(DOT_ROW), px(DOT_R + 4), 0, Math.PI * 2);
      ctx.stroke();
    }
    nodeTag(tag, x, tagY, color, filled);
    ctx.restore();
  }

  function drawNodes() {
    if (!N) { return; }
    var tagY = px(-barScreen() - 26);            /* 标签落在彩条上方那一条空带上 */
    if (now >= 0) {
      markNode(now, C.primary, '当前 ' + idOf(now).slice(-4), true, tagY);
    }
    /* 观察的正是学习节点时就不重复画了 —— 实心那颗就是它 */
    if (pin >= 0 && pin !== now) {
      markNode(pin, C.ink, '观察 ' + idOf(pin).slice(-4), false, tagY + px(24));
    }
  }

  /* 划过的那一格：**一根竖线 + 把那一颗点擦亮**（用户 2026-09-30：
     "他不是一个点吗？然后可以用根线……随着 hover 激活那个点的颜色，或者说让那个点亮一点……
      给人一个提示：我 hover 的时候，对应的那个点在变 —— 要不然名字变，他也不知道是啥意思"）。
     为什么非要有这个：划过时名字会变（光标旁的气泡 + 左上角两行读数），可名字指的是哪一格，
     屏幕上没有任何东西在动 —— 学生只看得出"字变了"。竖线指位置、亮起来的那颗点指对象，
     两样凑齐，名字才有着落。
     点用**系统色**（`--math-primary`）：与"当前学习"那颗节点同一支色，换高亮色它跟着换。
     一格都没有时（N = 0）恒不画；正在拖视野时也不画（那时候指针是在"推视野"，不是在指某一格）。 */
  function drawHoverMark() {
    if (!N || drag || hoverIndex < 0 || !ITEMS[hoverIndex]) { return; }
    var x = ITEMS[hoverIndex].x;
    var y = px(DOT_ROW);
    ctx.save();
    /* 竖线：**短一些、精致一些**，且上下都穿过轴（用户 2026-09-30："这根线太长了，
       往上太长了……不光往上，还可以往下降，但是短一点，感觉精致一点"）。
       所以只从轴上方 26px 拉到轴下那排点再往下一点，不再一路顶到彩条顶上。 */
    ctx.globalAlpha = 0.55;
    ctx.strokeStyle = C.primary;
    ctx.lineWidth = px(1);
    ctx.beginPath();
    ctx.moveTo(x, px(-26));
    ctx.lineTo(x, px(DOT_ROW + 7));
    ctx.stroke();
    ctx.globalAlpha = 1;
    /* 那颗点：先用底色擦掉原来那颗（不然两颗挤在一起像重影），再画一颗更大、更亮的 */
    ctx.fillStyle = C.background;
    ctx.beginPath();
    ctx.arc(x, y, px(DOT_R + 3.2), 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = C.primary;
    ctx.beginPath();
    ctx.arc(x, y, px(DOT_R + 1.4), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /* ------------------------------------------------------------------ *
   * 7. 浮层与工具条
   * ------------------------------------------------------------------ */

  /* ---------- 7c. 图例条与四类特殊标记（重点 / 难点 / 待复习 / 前置未满足） ----------
     图例的位置与形态是用户 2026-09-29 定的：**不是面板**，就写在底部工具条正上方那一行，
     挨着排（"它不是个面板，直接写在这块中间这块区域就行"）。七档状态色的颜色从令牌解出来，
     所以换主题 / 换高亮色它跟着走（用户第 12 条："这些图例、样板、小按钮之类的，
     你都可以参考白板的那些。"）。 */

  function markList() {
    return (window.WK_LEARNING && window.WK_LEARNING.marks) || [];
  }

  function markOf(key) {
    var list = markList();
    for (var i = 0; i < list.length; i += 1) {
      if (list[i].key === key) { return list[i]; }
    }
    return null;
  }

  /* 标记的颜色 / 图标都从数据层那一份定义来（DOM 与画布共用，不会一个样一个样） */
  function markColor(key) {
    var m = markOf(key);
    return readColor(m ? m.token : '--math-ink-4');
  }

  /* 动态插进来的 lucide 图标要再喊一次 createIcons 才会变成 svg（白板、侧栏也是这么做的） */
  function refreshIcons() {
    if (window.lucide && window.lucide.createIcons) {
      try { window.lucide.createIcons(); } catch (err) { /* 忽略 */ }
    }
  }

  /* 图例条的内容：七档掌握度色块 + 四类标记（带小图标）。
     它不是面板 —— 就是工具条正上方那一行，所以这里只填内容、不管位置。 */
  function buildLegend() {
    if (legendStates) {
      legendStates.textContent = '';
      ((window.WK_LEARNING && window.WK_LEARNING.status) || []).forEach(function (s) {
        var item = el('span', 'tk-legend__item');
        var swatch = el('span', 'tk-legend__swatch');
        swatch.style.background = statusColor(s.name);
        item.appendChild(swatch);
        item.appendChild(document.createTextNode(s.name));
        legendStates.appendChild(item);
      });
    }
    if (legendMarks) {
      legendMarks.textContent = '';
      markList().forEach(function (m) {
        var item = el('span', 'tk-legend__item');
        item.style.color = readColor(m.token);
        var icon = document.createElement('i');
        icon.setAttribute('data-lucide', m.icon);
        icon.setAttribute('aria-hidden', 'true');
        item.appendChild(icon);
        item.appendChild(document.createTextNode(m.name));
        legendMarks.appendChild(item);
      });
    }
    refreshIcons();
  }

  function syncLegendButton() {
    if (!btnLegend) { return; }
    var open = !!(legendEl && !legendEl.hidden);
    btnLegend.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) { btnLegend.classList.add('is-on'); } else { btnLegend.classList.remove('is-on'); }
  }

  /* 打开图例条时把「网格与尺寸」那个浮层收掉 —— 它俩占的是同一块地方（工具条正上方），
     一起开就会叠在一起。反过来见 togglePop()。 */
  function setLegend(on) {
    if (!legendEl) { return; }
    legendEl.hidden = !on;
    if (on) { buildLegend(); closePop(); }
    syncLegendButton();
  }

  function toggleLegend() {
    setLegend(!!legendEl && legendEl.hidden);
  }

  /* ------------------------------------------------------------------ *
   * 7b. 右侧控制栏（用户第 14 条）：筛选 / 刻度与文字 / 信息面板 / 阶段
   * ------------------------------------------------------------------ */

  /* ---------- 筛选 ----------
     筛掉的格子**只是画淡**，不从轴上消失 —— 用户定过的口径是"数轴永远是一条完整的
     数轴"。所以这里只回答"这一格算不算命中"，画的时候按它调透明度。 */

  /* 难度 1.0–5.0 → 五档（四舍五入：1.0–1.5 算第 1 档，4.5–5.0 算第 5 档） */
  function diffBucket(diff) {
    return clamp(Math.round(diff || 1), 1, 5);
  }

  function filterOn() {
    var f = state.filter;
    return !!(f.status.length || f.diff.length || f.mark.length || f.term.length);
  }

  function passFilter(rec) {
    if (!filterOn() || !rec) { return true; }
    var f = state.filter;
    if (f.status.length && f.status.indexOf(rec.status) < 0) { return false; }
    if (f.diff.length && f.diff.indexOf(diffBucket(rec.diff)) < 0) { return false; }
    /* 标记这一维：一格可能同时挂着好几个标记（多选），**沾上一个就算命中** ——
       选了"难点"就该把它也捞出来，哪怕它还同时挂着"重点"。没标过的自然一个都不沾，
       也就留不下来（"只看我标过的"）。 */
    if (f.mark.length) {
      var mk = marksOf(rec);
      var hit = false;
      for (var q = 0; q < f.mark.length; q += 1) {
        if (mk.indexOf(f.mark[q]) >= 0) { hit = true; }
      }
      if (!hit) { return false; }
    }
    /* 时间段这一维：没学过的格子没有日期（term 空串），选了月份就留不下来 */
    if (f.term.length && f.term.indexOf(rec.term || '') < 0) { return false; }
    return true;
  }

  function filteredCount() {
    if (!filterOn()) { return 0; }
    var n = 0;
    for (var i = 0; i < N; i += 1) {
      if (ITEMS[i].rec && !passFilter(ITEMS[i].rec)) { n += 1; }
    }
    return n;
  }

  /* 小胶囊：复用网格那套（.tk-grid）的样式 —— 同一个页面里不该出现两种胶囊。
     deco 是"记号"：{ dot:'颜色' } 给色点（掌握度七档），{ icon:'lucide 名', color } 给小图标
     （四类标记）—— 与图例条上那一排是同一套记号，看的人不用来回认。 */
  function chipButton(text, on, onClick, deco) {
    var node = el('button', 'tk-grid' + (on ? ' is-on' : ''));
    node.type = 'button';
    if (deco && deco.dot) {
      var dot = el('span', 'tk-chip__dot');
      dot.style.background = deco.dot;
      node.appendChild(dot);
    } else if (deco && deco.icon) {
      var ic = document.createElement('i');
      ic.setAttribute('data-lucide', deco.icon);
      ic.setAttribute('aria-hidden', 'true');
      if (deco.color) { ic.style.color = deco.color; }
      node.appendChild(ic);
    }
    node.appendChild(document.createTextNode(text));
    node.setAttribute('aria-pressed', on ? 'true' : 'false');
    node.addEventListener('click', onClick);
    return node;
  }

  /* 三行胶囊：掌握度七档 + 难度五档 + 四类标记。
     **不选 = 不筛**（不是"全选"：空着才是一眼就懂的默认）。 */
  function buildFilters() {
    var i;
    if (filterStatusBox) {
      filterStatusBox.textContent = '';
      ((window.WK_LEARNING && window.WK_LEARNING.status) || []).forEach(function (s) {
        var on = state.filter.status.indexOf(s.name) >= 0;
        filterStatusBox.appendChild(chipButton(s.name, on, function () { toggleFilter('status', s.name); },
          { dot: statusColor(s.name) }));
      });
    }
    if (filterDiffBox) {
      filterDiffBox.textContent = '';
      for (i = 1; i <= 5; i += 1) {
        (function (bucket) {
          var on = state.filter.diff.indexOf(bucket) >= 0;
          filterDiffBox.appendChild(chipButton('难度 ' + bucket, on, function () { toggleFilter('diff', bucket); }));
        }(i));
      }
    }
    if (filterMarkBox) {
      filterMarkBox.textContent = '';
      markList().forEach(function (m) {
        var on = state.filter.mark.indexOf(m.key) >= 0;
        filterMarkBox.appendChild(chipButton(m.name, on, function () { toggleFilter('mark', m.key); },
          { icon: m.icon, color: readColor(m.token) }));
      });
    }
    refreshIcons();
  }

  function toggleFilter(dim, value) {
    var arr = state.filter[dim];
    var at = arr.indexOf(value);
    if (at >= 0) { arr.splice(at, 1); } else { arr.push(value); }
    syncFilters();
  }

  function clearFilter() {
    state.filter.status = [];
    state.filter.diff = [];
    state.filter.mark = [];
    syncFilters();
  }

  /* 筛选变了：重画胶囊、刷新落款（筛掉多少格）、换按钮上的提示、重画数轴 */
  function syncFilters() {
    buildFilters();
    var n = filteredCount();
    if (filtersSubject) {
      filtersSubject.textContent = filterOn()
        ? '筛掉 ' + n + ' 格 —— 只是变淡，不从轴上消失'
        : '筛选那几行都空着 = 都不筛（整条轴原样）';
    }
    if (btnFilter) {
      btnFilter.setAttribute('data-tk-tip', filterOn() ? '筛选 · 已筛掉 ' + n + ' 格' : '筛选');
    }
    syncFilterButton();    /* 亮不亮由它统一算：面板开着 或 有筛的维度 */
    syncTerms();          /* 时间段对比卡里的"选中"状态与筛选是同一份数据 */
    scheduleRedraw();
  }

  /* 筛选按钮的亮/暗有**两个**来源（用户 2026-09-30 报的："激活筛选面板的时候，
     筛选按钮还是不显示的状态，这不对"）：一是面板开着，二是筛里确实选了维度。
     两条都归这里算 —— 分两处各管一半，迟早会出现"关了面板但还在筛，按钮灭了"这种错。 */
  function syncFilterButton() {
    if (!btnFilter) { return; }
    var open = !!filtersEl && !filtersEl.hidden;
    btnFilter.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open || filterOn()) { btnFilter.classList.add('is-on'); } else { btnFilter.classList.remove('is-on'); }
  }

  function setFilterPanel(on) {
    if (!filtersEl) { return; }
    filtersEl.hidden = !on;
    /* 卡片一开：先刷新胶囊（阶段那排在卡片里，开之前 syncStageChips 是一次都不建的）、
       再把整张卡摆回可视区 */
    if (on) { syncFilters(); syncStageChips(true); placeWin('filter'); }
    syncFilterButton();
  }

  function toggleFilterPanel() {
    setFilterPanel(!!filtersEl && filtersEl.hidden);
  }

  /* ---------- 刻度与文字 / 信息面板：两颗直接开关（不弹面板） ---------- */
  function syncLevelsButton() {
    if (!btnLevels) { return; }
    btnLevels.setAttribute('aria-pressed', state.levels ? 'true' : 'false');
    btnLevels.setAttribute('data-tk-tip', state.levels ? '刻度与文字 · 显示中' : '刻度与文字 · 已隐藏');
    if (state.levels) { btnLevels.classList.add('is-on'); } else { btnLevels.classList.remove('is-on'); }
  }

  function setLevels(on) {
    state.levels = !!on;
    syncLevelsButton();
    recenter();          /* 竖向要重摆：关掉刻度就不用给它留位了（缩放不动，用户看的地方不跳） */
  }

  function syncReadoutButton() {
    if (!btnReadout) { return; }
    btnReadout.setAttribute('aria-pressed', state.readout ? 'true' : 'false');
    btnReadout.setAttribute('data-tk-tip', state.readout ? '信息面板 · 显示中' : '信息面板 · 已隐藏');
    if (state.readout) { btnReadout.classList.add('is-on'); } else { btnReadout.classList.remove('is-on'); }
  }

  function setReadout(on) {
    state.readout = !!on;
    if (leftEl) { leftEl.hidden = !state.readout; }
    syncReadoutButton();
  }

  /* ---------- 阶段：把某一段刚好铺满屏幕 ----------
     注意这**不是筛选**：筛选只让格子变淡，这个换的是视野（"跳过去看那一段"）。
     竖向照旧不缩（轴钉在屏幕上，见 zoomAt 的注释），所以只算横向；view.fit 也不动 ——
     它是缩放读数里那个 100% 的基准，"跳到小学段"之后读数显示 480% 才是老实话。 */
  function stageRange(stage) {
    var list = SEGS[0] || [];
    for (var i = 0; i < list.length; i += 1) {
      if (list[i].stage === stage) { return { from: list[i].start, to: list[i].end }; }
    }
    return null;
  }

  function focusStage(stage) {
    if (stage) {
      var r = stageRange(stage);
      if (!r) { return false; }
      var pad = 72;
      var world = (r.to - r.from) + 2.4;
      var s = clamp((view.w - pad * 2) / Math.max(1, world), MIN_SCALE, MAX_SCALE);
      view.scale = s;
      view.x = pad + ((view.w - pad * 2) - world * s) / 2 - (r.from - 1.2) * s;
      recenter();
    } else {
      fitContent();          /* "全部" = 回到整条数轴 */
    }
    /* 读数是同步刷的（重画是下一帧 rAF 的事）—— 不然点完"全部"，右上那颗 271% 还挂着 */
    syncReadout();
    return true;
  }

  /* 哪一段"正看着"是**由视野算出来的**，不是记一个状态 —— 手动拖走之后那颗胶囊会自己灭掉，
     不会出现"亮着、可屏幕上是别处"这种撒谎。判据：这一段盖住了视野的大半。 */
  function currentStage() {
    var list = SEGS[0] || [];
    var vFrom = -view.x / view.scale;
    var vTo = (view.w - view.x) / view.scale;
    var span = Math.max(1e-6, vTo - vFrom);
    for (var i = 0; i < list.length; i += 1) {
      var seg = list[i];
      var overlap = Math.min(seg.end, vTo) - Math.max(seg.start, vFrom);
      if (overlap > span * 0.6) { return seg.stage; }
    }
    return '';
  }

  function buildStages(cur) {
    if (!stageChips) { return; }
    stageChips.textContent = '';
    stageChips.appendChild(chipButton('全部', !cur, function () { focusStage(''); syncStageChips(true); }));
    (SEGS[0] || []).forEach(function (seg) {
      stageChips.appendChild(chipButton(seg.name, cur === seg.stage, function () {
        focusStage(seg.stage);
        syncStageChips(true);
      }));
    });
  }

  /* 那排胶囊在筛选卡里：**卡片开着的时候才刷新**，而且只在"看着哪一段"真的变了才重建 DOM
     （拖动时每帧都会走到这里）。卡片一开就 force 一次 —— 那之前它一直是空的。 */
  var lastStage = null;
  function syncStageChips(force) {
    if (!filtersEl || filtersEl.hidden || !stageChips) { return; }
    var cur = currentStage();
    if (!force && cur === lastStage) { return; }
    lastStage = cur;
    buildStages(cur);
  }

  /* ------------------------------------------------------------------ *
   * 7d. 时间段对比（用户第 13 条）
   *   "一月份、二月份、三月份、四月份或者某个时间段，我们可以通过这个时间段来进行
   *   时间的对比，也就是不同时间段我们对时间轴的掌握程度可以进行对比。"
   *   一个**学期**一行，条子长 = 那个学期的**平均掌握**，右边写"已学几格 · 掌握多少%"——
   *   一屏之内就能比出哪个学期学得扎实。点一行 = 把"时间段"加进筛选（只看那个学期学过的格子），
   *   再点取消；这样这件事既在面板里看得出，也落到轴上比对（其余格子变淡）。
   * ------------------------------------------------------------------ */

  function termList() {
    if (!LEARN || !window.WK_LEARNING || !window.WK_LEARNING.terms) { return []; }
    return window.WK_LEARNING.terms(LEARN);
  }

  /* '2020-上' → '2020 上'（学年 + 学期）。
     粒度是**学期**不是月：12 年的学时按月切是 69 个格子，这张卡与筛选胶囊都摆不下；
     按学期切是 12 个，也正好对上"一学期一次期中 / 期末"的真实节奏。 */
  function termLabel(term) {
    return String(term).replace('-', ' ');
  }

  /* 平均掌握 → 那一档的颜色（条子与轴上同一个语言） */
  function statusOfMastery(v) {
    var L = window.WK_LEARNING;
    return statusColor(L && L.stateOf ? L.stateOf(v) : '未开始');
  }

  function buildTerms() {
    if (!termsBody) { return; }
    termsBody.textContent = '';
    var list = termList();
    if (!list.length) {
      termsBody.appendChild(el('p', 'tk-card__empty', '这份记录里还没有学习日期'));
      return;
    }
    list.forEach(function (m) {
      var on = state.filter.term.indexOf(m.term) >= 0;
      var row = el('button', 'tk-term' + (on ? ' is-on' : ''));
      row.type = 'button';
      row.setAttribute('aria-pressed', on ? 'true' : 'false');
      row.appendChild(el('span', 'tk-term__label', termLabel(m.term)));
      var track = el('span', 'tk-term__track');
      var fill = el('span', 'tk-term__fill');
      fill.style.width = Math.max(2, m.avg) + '%';
      fill.style.background = statusOfMastery(m.avg);
      track.appendChild(fill);
      row.appendChild(track);
      row.appendChild(el('span', 'tk-term__meta', '已学 ' + m.learned + ' 格 · ' + m.avg + '%'));
      row.setAttribute('title', m.term + ' · 已学 ' + m.learned + ' 格 · 平均掌握 ' +
        m.avg + '% · 卡片 ' + m.cards + ' 张');
      row.addEventListener('click', function () { toggleFilter('term', m.term); });
      termsBody.appendChild(row);
    });
  }

  function syncTermsSubject() {
    if (!termsSubject) { return; }
    var picked = state.filter.term;
    termsSubject.textContent = picked.length
      ? '只看 ' + picked.map(termLabel).join(' / ') + ' 学过的格子'
      : '条子长 = 那个学期的平均掌握；点一行只留那个学期';
  }

  /* 筛选一变就跟着刷（只在面板开着时重建 DOM） */
  function syncTerms() {
    if (!termsEl || termsEl.hidden) { return; }
    buildTerms();
    syncTermsSubject();
  }

  function syncTermsButton() {
    if (!btnTerms) { return; }
    var open = !!(termsEl && !termsEl.hidden);
    btnTerms.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) { btnTerms.classList.add('is-on'); } else { btnTerms.classList.remove('is-on'); }
  }

  function setTermsPanel(on) {
    if (!termsEl) { return; }
    termsEl.hidden = !on;
    if (on) { buildTerms(); syncTermsSubject(); placeWin('terms'); }
    syncTermsButton();
  }

  function toggleTermsPanel() {
    setTermsPanel(!!termsEl && termsEl.hidden);
  }

  /* ------------------------------------------------------------------ *
   * 7e. 方阵（用户第 18 条）
   *   "出现的那个块就类似于打卡，或者说是去买电影票的时候填座位……这一块一共有 18 个块"
   *   一格 = 一个知识点，18 列铺开，颜色 = 掌握情况；
   *   点一格就打开那个知识点的卡片（§8 ④：不在方阵上改数据）。
   *   颜色就是方阵的内容（"掌握了就是绿的"），所以这一处不受「掌握度」那颗开关管。
   * ------------------------------------------------------------------ */

  var MATRIX_COLS = 18;        /* 一排 18 个方块（用户第 18 条原话） */
  var matrixCells = null;      /* [[下标, 方块], …]：点选时只改那一格的圈，不整片重建 */

  /* 方阵里放哪些格：**当前这一学段**（视野所在的那一段）；视野横跨好几段时退回整条轴 */
  function matrixRange() {
    var stage = currentStage();
    var r = stage ? stageRange(stage) : null;
    return { from: r ? r.from : 0, to: r ? r.to : N, stage: stage || '' };
  }

  function buildMatrix() {
    if (!matrixBody) { return; }
    matrixBody.textContent = '';
    matrixCells = [];
    var r = matrixRange();
    var grid = el('div', 'tk-matrix__grid');
    grid.style.gridTemplateColumns = 'repeat(' + MATRIX_COLS + ', 1fr)';
    for (var i = r.from; i < r.to && i < N; i += 1) {
      (function (index) {
        var it = ITEMS[index];
        var rec = it.rec;
        var status = rec ? rec.status : '未开始';
        var cell = el('button', 'tk-cell');
        cell.type = 'button';
        cell.style.background = statusColor(status);
        cell.setAttribute('title', idOf(index).slice(-4) + ' ' + it.name + ' · ' + status +
          (rec ? ' · 掌握 ' + rec.mastery + '%' : ''));
        cell.setAttribute('aria-label', it.name + ' · ' + status);
        cell.addEventListener('click', function () { select(index); });
        grid.appendChild(cell);
        matrixCells.push([index, cell]);
      }(i));
    }
    matrixBody.appendChild(grid);
    if (matrixSubject) {
      matrixSubject.textContent = (r.stage ? (STAGE_CN[r.stage] || '') + '段' : '整条数轴') +
        ' · ' + (r.to - r.from) + ' 格 · 颜色 = 掌握情况';
    }
    syncMatrixPick();
  }

  /* 观察节点（点出来的那一格）在方阵上圈一下 —— 与轴上的"观察节点"是同一个 */
  function syncMatrixPick() {
    if (!matrixCells) { return; }
    for (var k = 0; k < matrixCells.length; k += 1) {
      var pair = matrixCells[k];
      if (pair[0] === pin) { pair[1].classList.add('is-on'); }
      else { pair[1].classList.remove('is-on'); }
    }
  }

  function syncMatrixButton() {
    if (!btnMatrix) { return; }
    var open = !!(matrixEl && !matrixEl.hidden);
    btnMatrix.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) { btnMatrix.classList.add('is-on'); } else { btnMatrix.classList.remove('is-on'); }
  }

  function setMatrixPanel(on) {
    if (!matrixEl) { return; }
    matrixEl.hidden = !on;
    if (on) { buildMatrix(); placeWin('matrix'); }
    syncMatrixButton();
  }

  function toggleMatrixPanel() {
    setMatrixPanel(!!matrixEl && matrixEl.hidden);
  }

  /* ------------------------------------------------------------------ *
   * 7f. 缩略条（用户第 9 条）
   *   "如果放大了，就需要在底部菜单的上方出现一个竖轴的一个偏缩略的、实时动态显示的
   *   当前屏幕所展示的数轴范围，也就是表示当前数轴的范围。"
   *   做法（2026-09-30 问过用户之后定的）：**横着**贴着底部工具条上方铺一条；
   *   **只在放大之后出现** —— 屏幕上装不下整条轴时才浮出来，点"适配"或缩到能看全时自己收起。
   *   底子是按掌握情况上色的 769 根小竖线（"缩略的轴"）+ 四个学段的名字，
   *   上面那个方框 = 屏幕上正显示的范围（框外压一层暗幕）。
   * ------------------------------------------------------------------ */

  /* 上一次画底子时的"指纹"：宽度 + 掌握度开关 + 主题底色 + 看的是谁。
     这四个里任一个变了底子就得重画，其余时候（拖动、缩放）只挪那个方框。 */
  var miniPaintKey = '';
  var miniDrag = null;

  /* "如果放大了" —— 屏幕上装不下整条轴的时候才出现（适配档 / 缩到能看全时自己收起） */
  function miniZoomed() { return view.scale > view.fit * 1.02; }

  function drawMiniStrip() {
    if (!miniStrip || !miniEl || miniEl.hidden) { return; }
    miniPaintKey = miniStamp();
    var dpr = view.dpr || 1;
    var w = Math.max(1, Math.round(miniStrip.clientWidth || 1));
    var h = Math.max(1, Math.round(miniStrip.clientHeight || 1));
    if (miniStrip.width !== Math.round(w * dpr)) {
      miniStrip.width = Math.round(w * dpr);
      miniStrip.height = Math.round(h * dpr);
    }
    var g = miniStrip.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    var cw = w / N;
    /* 杆身（底色）是 CSS 给的一层**中性灰**，这里只画杆底那条**学段刻度尺**：
       四个学段各一支色、`ruler` 那么高（2px 上下）。
       三轮下来才定成这个样子：第一版学段色只铺下面 1/3（"只搞了一半儿"），
       第二版铺满整条（又太花），第三版用户点名要"底色弄成灰色 / 黑色，滑块弄成系统色" ——
       于是底色交给 CSS，学段色退成一条刻度尺（学段认色不认字，见 §2.11 ⑲）。 */
    var ruler = Math.max(2, Math.round(h * 0.2));
    (SEGS[0] || []).forEach(function (seg) {
      g.fillStyle = stageColor(seg.stage);
      g.fillRect(seg.start * cw, h - ruler, Math.max(1, (seg.end - seg.start + 1) * cw), ruler);
    });
  }

  /* 实时同步：出现 / 收起、方框位置、下面那行"视野 第 x – y 格"、无障碍读数 */
  function syncMini() {
    if (!miniEl) { return; }
    var zoomed = miniZoomed();
    miniEl.hidden = !zoomed;
    if (!zoomed) { return; }
    var r = visibleIndexRange();
    var from = Math.max(0, r.from);
    var to = Math.min(N - 1, r.to);
    if (miniWin) {
      /* 滑块的宽度 = **屏幕上能装下多少格**（视口宽 ÷ 一格的世界宽）——
         也就是"整条轴里这一屏占了多大一段"。它**只跟缩放有关，拖动时不跟着变**。
         第一版是拿"屏幕上那几格"（visibleIndexRange）算的：拖到两头时视野有一半落在轴外，
         那个区间被夹短，滑块就跟着忽宽忽窄 —— 用户报的"拖动滑块的时候时间轴抖动"，
         除了读数抢宽度那一半，另一半就是这个。位置也夹在轨道里，滑块不越界。 */
      var span = Math.max(1, view.w / view.scale);
      var widthPct = Math.min(100, Math.max(1.2, span / N * 100));
      var leftPct = Math.max(0, Math.min(100 - widthPct, (-view.x / view.scale) / N * 100));
      miniWin.hidden = false;
      miniWin.style.left = leftPct + '%';
      miniWin.style.width = widthPct + '%';
    }
    if (miniRangeEl) {
      /* 读数写成"视野 363–681 / 共 769"（用户 2026-09-30 那张参考图里的写法）——
         杆子细了，一行短句才挨得住 */
      miniRangeEl.textContent = '视野 ' + (from + 1) + '–' + (to + 1) + ' / 共 ' + N;
    }
    if (miniTrack) {
      miniTrack.setAttribute('aria-valuemin', '1');
      miniTrack.setAttribute('aria-valuemax', String(N));
      miniTrack.setAttribute('aria-valuenow', String(from + 1));
      miniTrack.setAttribute('aria-valuetext', '第 ' + (from + 1) + ' 到 ' + (to + 1) + ' 格');
    }
    if (miniStamp() !== miniPaintKey) { drawMiniStrip(); }
  }

  /* 缩略条底子的"指纹"：这几样里任一个变了才值得重画那条学段刻度尺。
     学段色算在指纹里 —— 换主题 / 换高亮色时 C.stage 会重解，
     不带上的话刻度尺还是上一套的色。
     名字带 Stamp 是有意的 —— 别跟键盘处理 miniKey 撞名（撞过一次：
     两个同名 function 后写的赢，于是 drawMiniStrip 里无参调用 miniKey() 直接炸）。 */
  function miniStamp() {
    var w = Math.max(1, Math.round(miniStrip ? (miniStrip.clientWidth || 1) : 1));
    var stage = Object.keys(STAGE_TOKEN).map(function (k) { return stageColor(k); }).join(',');
    return [w, C.background, stage].join('|');
  }

  /* 点在缩略条上的位置 → 0..1（0 = 第 1 格，1 = 最后一格）。
     `box` 可选：拖动期间传**按下那一刻量到的**那一份（见 miniDown）——
     整段拖动只量一次，"手指按在哪儿"与"看到的是哪一段"就不会中途错位。 */
  function miniAt(clientX, box) {
    if (!miniTrack) { return 0; }
    if (!box) { box = miniTrack.getBoundingClientRect(); }
    var t = (clientX - box.left) / Math.max(1, box.width);
    return Math.max(0, Math.min(1, t));
  }

  /* 点一下 / 拖一下 = 把视野挪过去：缩放不动，只左右平移（缩略条也能当路标用） */
  function miniJump(t) {
    view.x = view.w / 2 - (t * N) * view.scale;
    scheduleRedraw();
  }

  function miniDown(e) {
    if (e.pointerType === 'mouse' && typeof e.button === 'number' && e.button !== 0) { return; }
    if (typeof e.preventDefault === 'function') { e.preventDefault(); }
    if (miniTrack && typeof miniTrack.setPointerCapture === 'function') {
      try { miniTrack.setPointerCapture(e.pointerId); } catch (err) { /* 忽略 */ }
    }
    /* 杆子的位置与宽度**在按下的这一刻量一次**，整段拖动都用这一份 ——
       拖动中每帧重新量的话，只要布局有一丁点变化（读数换了、窗口改了、杆子被别的东西挤到），
       百分比映射就跟着漂，时间轴就抖（用户报的"拖动滑块的时候时间轴抖动"）。
       两个保险：读数已经从杆子右边挪到上一行、杆子宽度定死；这里再把映射也冻住。 */
    miniDrag = { id: e.pointerId, box: miniTrack ? miniTrack.getBoundingClientRect() : null };
    miniJump(miniAt(e.clientX, miniDrag.box));
  }

  function miniMove(e) {
    if (!miniDrag || miniDrag.id !== e.pointerId) { return; }
    miniJump(miniAt(e.clientX, miniDrag.box));
  }

  function miniUp(e) {
    if (!miniDrag || miniDrag.id !== e.pointerId) { return; }
    miniDrag = null;
    if (miniTrack && typeof miniTrack.releasePointerCapture === 'function') {
      try { miniTrack.releasePointerCapture(e.pointerId); } catch (err) { /* 忽略 */ }
    }
  }

  /* 键盘也能用（它是 role="slider"）：左右各挪视野的四分之一屏 */
  function miniKey(e) {
    var d = e.key === 'ArrowRight' ? 1 : (e.key === 'ArrowLeft' ? -1 : 0);
    if (!d) { return; }
    e.preventDefault();
    view.x -= d * view.w * 0.25;
    scheduleRedraw();
  }

  function closePop() {
    if (pop) { pop.hidden = true; }
    if (popBtn) { popBtn.setAttribute('aria-expanded', 'false'); popBtn.classList.remove('is-on'); }
  }
  function togglePop() {
    if (!pop || !popBtn) { return; }
    var open = pop.hidden;
    closeHelp();
    setLegend(false);        /* 与图例条抢同一块地方（工具条正上方）：开一个就收另一个 */
    pop.hidden = !open;
    popBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) { popBtn.classList.add('is-on'); } else { popBtn.classList.remove('is-on'); }
  }
  function closeHelp() {
    if (help) { help.hidden = true; }
    if (btnHelp) { btnHelp.setAttribute('aria-expanded', 'false'); btnHelp.classList.remove('is-on'); }
  }
  function toggleHelp() {
    if (!help || !btnHelp) { return; }
    var open = help.hidden;
    closePop();
    help.hidden = !open;
    btnHelp.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) { btnHelp.classList.add('is-on'); } else { btnHelp.classList.remove('is-on'); }
  }

  function syncGridButton() {
    if (!btnGrid) { return; }
    btnGrid.setAttribute('aria-pressed', state.grid ? 'true' : 'false');
    if (state.grid) { btnGrid.classList.add('is-on'); } else { btnGrid.classList.remove('is-on'); }
    btnGrid.setAttribute('data-tk-tip', '网格 · ' + (state.grid ? state.gridSize : '关'));
  }

  function buildGridChips() {
    if (!gridBox) { return; }
    gridBox.textContent = '';
    GRID_STEPS.forEach(function (size) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tk-grid';
      btn.setAttribute('data-tk-grid', String(size));
      btn.setAttribute('role', 'radio');
      btn.setAttribute('aria-label', size + ' 个知识点一格');
      var chip = document.createElement('span');
      chip.className = 'tk-grid__chip';
      chip.setAttribute('aria-hidden', 'true');
      btn.appendChild(chip);
      btn.appendChild(document.createTextNode(size + ''));
      btn.addEventListener('click', function () {
        state.gridSize = size;
        state.grid = true;
        syncGridButton();
        syncGridChips();
        closePop();
        scheduleRedraw();
      });
      gridBox.appendChild(btn);
    });
    syncGridChips();
  }

  function syncGridChips() {
    if (!gridBox) { return; }
    Array.prototype.forEach.call(gridBox.querySelectorAll('.tk-grid'), function (btn) {
      var on = Number(btn.getAttribute('data-tk-grid')) === state.gridSize;
      btn.classList.toggle('is-on', on);
      btn.setAttribute('aria-checked', on ? 'true' : 'false');
    });
  }

  /* 掌握度彩条层：默认关，按一下才显示（用户点名要有按钮控制）。
     按钮上的提示会把当前状态和"要不要放大"讲清楚 —— 关着的时候点了才知道会发生什么。 */
  function syncMasteryButton() {
    if (!btnMastery) { return; }
    btnMastery.setAttribute('aria-pressed', state.mastery ? 'true' : 'false');
    if (state.mastery) { btnMastery.classList.add('is-on'); } else { btnMastery.classList.remove('is-on'); }
    btnMastery.setAttribute('data-tk-tip', '掌握度彩条 · ' + (state.mastery ? '显示中' : '已隐藏'));
  }

  function toggleMastery() {
    state.mastery = !state.mastery;
    syncMasteryButton();
    scheduleRedraw();
  }

  /* 彩色条高度三档（低 / 中 / 高）—— 同一个浮层里的另一行 */
  function buildBarChips() {
    if (!barBox) { return; }
    barBox.textContent = '';
    BAR_LEVELS.forEach(function (lv, index) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tk-chip';
      btn.setAttribute('data-tk-bar', lv.key);
      btn.setAttribute('role', 'radio');
      btn.setAttribute('aria-label', '彩色条高度：' + lv.label);
      btn.textContent = lv.label;
      btn.addEventListener('click', function () {
        state.bar = index;
        syncBarChips();
        closePop();
        recenter();
      });
      barBox.appendChild(btn);
    });
    syncBarChips();
  }

  function syncBarChips() {
    if (!barBox) { return; }
    var key = (BAR_LEVELS[state.bar] || BAR_LEVELS[1]).key;
    Array.prototype.forEach.call(barBox.querySelectorAll('.tk-chip'), function (btn) {
      var on = btn.getAttribute('data-tk-bar') === key;
      btn.classList.toggle('is-on', on);
      btn.setAttribute('aria-checked', on ? 'true' : 'false');
    });
  }

  /* ---------- 数轴整体大小（用户 2026-09-30）----------
     "数轴它可以放大，但是数轴本身它大不了……那字都还比较小……加个按钮，哪怕加个那种滑块的按钮，
      就可以放大缩小数轴本身。"
     与底部那三颗「缩小 / 100% / 放大」是**两件事**，别混：
       · 那三颗走 `view.scale` —— 横向缩放，改变的是"一屏能看多少格"（看得更细）；
       · 这根滑块走 `state.axis` —— 轴本身的大小，轴、刻度、文字、点、彩条一起变大（看得更大）。 */
  function syncAxisControl() {
    var pct = Math.round(state.axis * 100);
    if (axisRange) { axisRange.value = String(pct); }
    if (axisValue) { axisValue.textContent = pct + '%'; }
  }

  function setAxis(scale) {
    var next = clamp(typeof scale === 'number' ? scale : parseFloat(scale), AXIS_MIN, AXIS_MAX);
    if (!isFinite(next)) { return state.axis; }
    state.axis = next;
    syncAxisControl();
    recenter();          /* 竖向要重排：轴上下要留的地方跟着变了 */
    return state.axis;
  }

  function bind() {
    if (btnGrid) {
      btnGrid.addEventListener('click', function () {
        state.grid = !state.grid;
        syncGridButton();
        scheduleRedraw();
      });
    }
    if (popBtn) { popBtn.addEventListener('click', function (e) { e.stopPropagation(); togglePop(); }); }
    /* 滑块拖动过程中就实时生效（不等松手），"拖到多大的字"才看得见 */
    if (axisRange) {
      axisRange.addEventListener('input', function () { setAxis(parseFloat(axisRange.value) / 100); });
      axisRange.addEventListener('change', function () { setAxis(parseFloat(axisRange.value) / 100); });
    }
    if (btnMastery) { btnMastery.addEventListener('click', function () { toggleMastery(); }); }
    if (btnLegend) { btnLegend.addEventListener('click', function () { toggleLegend(); }); }
    if (btnHelp) { btnHelp.addEventListener('click', function (e) { e.stopPropagation(); toggleHelp(); }); }
    if (btnOut) { btnOut.addEventListener('click', function () { zoomBy(1 / 1.3); }); }
    if (btnIn) { btnIn.addEventListener('click', function () { zoomBy(1.3); }); }
    if (btnFit) { btnFit.addEventListener('click', function () { fitContent(); }); }
    if (elZoom) { elZoom.addEventListener('click', function () { fitContent(); }); }

    /* 「学习计划设定」：用户点名先占个位（"你先加上一个按钮就行，你记录一下"）——
       功能本身还没定，所以这里只给一个明确的回应，不做任何假的界面。
       需求原文记在 docs/1.0-版本日志.md 的 §8「时间轴改版」里，等有了具体怎么设再说。 */
    if (btnPlan) {
      btnPlan.addEventListener('click', function () {
        if (window.MathSite && window.MathSite.toast) {
          window.MathSite.toast('「学习计划的时间轴设定」还没开发 —— 需求已记下，等你说怎么设', 'info');
        }
      });
    }

    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    /* **右键拖动 = 平移时间轴**（用户 2026-09-30），所以画布上得把浏览器的右键菜单按住 ——
       不然一按右键就弹出菜单，拖不动。 */
    canvas.addEventListener('contextmenu', function (e) {
      if (typeof e.preventDefault === 'function') { e.preventDefault(); }
    });
    canvas.addEventListener('pointerleave', hideHover);
    if (btnCardClose) { btnCardClose.addEventListener('click', function () { closeCard(); }); }

    /* 右侧控制栏（用户第 14 条） */
    if (btnFilter) { btnFilter.addEventListener('click', function () { toggleFilterPanel(); }); }
    if (btnFiltersClose) { btnFiltersClose.addEventListener('click', function () { setFilterPanel(false); }); }
    if (btnFilterClear) { btnFilterClear.addEventListener('click', function () { clearFilter(); }); }
    if (btnLevels) { btnLevels.addEventListener('click', function () { setLevels(!state.levels); }); }
    if (btnReadout) { btnReadout.addEventListener('click', function () { setReadout(!state.readout); }); }
    if (btnTerms) { btnTerms.addEventListener('click', function () { toggleTermsPanel(); }); }
    if (btnTermsClose) { btnTermsClose.addEventListener('click', function () { setTermsPanel(false); }); }
    if (btnMatrix) { btnMatrix.addEventListener('click', function () { toggleMatrixPanel(); }); }
    if (btnMatrixClose) { btnMatrixClose.addEventListener('click', function () { setMatrixPanel(false); }); }
    /* 缩略条：点 / 拖 / 键盘都能挪视野（与白板拖动同一套 pointer 写法） */
    if (miniTrack) {
      miniTrack.addEventListener('pointerdown', miniDown);
      miniTrack.addEventListener('pointermove', miniMove);
      miniTrack.addEventListener('pointerup', miniUp);
      miniTrack.addEventListener('pointercancel', miniUp);
      miniTrack.addEventListener('keydown', miniKey);
    }
    /* 四张浮层的抓手各挂各的（与白板同一套） */
    bindWinDrag();
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd);
    canvas.addEventListener('dblclick', function (e) {
      var p = canvasPoint(e);
      zoomAt(p.x, 1.8);
    });

    document.addEventListener('click', function (e) {
      var t = e.target;
      if (!t || !t.closest) { return; }
      /* 点在这两样里面就什么都不做：网格/高度弹层、帮助卡。
         （「阶段」原来也在这儿 —— 它现在住在筛选卡里，卡片自己管开合，不必单独放行。） */
      if (t.closest('#tk-pop') || t.closest('#tk-pop-toggle') ||
          t.closest('[data-tk-help]') || t.closest('#tk-help')) { return; }
      closePop();
      closeHelp();
    });

    document.addEventListener('keydown', function (e) {
      var tag = (document.activeElement && document.activeElement.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA') { return; }
      var step = 80;
      if (e.key === 'ArrowLeft') { view.x += step; scheduleRedraw(); }
      else if (e.key === 'ArrowRight') { view.x -= step; scheduleRedraw(); }
      else if (e.key === 'ArrowUp') { view.y += step; scheduleRedraw(); }
      else if (e.key === 'ArrowDown') { view.y -= step; scheduleRedraw(); }
      else if (e.key === '+' || e.key === '=') { zoomBy(1.3); }
      else if (e.key === '-' || e.key === '_') { zoomBy(1 / 1.3); }
      else if (e.key === '0') { fitContent(); }
      else if (e.key === 'g' || e.key === 'G') {
        state.grid = !state.grid;
        syncGridButton();
        scheduleRedraw();
      } else if (e.key === 'Escape') {
        closePop();
        closeHelp();
        closeCard();
        setLegend(false);
        setFilterPanel(false);
        setTermsPanel(false);
        setMatrixPanel(false);
      } else { return; }
      e.preventDefault();
    });

    /* 拖窗口重排：canvas 尺寸变了要重画（这里重画是整帧重来，本来就是按视野重绘的） */
    var tick = false;
    window.addEventListener('resize', function () {
      if (tick) { return; }
      tick = true;
      window.requestAnimationFrame(function () { tick = false; resize(); });
    });

    /* 显示设置改了（字号 / 配色 / 高亮色）要重取令牌再画 */
    document.addEventListener('wk:display', function () {
      readTheme();
      scheduleRedraw();
    });
  }

  /* ------------------------------------------------------------------ *
   * 启动
   * ------------------------------------------------------------------ */

  readTheme();
  loadWinAt();
  findNow();
  if (elNow) { elNow.textContent = nowText(); }
  if (elProgress) { elProgress.textContent = progressText(); }
  /* 光标不用 JS 起手：默认那个小圆圈写在 CSS 的 #tk-canvas 上（滚动 / 拖动时再加类换） */
  buildGridChips();
  buildBarChips();
  syncAxisControl();
  syncGridButton();
  syncMasteryButton();
  syncLegendButton();
  /* 右侧控制栏：四颗按钮的初始态（筛选胶囊也一次建好，弹面板时就不用等） */
  syncFilters();
  syncFilterButton();
  syncLevelsButton();
  syncReadoutButton();
  syncTermsButton();
  syncMatrixButton();
  renderWho();
  bind();
  resize();
  if (FRESH) { fitContent(); }

  /* 对外接口：自查与将来的跨页点名都要用（图谱页的 mindmap 也是这么留的） */
  window.WK_TIMELINE = {
    axis: axis,
    dotR: DOT_R,      /* 一颗点的屏幕半径 —— 划过时那颗要画得更大更亮，自检拿它当基准 */
    learn: LEARN,
    summary: SUMMARY,
    view: view,
    zoomAt: zoomAt,
    zoomBy: zoomBy,
    fit: fitContent,
    setGrid: function (on, size) {
      state.grid = !!on;
      if (size) { state.gridSize = size; }
      syncGridButton();
      syncGridChips();
      scheduleRedraw();
    },
    setBars: function (index) {
      state.bar = Math.max(0, Math.min(BAR_LEVELS.length - 1, index));
      syncBarChips();
      recenter();
    },
    setMastery: function (on) {
      state.mastery = !!on;
      syncMasteryButton();
      scheduleRedraw();
    },
    /* 数轴整体大小：传倍数（1 = 标准）—— 自检与将来的跨页点名都要用。
       注意别叫 `axis`：上面那个 `axis` 是**刻度数据**（六级刻度与它们的区间），
       两个同名会把刻度数据顶掉（踩过一次：整份自检崩在 `TK.axis.items` 上）。 */
    setAxis: setAxis,
    axisScale: function () { return state.axis; },
    select: select,
    closeCard: closeCard,
    setLegend: setLegend,
    viewer: function () { return WHO; },
    setFilter: function (status, diff, mark, term) {
      state.filter.status = status || [];
      state.filter.diff = diff || [];
      state.filter.mark = mark || [];
      state.filter.term = term || [];
      syncFilters();
    },
    markColor: markColor,
    /* 标记那一套（用户 2026-09-30）：一格挂哪些标、学员能改哪几类、点一下改成什么 */
    marksOf: marksOf,
    ownMarks: ownMarkKeys,
    tapMark: tapMark,
    markEdits: function () { return markEdits; },
    terms: termList,
    setTermsPanel: setTermsPanel,
    setMatrixPanel: setMatrixPanel,
    mini: function () {
      return {
        shown: !!(miniEl && !miniEl.hidden),
        range: miniRangeEl ? miniRangeEl.textContent : '',
        left: miniWin ? miniWin.style.left : '',
        width: miniWin ? miniWin.style.width : ''
      };
    },
    jumpMini: miniJump,
    filter: function () { return state.filter; },
    filtered: filteredCount,
    focusStage: focusStage,
    currentStage: currentStage,
    setLevels: setLevels,
    setReadout: setReadout,
    cardIndex: function () { return pin; },
    nowIndex: function () { return now; },
    barScreen: barScreen,
    redraw: redraw
  };
}());
