/* ==========================================================================
   时间轴 · 3D 学习时空（timeline-3d.js）
   --------------------------------------------------------------------------
   **这一版整段搬自参照原型**（用户 2026-09-30："能不能直接删掉我们开发的 3D 版本，
   然后用我发给你的那个嵌进去；数据按照我们的来用"）。

   搬过来的（写法、次序、系数都不动）：
     · 相机与投影：平移到盒子中心 → 绕垂直轴转 → 绕水平轴转 → 按深度缩放
       （`cameraDistance = 110`、盒子 100 × 22 × 20、夹下限 `Math.max(8, …)`）；
     · 取景：对称包围盒 `2 * max(|u|)`，宽度上给右侧面板留出 310px；
     · 两个轴**都不夹角度**，绕圈取模（它的注释：Wrap equivalent angles instead of clamping）；
     · 画法：地面 6 条难度线 + 11 条纵深线、难度层（五个水平面）、**考试切片**
       （一块竖直的板 + 覆盖点）、知识柱（bar + 基点）、X 轴、学段名、选中环；
     · 交互：拖动 = 转视角 / 平面视角下拖动 = 平移（Shift 或右键也是平移）、滚轮缩放、
       双击聚焦、点选知识点、指针命中判定。

   换掉的（也只换了这三样）：
     · **数据**：NODES / STAGES / EXAMS 全部由我们自己的东西适配 —— 知识点走
       `timeline-axis.js`（与平面同一根轴），学习记录与考试走 `timeline-data.js`；
       考试切片的覆盖点来自卷面本身（做错的点用"薄弱"色点出来）；
     · **时间**：原型是"90 天 + 底部天滑杆"，我们这条一样有底部时间条，只是滑杆走的是我们的
       K12 日期（一学年一格刻度）；拖动它，柱子那堵墙在时间里滑、滑过哪场就冒出哪块切片；
     · **状态**：原型的掌握度按天算，我们也按天算（从轨迹里取那一刻的值）；
     · **外壳与颜色**：左侧栏目、底部工具条、读数、考试分析面板还是我们那一套；
       颜色一律从 tokens.css 读（原型里写死的 hex 全部换成令牌），字号乘 --math-fs。
   ========================================================================== */

(function () {
  'use strict';

  var AX = window.WK_AXIS;
  var L = window.WK_LEARNING;
  if (!AX || !L || !AX.build) { return; }

  var DAY = 86400000;

  /* ==================================================================== *
   * 1. 数据：同一根轴 + 同一份记录 —— 只看当前学段
   * ==================================================================== */

  var axis = AX.build();
  var ALL = axis.items;

  var WHO = pickWho();
  var LEARN = L.build(ALL, L.forAccount ? learnOptions() : {});
  var PLAN = L.buildTimeline ? L.buildTimeline(ALL, LEARN, learnOptions()) : null;
  var SUMMARY = L.summary ? L.summary(LEARN) : null;

  var SPAN = spanOfStage();
  var ITEMS = viewItems(ALL, SPAN);
  var SEGS = viewSegs(axis.segs, SPAN);
  var N = ITEMS.length;
  var RANGE = [0, N - 1];

  function pickWho() {
    var u = (window.WK_SHELL && window.WK_SHELL.current) ? window.WK_SHELL.current() : null;
    if (u && u.name) {
      return { name: u.name, grade: u.grade || '', short: u.short || u.name.charAt(0), mine: true };
    }
    var s = (L.students && L.students[0]) || { name: '演示学生', grade: '', short: '演' };
    return { name: s.name, grade: s.grade || '', short: s.short || s.name.charAt(0), mine: false };
  }

  function learnOptions() {
    if (WHO.mine) {
      var o = L.forAccount ? L.forAccount(WHO) : {};
      o.startAt = '2020-09-01';
      o.endAt = '2026-06-30';
      return o;
    }
    return {};
  }

  /** 当前学段：最后一个已学的知识点落在哪一段（与平面那根轴同一口径） */
  function stageNow() {
    var last = (SUMMARY && SUMMARY.learned ? SUMMARY.learned : 1) - 1;
    var it = ALL[Math.max(0, Math.min(ALL.length - 1, last))];
    return (it && it.stage) || (ALL[0] && ALL[0].stage) || '';
  }

  function spanOfStage() {
    var stage = stageNow();
    var from = -1;
    var to = -1;
    ALL.forEach(function (it, i) {
      if (it.stage !== stage) { return; }
      if (from < 0) { from = i; }
      to = i + 1;
    });
    if (from < 0) { return { from: 0, to: ALL.length, stage: stage }; }
    return { from: from, to: to, stage: stage };
  }

  /* 视窗里的格子重新编号（id 就是视窗下标 —— 原型里 id 同时当数组下标与 x 坐标用） */
  function viewItems(all, span) {
    var out = [];
    for (var i = span.from; i < span.to; i += 1) {
      var it = all[i];
      out.push({
        name: it.name, kind: it.kind, stage: it.stage, chain: it.chain,
        i: out.length, x: out.length + 0.5
      });
    }
    return out;
  }

  function viewSegs(segs, span) {
    return segs.map(function (list) {
      var out = [];
      list.forEach(function (s) {
        var a = Math.max(s.start, span.from);
        var b = Math.min(s.end, span.to);
        if (b > a) {
          out.push({ depth: s.depth, name: s.name, start: a - span.from, end: b - span.from, stage: s.stage });
        }
      });
      return out;
    });
  }

  function recAt(i) { return LEARN[SPAN.from + i]; }
  function parseDay(text) {
    var p = String(text).split('-');
    if (p.length < 3) { return null; }
    return Date.UTC(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  }

  /** 落在视窗里的考试（整场都在这一段里才算） */
  function examsOfStage() {
    var all = (PLAN && PLAN.exams) ? PLAN.exams : [];
    return all.filter(function (e) { return e.from >= SPAN.from && e.to <= SPAN.to; });
  }

  /* 时间窗 = 这一段自己的那几年（第一册开学 → 最后一册读完），再往后留一个学年。
     原型的 Z 轴是"90 天"，我们这条是 K12 的学年学期 —— 单位换了，盒子不变。 */
  var T0 = 0;
  var T1 = 1;
  (function computeTime() {
    var min = Infinity;
    var max = -Infinity;
    var lastPlan = -Infinity;
    for (var g = SPAN.from; g < SPAN.to; g += 1) {
      var rg = LEARN[g];
      if (!rg) { continue; }
      var pl = rg.plannedAt ? parseDay(rg.plannedAt) : null;
      var lr = rg.learnedAt ? parseDay(rg.learnedAt) : null;
      if (pl) { min = Math.min(min, pl); max = Math.max(max, pl); lastPlan = Math.max(lastPlan, pl); }
      if (lr) { min = Math.min(min, lr); max = Math.max(max, lr); }
    }
    examsOfStage().forEach(function (e) { max = Math.max(max, e.at); });
    if (isFinite(lastPlan)) { max = Math.max(max, lastPlan + 270 * DAY); }
    T0 = isFinite(min) ? min : 0;
    T1 = isFinite(max) ? max : T0 + 1;
  }());

  function tOf(ms) { return Math.max(0, Math.min(1, (ms - T0) / Math.max(1, T1 - T0))); }
  /** 日期 → Z 轴上的位置（原型的 `e.day / 90 * 20`，盒子深度就是 20） */
  function zOf(ms) { return ms === null || ms === undefined ? 0 : tOf(ms) * 20; }

  /* 今天那一刀：柱子站在它上面（原型把"当天 ÷ 全程 × 盒子深度"叫 currentZ） */
  var TODAY = (PLAN && PLAN.today) ? parseDay(PLAN.today) : T1;

  /* ==================================================================== *
   * 2. 颜色：一律从 tokens.css 读（原型里写死的那几个常量换掉）
   * ==================================================================== */

  function readColor(name) {
    var v = getComputedStyle(document.documentElement).getPropertyValue(name);
    return (v || '').trim() || '#888';
  }

  var ink = readColor('--math-ink-2');
  var muted = readColor('--math-ink-4');
  var grid = readColor('--math-line');
  var accent = readColor('--math-primary');
  var weak = readColor('--math-bar-weak');
  var FS = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--math-fs')) || 1;
  var FONT = (getComputedStyle(document.documentElement).getPropertyValue('--math-font-sans') || '').trim() ||
             'sans-serif';

  /* 掌握状态（原型的 STATUS 是它自己那五档；我们直接用 2D 那一份，标签与颜色都同源） */
  var UNSEEN = '未开始';
  var STATUS = {};
  (L.status || []).forEach(function (s) {
    STATUS[s.name] = { label: s.name, color: readColor(s.token) };
  });

  /* ==================================================================== *
   * 3. 把我们的数据适配成原型要的三样：STAGES / NODES / EXAMS
   * ==================================================================== */

  /* STAGES：原型是四个学段（沿 X 轴 0–1200）。我们只看一个学段，所以这一级留给**年级** ——
     它的用处是"沿轴写那排名字"+（按学段着色时的）颜色。 */
  var STAGES = (SEGS[1] || []).map(function (seg) {
    return { id: seg.name, name: seg.name, start: seg.start, end: seg.end, color: accent, grades: [seg.name], topics: [] };
  });

  var NODES = ITEMS.map(function (it, i) {
    var r = recAt(i) || {};
    var grade = AX.nameAt(it.chain, 1) || '';
    return {
      id: i,
      code: 'KP-' + String(SPAN.from + i + 1).padStart(4, '0'),
      no: SPAN.from + i + 1,
      name: it.name,
      topic: it.name,
      grade: grade,
      book: AX.nameAt(it.chain, 2) || '',
      stage: grade,
      difficulty: Math.max(1, Math.min(5, r.diff || 1)),
      status: r.status || UNSEEN,
      mastery: r.mastery || 0
    };
  });

  var EXAMS = examsOfStage().map(function (e) {
    var wrong = {};
    e.paper.forEach(function (p) {
      var vi = p.index - SPAN.from;
      if (p.score * 5 < p.full * 3) { wrong[vi] = 1; }
    });
    return {
      id: e.id, name: e.name, day: e.at, date: e.date,
      range: [e.from - SPAN.from, e.to - SPAN.from - 1],
      coverage: e.paper.map(function (p) { return p.index - SPAN.from; }),
      wrong: wrong,
      total: e.paper.length,
      wrongN: Object.keys(wrong).length
    };
  });

  /** 考试覆盖点的颜色：做错的正红（原型那两行写的是 `i===409||i===432`，换成本场的对错） */
  function seedColor(i, ex) { return ex.wrong[i] ? weak : accent; }

  /* 场次名字表：读数与小卡里要把"考到哪几场"写成人看得懂的名字
     （整份考试表，不只视窗里的 —— 视窗外的场次也可能考到这一格） */
  var EXAM_NAME = {};
  ((PLAN && PLAN.exams) ? PLAN.exams : []).forEach(function (e) { EXAM_NAME[e.id] = e.name; });

  /** 这一格被哪几场考试考到过（原型那个 hover 卡只有名字 / 编号 / 难度 / 状态；
      用户 2026-09-30 要"知识点划过就出现考试的考点"，所以多一行"考到哪几场"。） */
  function examHits(i) {
    var rec = recAt(i);
    if (!rec || !rec.events) { return []; }
    var out = [];
    rec.events.forEach(function (ev) {
      if (ev.kind !== 'exam') { return; }
      out.push((EXAM_NAME[ev.exam] || ev.exam) + (ev.score * 5 < ev.full * 3 ? '（错）' : '（对）'));
    });
    return out;
  }

  /** 原型的状态是"按天算"的（它有天滑杆）；我们这条同样按天取 ——
      掌握度从轨迹里取**那一刻**的值（那时还没学过 = 未开始），状态按 2D 那份阈值分档。 */
  function masteryAtTime(i, at) {
    var rec = recAt(i);
    if (!rec || !rec.events || !rec.events.length) { return null; }
    var v = null;
    for (var k = 0; k < rec.events.length; k += 1) {
      if (rec.events[k].at <= at) { v = rec.events[k].mastery; } else { break; }
    }
    return v;
  }

  function statusOf(m) {
    var list = L.status || [];
    for (var k = 0; k < list.length; k += 1) {
      if (m >= list[k].min) { return list[k].name; }
    }
    return UNSEEN;
  }

  function nodeState(n) {
    var m = masteryAtTime(n.id, state.dayMs);
    if (m === null) { return { status: UNSEEN, mastery: null }; }
    return { status: statusOf(m), mastery: m };
  }

  /** 钉住某一场之后要"只留这一场彩色、其余灰显" —— 先把每一场覆盖了哪些格子摊成表 */
  var COVERED = {};
  EXAMS.forEach(function (e) {
    var set = {};
    e.coverage.forEach(function (k) { set[k] = 1; });
    COVERED[e.id] = set;
  });

  /* 难度五档：**不是"柱子多高"那种数字**，是一层一层的意思 ——
     基础 → 概念 → 应用 → 变化 → 综合（用户 2026-09-30："它不仅仅是柱子高度……
     而是因为它是基础层、概念层、应用层、变化层，应该是这个意思"）。
     色阶从 tokens.css 的 --math-lv-1…5 读（绿 / 蓝 / 黄 / 橙 / 红）。 */
  var LEVELS = [
    { no: 5, name: '综合层', token: '--math-lv-5' },
    { no: 4, name: '变化层', token: '--math-lv-4' },
    { no: 3, name: '应用层', token: '--math-lv-3' },
    { no: 2, name: '概念层', token: '--math-lv-2' },
    { no: 1, name: '基础层', token: '--math-lv-1' }
  ];
  /** 某个难度档的颜色（难度 1.0–5.0 → 最近的那一档） */
  function levelColor(diff) {
    var no = Math.max(1, Math.min(5, Math.round(diff)));
    return readColor('--math-lv-' + no);
  }

  /* ==================================================================== *
   * 4. 状态（与原型同形，去掉天滑杆与它那些侧栏视图）
   * ==================================================================== */

  var state = {
    view: 'space',             /* 用户 2026-09-30："直接进来就是 3D 的" —— 默认立体 */
    zoom: 1,
    yaw: -0.08,                /* 默认落点照原型 */
    pitch: 0.38,
    panX: 0, panY: 0, center: null,
    selected: Math.max(0, Math.min(N - 1, (SUMMARY && SUMMARY.learned ? SUMMARY.learned : 1) - 1 - SPAN.from)),
    hovered: null,
    render: 'bars',
    colorMode: 'status',
    proj: 'persp',             /* 我们对原型加的一档：persp / ortho */
    exam: null,                /* 钉住的那一场考试 */
    hoverExam: null,           /* 划过的那一场（给它描个边） */
    dayMs: TODAY,              /* 底部时间条：现在停在哪一天（原型是 state.day） */
    /* 五个难度层各自开关（右侧那条竖排按钮点的就是它们）；默认全关 */
    levels: [false, false, false, false, false],
    layers: { exams: true }
  };

  function levelOn(no) { return !!state.levels[no - 1]; }
  function levelAnyOn() { return state.levels.indexOf(true) >= 0; }

  /* 时间条的范围：这一段的第一天 → 最后一天，一天一格（原型是 0–90 天） */
  var DAY0 = T0;
  var DAY1 = T1;
  var DAY_N = Math.max(1, Math.round((DAY1 - DAY0) / DAY));
  function dayIndex(ms) { return Math.max(0, Math.min(DAY_N, Math.round((ms - DAY0) / DAY))); }

  function resetCamera() {
    state.zoom = 1;
    state.yaw = -0.08;
    state.pitch = 0.38;
    state.panX = 0;
    state.panY = 0;
    state.center = null;
  }

  function dispatch(a) {
    switch (a.type) {
      case 'zoom':
        state.zoom = Math.max(0.55, Math.min(24, a.value));
        syncZoomLabel();
        break;
      case 'pan': state.panX += a.dx; state.panY += a.dy; break;
      /* 两个轴都不夹角度（原型的注释：Wrap equivalent angles instead of clamping） */
      case 'orbit':
        state.yaw = (state.yaw + a.dx * 0.005) % (Math.PI * 2);
        state.pitch = (state.pitch + a.dy * 0.005) % (Math.PI * 2);
        break;
      case 'focus':
        state.selected = Math.max(0, Math.min(N - 1, a.id));
        state.center = state.selected;
        state.zoom = Math.max(0.55, Math.min(24, a.zoom));
        state.panX = 0;
        state.panY = 0;
        break;
      case 'select':
        state.selected = Math.max(0, Math.min(N - 1, a.id));
        break;
      /* 底部时间条：把"当前"挪到某一天（原型拖 timeInput 就是这一支） */
      case 'day':
        state.dayMs = Math.max(DAY0, Math.min(DAY1, a.at));
        break;
    }
    render();
  }

  /* ==================================================================== *
   * 5. 画布
   * ==================================================================== */

  var canvas = document.querySelector('[data-t3-canvas]');
  var ctx = canvas ? canvas.getContext('2d') : null;
  var size = { w: 1000, h: 600 };
  var view = { w: 1, h: 1, dpr: 1 };
  var hitRef = { current: [] };
  var pointerRef = { current: null };
  var viewRef = { current: null };

  function resize() {
    if (!canvas) { return; }
    var wrap = canvas.parentNode;
    size = { w: wrap.clientWidth || 1, h: wrap.clientHeight || 1 };
    view.w = size.w;
    view.h = size.h;
    view.dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(size.w * view.dpr);
    canvas.height = Math.round(size.h * view.dpr);
    canvas.style.width = size.w + 'px';
    canvas.style.height = size.h + 'px';
    render();
  }

  /* 时间刻度：沿 Z 那条棱，每学年一个年份（原型写的是"每 30 天一个日期"） */
  var TIME_TICKS = [];
  (function buildTicks() {
    var y0 = new Date(T0).getUTCFullYear();
    var y1 = new Date(T1).getUTCFullYear();
    for (var y = y0; y <= y1; y += 1) {
      var at = Date.UTC(y, 8, 1);
      if (at >= T0 && at <= T1) { TIME_TICKS.push({ z: zOf(at), label: (y - y0) % 2 === 0 ? String(y) : '' }); }
    }
  }());

  function render() {
    if (!ctx) { return; }
    var c = ctx;
    var w = size.w;
    var h = size.h;
    c.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    c.clearRect(0, 0, w, h);

    var range = RANGE;
    var span = N;
    var zoom = state.zoom;
    var originX = w * 0.5 + state.panX;
    var originY = h * (state.view === 'axis' ? 0.64 : 0.45) + state.panY;
    var theta = state.view === 'axis' ? 0 : state.yaw;
    var pitch = state.view === 'axis' ? 0 : state.pitch;
    var cos = Math.cos(theta);
    var sin = Math.sin(theta);
    var cp = Math.cos(pitch);
    var sp = Math.sin(pitch);
    var cameraDistance = 110;

    /* 旋转的**焦点**：没选中时是时间轴的中心（原型那份）；选中某一场之后，焦点搬到这一场身上
       （它在 X 上的中心 + 它那天的 Z）—— 用户 2026-09-30："选中了它，旋转的时候焦点就会以我
       选择的这个考试为中心……取消选择的时候焦点又会回到总的时间轴的中心。" */
    var center = state.center === null ? (range[0] + range[1]) / 2 : state.center;
    function xx(i) { return (i - center) / span * 100; }
    var pinnedInfo = null;
    EXAMS.forEach(function (e) { if (e.id === state.exam) { pinnedInfo = e; } });
    var pivotX = 0;
    var pivotZ = 10;
    if (pinnedInfo && state.view !== 'axis') {
      pivotX = xx((pinnedInfo.range[0] + pinnedInfo.range[1]) / 2);
      pivotZ = zOf(pinnedInfo.day);
    }

    /* ---- 投影：**照原型逐行**（平移到盒子中心 → 绕垂直轴 → 绕水平轴 → 按深度缩放） ---- */
    function project(x, y, z) {
      var cx = x - pivotX;
      var cy = state.view === 'axis' ? y : y - 11;
      var cz = state.view === 'axis' ? z : z - pivotZ;
      var rx = cx * cos + cz * sin;
      var rz = -cx * sin + cz * cos;
      var ry = cy * cp + rz * sp;
      var depth = rz * cp - cy * sp;
      var perspective = (state.view === 'axis' || state.proj === 'ortho')
        ? 1 : cameraDistance / Math.max(8, cameraDistance + depth);
      return { u: rx * perspective, v: ry * perspective, depth: depth };
    }

    /* ---- 取景：对称包围盒（转一圈都不跑偏），宽度上给右侧面板留 310px ---- */
    var corners = [];
    for (var cx = 0; cx < 2; cx += 1) {
      for (var cyy = 0; cyy < 2; cyy += 1) {
        for (var czz = 0; czz < 2; czz += 1) {
          corners.push(project([-50, 50][cx], [0, 22][cyy], [0, 20][czz]));
        }
      }
    }
    var maxU = 1;
    var maxV = 1;
    corners.forEach(function (pt) { maxU = Math.max(maxU, Math.abs(pt.u)); maxV = Math.max(maxV, Math.abs(pt.v)); });
    var projectedWidth = state.view === 'axis' ? 100 : 2 * maxU;
    var projectedHeight = state.view === 'axis' ? 22 : 2 * maxV;
    var availableHeight = state.view === 'axis' ? h : Math.max(160, 2 * Math.min(h * 0.45 - 85, h * 0.55 - 55));
    var sideW = w > 760 ? 310 : Math.min(120, w * 0.2);
    var baseScale = Math.min((w - sideW) / Math.max(100, projectedWidth),
                             availableHeight / Math.max(38, projectedHeight + 14)) * zoom;
    function p(x, y, z) {
      var pt = project(x, y, z || 0);
      return { x: originX + pt.u * baseScale, y: originY - pt.v * baseScale, depth: pt.depth };
    }
    viewRef.current = { xx: xx, p: p, project: project, w: w, h: h, range: range, span: span, baseScale: baseScale };

    function line(a, b, color, alpha, width, dash) {
      c.beginPath();
      c.moveTo(a.x, a.y);
      c.lineTo(b.x, b.y);
      c.strokeStyle = color || grid;
      c.globalAlpha = alpha === undefined ? 1 : alpha;
      c.lineWidth = width || 1;
      c.setLineDash(dash || []);
      c.stroke();
      c.setLineDash([]);
      c.globalAlpha = 1;
    }
    function text(t, a, color, align, font) {
      if (a.x < 10 || a.x > w - 10 || a.y < 16 || a.y > h - 10) { return; }
      c.fillStyle = color || muted;
      c.font = (font || 12) * FS + 'px ' + FONT;
      c.textAlign = align || 'left';
      c.fillText(t, a.x, a.y);
    }
    function polygon(points, color, alpha) {
      c.beginPath();
      points.forEach(function (pt, i) { return i ? c.lineTo(pt.x, pt.y) : c.moveTo(pt.x, pt.y); });
      c.closePath();
      c.fillStyle = color;
      c.globalAlpha = alpha === undefined ? 0.025 : alpha;
      c.fill();
      c.globalAlpha = 1;
    }

    var minX = xx(range[0]);
    var maxX = xx(range[1]);
    var dots = [];
    var selectedNode = null;
    var depth = state.view === 'axis' ? 0 : 20;
    var i;

    /* ---- 地面与坐标轴 ---- */
    if (state.view !== 'axis') {
      for (i = 0; i <= 5; i += 1) { line(p(minX, 0, i * 4), p(maxX, 0, i * 4), grid, 0.48); }
      for (i = 0; i <= 10; i += 1) {
        line(p(minX + (maxX - minX) * i / 10, 0, 0), p(minX + (maxX - minX) * i / 10, 0, depth), grid, 0.48);
      }
      line(p(minX, 0, 0), p(minX, 22, 0), grid, 0.8);
      line(p(maxX, 0, 0), p(maxX, 0, depth), grid, 0.9);
      text('Y · 综合难度', p(minX, 24, 0), ink, 'left', 13);
      var zEnd = p(maxX, 0, depth + 2);
      text('Z · 学习时间', { x: Math.min(w - 82, zEnd.x + 64), y: zEnd.y - 18 }, ink, 'right', 13);
      TIME_TICKS.forEach(function (t) {
        var pt = p(maxX, 0, t.z);
        if (t.label) { text(t.label, { x: Math.min(w - 82, pt.x + 64), y: pt.y }, muted, 'right', 11); }
      });
    } else {
      text('Y · 综合难度', p(minX, 22, 0), muted, 'left', 13);
    }

    /* ---- 难度层（原型那五个水平面）----
       每一层**自己一个颜色**（基础绿 / 概念蓝 / 应用黄 / 变化橙 / 综合红），
       点右边那条竖排按钮里的名字就开那一层（用户 2026-09-30）——
       不点就不出现，所以这里一层一层地判。 */
    var layerHeights = [4, 8, 12, 16, 20];
    if (levelAnyOn()) {
      layerHeights.map(function (y, k) { return { y: y, i: k, depth: p(0, y, 10).depth }; })
        .sort(function (a, b) { return b.depth - a.depth; })
        .forEach(function (o) {
          if (!levelOn(o.i + 1)) { return; }
          var tint = levelColor(o.i + 1);
          var points = [p(minX, o.y, 0), p(maxX, o.y, 0), p(maxX, o.y, depth), p(minX, o.y, depth)];
          polygon(points, tint, 0.06);
          points.forEach(function (pt, k) { line(pt, points[(k + 1) % 4], tint, 0.42); });
          text(LEVELS[4 - o.i].name, { x: points[0].x - 10, y: points[0].y + 4 }, tint, 'right', 12);
        });
    } else if (state.view === 'axis') {
      for (i = 1; i <= 5; i += 1) {
        text(String(i), { x: p(minX, i * 4).x - 15, y: p(minX, i * 4).y + 4 }, muted, 'right', 11);
      }
    }

    /* ---- 柱子钉在"当前那一天"那一刀上（原型跟着时间条走：拖时间条，这堵墙就在时间里滑） ---- */
    var currentZ = state.view === 'axis' ? 0 : zOf(state.dayMs);

    /* ---- 考试切片：一次考试 = 一块立在它那天的竖直板 + 覆盖点 ----
       时间条拖到哪一天，就只画**已经考过**的那些（原型 `e.day <= 当前那天`）。
       选中（钉住）某一场之后：只有这一场和它考到的那些知识点是彩色的，其余灰显；
       划过的那一场只把**边框描重**（用户 2026-09-30 定的两种状态）。 */
    var pinned = state.exam;
    var coveredByPinned = pinned ? COVERED[pinned] : null;
    if (state.layers.exams && state.view !== 'axis') {
      EXAMS.filter(function (e) { return e.day <= state.dayMs; })
        .sort(function (a, b) { return b.day - a.day; }).forEach(function (e) {
        var a = Math.max(range[0], e.range[0]) - 0.5;
        var b = Math.min(range[1], e.range[1]) + 0.5;
        var z = zOf(e.day);
        var hot = pinned === e.id;
        var hov = state.hoverExam === e.id;
        var dim = pinned !== null && !hot;
        var pts = [p(xx(a), 0, z), p(xx(b), 0, z), p(xx(b), 21, z), p(xx(a), 21, z)];
        polygon(pts, accent, hot ? 0.05 : hov ? 0.032 : dim ? 0.006 : 0.018);
        pts.forEach(function (pt, k) {
          line(pt, pts[(k + 1) % 4], accent, hot ? 0.42 : hov ? 0.6 : dim ? 0.06 : 0.18, (hot || hov) ? 1.6 : 1);
        });
        if (dim) { return; }                    /* 灰显的那几场：连覆盖点都不画 */
        e.coverage.filter(function (k) { return k >= range[0] && k <= range[1]; }).forEach(function (k) {
          var pt = p(xx(k), NODES[k].difficulty * 4, z);
          /* 选中这一场：板上每个考点**用一条曲线连到对应柱子的顶**（照原型"前置关联"那套画法）——
             一看就知道这几道题考的是哪几根柱子（用户 2026-09-30） */
          if (hot) {
            var top = p(xx(k), NODES[k].difficulty * 4, currentZ);
            c.beginPath();
            c.moveTo(pt.x, pt.y);
            c.bezierCurveTo(pt.x, pt.y - 22, top.x, top.y - 22, top.x, top.y);
            c.strokeStyle = levelColor(NODES[k].difficulty);
            c.globalAlpha = 0.5;
            c.lineWidth = 1;
            c.stroke();
            c.globalAlpha = 1;
          }
          c.beginPath();
          c.arc(pt.x, pt.y, hot ? 3 : 2, 0, Math.PI * 2);
          c.fillStyle = seedColor(k, e);
          c.globalAlpha = hot ? 0.8 : hov ? 0.5 : 0.3;
          c.fill();
          c.globalAlpha = 1;
          dots.push({ x: pt.x, y: pt.y, id: k, exam: e.id, r: 5 });
        });
        /* 选中这一场：柱子**底部再往外**排出一串考点点 + 知识点名字 ——
           点的颜色 = 它那一档难度（绿蓝黄橙红），做错的再套一圈红；
           高度（在 X 轴上的位置）本来就是这个知识点在轴上的位置，点高 = 难度。
           名字一行行写，写不下就跳过（照原型给 topic 写字那套防重叠）。 */
        if (hot) {
          var labelRight = -1e9;
          e.coverage.filter(function (k) { return k >= range[0] && k <= range[1]; }).forEach(function (k) {
            var nd = NODES[k];
            if (!nd) { return; }
            var row = k % 2;
            var q = p(xx(k), 0, currentZ + 2.5 + row * 2.2);
            var bad = !!e.wrong[k];
            var lc = levelColor(nd.difficulty);
            c.beginPath();
            c.arc(q.x, q.y, bad ? 3.4 : 2.6, 0, Math.PI * 2);
            c.fillStyle = lc;
            c.fill();
            if (bad) {
              c.beginPath();
              c.arc(q.x, q.y, 5.2, 0, Math.PI * 2);
              c.strokeStyle = weak;
              c.lineWidth = 1.4;
              c.stroke();
            }
            var need = nd.name.length * 11 * FS + 8;
            if (q.x - need / 2 > labelRight) {
              text(nd.name, { x: q.x, y: q.y + (row ? 27 : 16) }, bad ? weak : ink, 'center', 11);
              labelRight = q.x + need / 2;
            }
            dots.push({ x: q.x, y: q.y, id: k, exam: e.id, r: 6 });
          });
        }
        dots.push({ quad: pts, id: -1, exam: e.id, r: 0 });
        /* 考试的名字**默认不写**，划到或钉住时才出现（用户 2026-09-30） */
        if (hot || hov) { text(e.name, { x: pts[3].x, y: pts[3].y - 10 }, accent, 'left', 12); }
      });
    }

    /* ---- 知识柱（原型：一根竖线 + 基点） ---- */
    var step = zoom < 1.5 ? Math.max(1, Math.floor(span / 570)) : 1;
    var previous = null;
    var plotNodes = NODES.filter(function (n) {
      return n.id % step === 0 || n.id === state.selected || n.id === state.hovered;
    });
    plotNodes.forEach(function (n) {
      var st = nodeState(n);
      var s = STAGES.filter(function (g) { return g.id === n.stage; })[0];
      var color = state.colorMode === 'stage' ? ((s && s.color) || accent)
                                              : ((STATUS[st.status] || {}).color || muted);
      if (st.status === UNSEEN && state.colorMode === 'stage') { color = (STATUS[UNSEEN] || {}).color || muted; }
      /* 钉住了某一场：**只有它考到的那些格子留着彩色**，别的一律灰下去（用户 2026-09-30：
         "只有这一个切片和对应的知识点是彩色的，其他的就灰显" —— 这样才突出得了） */
      var off = coveredByPinned !== null && !coveredByPinned[n.id];
      var pos = p(xx(n.id), n.difficulty * 4, currentZ);
      var base = p(xx(n.id), 0, currentZ);
      if (pos.x < -10 || pos.x > w + 10) { previous = null; return; }
      if (state.render === 'ribbon' && previous && previous.n.id + step >= n.id) {
        line(previous.pos, pos, off ? grid : color, off ? 0.1 : 0.68, 1.4);
      }
      if (state.render === 'bars') {
        var alpha = off ? 0.14 : (n.id === state.selected ? 0.95 : (st.status === UNSEEN ? 0.35 : 0.64));
        line(base, pos, off ? grid : color, alpha,
             zoom > 4 ? Math.min(12, baseScale * 100 / span * 0.6) : 1.1);
      } else {
        line(base, pos, off ? grid : color, 0.10, 1);
      }
      var dot = state.render === 'bars' ? base : pos;
      c.beginPath();
      c.arc(dot.x, dot.y, off ? 1 : (n.id === state.selected ? 4.5 : (zoom > 3 ? 2.7 : 1.4)), 0, Math.PI * 2);
      c.fillStyle = off ? grid : color;
      c.globalAlpha = off ? 0.4 : (st.status === UNSEEN ? 0.5 : 0.95);
      c.fill();
      c.globalAlpha = 1;
      dots.push({ x: pos.x, y: pos.y, id: n.id, base: base, r: 5 });
      if (n.id === state.selected) { selectedNode = pos; }
      previous = { n: n, pos: pos };
    });

    /* ---- X 轴与年级名（与柱子同一条 z） ---- */
    line(p(minX, 0, currentZ), p(maxX, 0, currentZ), muted, 0.45, 1);
    text('X · 知识序列', p((minX + maxX) / 2, -6, currentZ), ink, 'center', 13);
    STAGES.filter(function (s) { return s.end > range[0] && s.start <= range[1]; }).forEach(function (s) {
      var start = Math.max(s.start, range[0]);
      var end = Math.min(s.end - 1, range[1]);
      text(s.name, p(xx((start + end) / 2), -3.2, currentZ), ink, 'center', 14);
      line(p(xx(start), -0.3, currentZ), p(xx(start), -1.4, currentZ), muted, 0.55);
    });

    /* ---- 选中的那个（原型的选中环 + 名字） ---- */
    if (selectedNode) {
      var n = NODES[state.selected];
      c.beginPath();
      c.arc(selectedNode.x, selectedNode.y, 8, 0, Math.PI * 2);
      c.fillStyle = accent;
      c.globalAlpha = 0.12;
      c.fill();
      c.globalAlpha = 1;
      c.beginPath();
      c.arc(selectedNode.x, selectedNode.y, 4, 0, Math.PI * 2);
      c.fillStyle = accent;
      c.fill();
      line(selectedNode, { x: selectedNode.x, y: Math.min(h - 48, selectedNode.y + 30) }, accent, 0.4, 1, [3, 3]);
      text(String(n.no).padStart(4, '0') + ' · ' + n.topic,
           { x: selectedNode.x, y: selectedNode.y - 16 }, accent, 'center', 12);
    }

    hitRef.current = dots;
  }

  /* ==================================================================== *
   * 6. 交互（照原型：拖动转视角 / 平面视角拖动平移 / 滚轮缩放 / 双击聚焦）
   * ==================================================================== */

  function hit(e) {
    var rect = canvas.getBoundingClientRect();
    var x = e.clientX - rect.left;
    var y = e.clientY - rect.top;
    var best = null;
    var dist = 22;
    hitRef.current.forEach(function (pt) {
      if (pt.quad) {
        if (inQuad(x, y, pt.quad)) { best = pt; dist = 0; }
        return;
      }
      var d = Math.hypot(pt.x - x, pt.y - y);
      if (pt.base) { d = Math.min(d, Math.hypot(pt.base.x - x, pt.base.y - y)); }
      if (d < dist) { best = pt; dist = d; }
    });
    return best;
  }

  function inQuad(mx, my, q) {
    var inside = false;
    for (var i = 0, j = q.length - 1; i < q.length; j = i, i += 1) {
      var a = q[i];
      var b = q[j];
      if (((a.y > my) !== (b.y > my)) && (mx < (b.x - a.x) * (my - a.y) / (b.y - a.y) + a.x)) {
        inside = !inside;
      }
    }
    return inside;
  }

  function down(e) {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointerRef.current = {
      x: e.clientX, y: e.clientY, lastX: e.clientX, lastY: e.clientY,
      moved: false, pan: e.shiftKey || e.button === 2
    };
  }

  function move(e) {
    var t = pointerRef.current;
    if (t) {
      var dx = e.clientX - t.lastX;
      var dy = e.clientY - t.lastY;
      t.lastX = e.clientX;
      t.lastY = e.clientY;
      if (Math.abs(e.clientX - t.x) + Math.abs(e.clientY - t.y) > 4) { t.moved = true; }
      if (t.moved) {
        /* 平面那一档拖动 = 平移（跟 2D 那根轴一样）；Shift / 右键拖动也是平移 */
        if (t.pan || state.view === 'axis') { dispatch({ type: 'pan', dx: dx, dy: dy }); }
        else { dispatch({ type: 'orbit', dx: dx, dy: dy }); }
      }
      return;
    }
    hover(e.clientX, e.clientY);
  }

  function up(e) {
    var t = pointerRef.current;
    if (t && !t.moved) { select(e); }
    pointerRef.current = null;
  }

  function hover(clientX, clientY) {
    var best = hit({ clientX: clientX, clientY: clientY });
    var id = best && best.id >= 0 ? best.id : null;
    var ex = best && best.exam ? best.exam : null;
    if (id !== state.hovered || ex !== state.hoverExam) {
      state.hovered = id;
      state.hoverExam = ex;          /* 划过的那一场 → 给它描个边 */
      render();
      syncReadout();
      syncHoverCard(id === null ? null : NODES[id]);
    }
  }

  function select(e) {
    var best = hit(e);
    if (best && best.exam) {
      /* 点在考试切片上（板面或覆盖点）→ 钉住它 / 再点一下松开 */
      state.exam = state.exam === best.exam ? null : best.exam;
      if (best.id >= 0) { state.selected = best.id; }
    } else if (best && best.id >= 0) {
      state.selected = best.id;
    } else {
      return;
    }
    render();
    syncReadout();
  }

  function bind() {
    if (!canvas) { return; }
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', function () { pointerRef.current = null; });
    canvas.addEventListener('pointerleave', function () {
      if (state.hovered !== null || state.hoverExam !== null) {
        state.hovered = null;
        state.hoverExam = null;
        render();
        syncReadout();
      }
      syncHoverCard(null);
    });
    canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    canvas.addEventListener('wheel', function (e) {
      e.preventDefault();
      dispatch({ type: 'zoom', value: state.zoom * Math.exp(-e.deltaY * 0.0018) });
    }, { passive: false });
    canvas.addEventListener('dblclick', function (e) {
      var pt = hit(e);
      if (pt && pt.id >= 0) { dispatch({ type: 'focus', id: pt.id, zoom: Math.max(5, state.zoom * 1.8) }); }
    });
    if (window.ResizeObserver) {
      new ResizeObserver(function () { resize(); }).observe(canvas.parentNode);
    } else {
      window.addEventListener('resize', resize);
    }
  }

  /* ==================================================================== *
   * 7. 我们这一页的外壳：读数 / 考试分析面板 / 工具条 / 帮助
   * ==================================================================== */

  function el(sel) { return document.querySelector(sel); }

  /* 划过浮现的小卡：照原型那个 `hover(n)`（它写的是「名字 + 编号 · 难度 · 状态」），
     我们多一行"考到哪几场" —— 用户 2026-09-30："知识点划过，出现考试的考点"。 */
  function syncHoverCard(n) {
    var box = el('[data-t3-hover]');
    if (!box) { return; }
    if (!n) { box.classList.remove('show'); return; }
    var st = nodeState(n);
    box.textContent = '';
    var name = document.createElement('strong');
    name.textContent = n.name;
    box.appendChild(name);
    var line = document.createElement('small');
    line.textContent = String(n.no).padStart(4, '0') + ' · 难度 ' + n.difficulty.toFixed(1) + ' · ' + st.status +
      (st.mastery ? ' · 掌握 ' + st.mastery + '%' : '');
    box.appendChild(line);
    var hits = examHits(n.id);
    if (hits.length) {
      var hit = document.createElement('small');
      hit.textContent = '考到 ' + hits.length + ' 场：' + hits.slice(0, 3).join(' · ') +
        (hits.length > 3 ? ' 等' : '');
      box.appendChild(hit);
    }
    box.classList.add('show');
  }

  function syncReadout() {
    var nowEl = el('[data-t3-now]');
    var subEl = el('[data-t3-sub]');
    var i = state.hovered === null ? state.selected : state.hovered;
    var n = NODES[i];
    if (!nowEl || !n) { return; }
    var r = recAt(i) || {};
    nowEl.textContent = (state.hovered === null ? '当前 · ' : '划过 · ') +
      String(n.no).padStart(4, '0') + ' ' + n.name;
    var bits = [n.grade, n.book].filter(Boolean).join(' / ');
    bits += (bits ? ' · ' : '') + n.status + (n.mastery ? ' · 掌握 ' + n.mastery + '%' : '');
    bits += ' · 难度 ' + n.difficulty.toFixed(1);
    if (r.learnedAt) { bits += ' · 实际 ' + r.learnedAt; }
    if (r.plannedAt) { bits += ' · 计划 ' + r.plannedAt; }
    subEl.textContent = bits;

    syncReport();
  }

  function put(parent, cls, txt) {
    var d = document.createElement('div');
    d.className = cls;
    d.textContent = txt;
    parent.appendChild(d);
    return d;
  }

  function syncReport() {
    var box = el('[data-t3-report]');
    if (!box) { return; }
    var listEl = el('[data-t3-report-list]');
    var shown = null;
    EXAMS.forEach(function (e) { if (e.id === state.exam) { shown = e; } });
    if (!shown) {
      box.hidden = true;
      if (listEl) { listEl.textContent = ''; }
      return;
    }
    var rows = [];
    var dSum = 0;
    var dWrong = 0;
    shown.coverage.forEach(function (k) {
      var n = NODES[k];
      if (!n) { return; }
      var bad = !!shown.wrong[k];
      if (bad) { dWrong += n.difficulty; }
      dSum += n.difficulty;
      rows.push({ i: k, no: n.no, name: n.name, diff: n.difficulty, bad: bad });
    });
    var total = rows.length;
    var wrongN = shown.wrongN;

    el('[data-t3-report-name]').textContent = shown.name;
    el('[data-t3-report-meta]').textContent = shown.date +
      ' · 覆盖 ' + total + ' 个考点 · 第 ' + (shown.range[0] + 1) + '–' + (shown.range[1] + 1) + ' 格';
    el('[data-t3-report-stats]').textContent =
      '错 ' + wrongN + ' / ' + total + '（正确率 ' +
      (total ? Math.round((total - wrongN) / total * 100) : 0) + '%）· 平均难度 ' +
      (total ? (dSum / total).toFixed(1) : '—') +
      (wrongN ? '（错的 ' + (dWrong / wrongN).toFixed(1) + '）' : '');

    if (listEl) {
      listEl.textContent = '';
      rows.forEach(function (row) {
        var li = document.createElement('li');
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 't3-report__row';
        btn.setAttribute('data-t3-report-row', String(row.i));
        btn.setAttribute('title', row.name + ' · 难度 ' + row.diff.toFixed(1));
        put(btn, 't3-report__no', String(row.no).padStart(4, '0'));
        put(btn, 't3-report__nm', row.name);
        put(btn, 't3-report__diff', row.diff.toFixed(1));
        put(btn, row.bad ? 't3-report__bad' : 't3-report__ok', row.bad ? '错' : '对');
        li.appendChild(btn);
        listEl.appendChild(li);
      });
    }
    closeHelp();
    var tipEl = el('[data-t3-exam]');
    if (tipEl) { tipEl.hidden = true; }
    box.hidden = false;
  }

  function onReportClick(ev) {
    var node = ev.target;
    var btn = null;
    while (node && node !== ev.currentTarget) {
      if (node.getAttribute && node.getAttribute('data-t3-report-row') !== null) { btn = node; break; }
      node = node.parentNode;
    }
    if (!btn) { return; }
    state.selected = Number(btn.getAttribute('data-t3-report-row'));
    state.hovered = null;
    render();
    syncReadout();
  }

  function closeHelp() {
    var box = el('[data-t3-help]');
    var btn = el('[data-t3-help-btn]');
    if (box && !box.hidden) {
      box.hidden = true;
      if (btn) { btn.setAttribute('aria-pressed', 'false'); }
    }
  }

  /* 「3D / 平面」：view = space ⇄ axis（原型就是这两档切换）。
     工具条照白板那套：**只有图标**，汉字说明走 data-t3-tip（hover 才出）。 */
  function syncMode() {
    var btn = el('[data-t3-toggle]');
    var flat = state.view === 'axis';
    if (btn) {
      btn.setAttribute('aria-pressed', flat ? 'false' : 'true');
      btn.setAttribute('data-t3-tip', flat ? '转成 3D（时间轴那一维拉出来）' : '回到平面（与 2D 那根轴同形）');
    }
    document.documentElement.setAttribute('data-t3-mode', flat ? 'flat' : 'solid');
  }

  function syncProj() {
    var btn = el('[data-t3-proj]');
    if (!btn) { return; }
    var persp = state.proj === 'persp';
    btn.setAttribute('aria-pressed', persp ? 'true' : 'false');
    btn.setAttribute('data-t3-tip', persp ? '现在是透视 · 点一下换正交' : '现在是正交 · 点一下换透视');
  }

  /* 柱 ⇄ 曲线（原型的 render 开关）、按状态 ⇄ 按年级着色（原型的 colorMode 开关） */
  function syncRenderBtn() {
    var btn = el('[data-t3-render]');
    if (!btn) { return; }
    var bars = state.render === 'bars';
    btn.setAttribute('aria-pressed', bars ? 'false' : 'true');
    btn.setAttribute('data-t3-tip', bars ? '现在是柱 · 点一下切成曲线' : '现在是曲线 · 点一下切回柱');
  }

  function syncColorBtn() {
    var btn = el('[data-t3-color]');
    if (!btn) { return; }
    var byStatus = state.colorMode === 'status';
    btn.setAttribute('aria-pressed', byStatus ? 'false' : 'true');
    btn.setAttribute('data-t3-tip', byStatus ? '现在按掌握状态着色 · 点一下按年级着色'
                                             : '现在按年级着色 · 点一下按掌握状态着色');
  }

  function syncZoomLabel() {
    var box = el('[data-t3-zoom]');
    if (box) { box.textContent = Math.round(state.zoom * 100) + '%'; }
  }

  /* ---- 底部时间条：拖它把"当前"挪到那一天 ----
     柱子那堵墙就在时间里滑，滑过哪一场的日子，那块切片才冒出来（照参照原型的 timebar）。 */
  function dateText(ms) {
    var d = new Date(ms);
    return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' +
           String(d.getUTCDate()).padStart(2, '0');
  }

  function syncTimebar() {
    var input = el('[data-t3-day]');
    if (input) { input.value = String(dayIndex(state.dayMs)); }
    var label = el('[data-t3-date]');
    if (label) { label.textContent = dateText(state.dayMs); }
  }

  function buildTimebar() {
    var input = el('[data-t3-day]');
    if (input) {
      input.min = '0';
      input.max = String(DAY_N);
      input.addEventListener('input', function () {
        dispatch({ type: 'day', at: DAY0 + Number(input.value) * DAY });
        syncTimebar();
      });
    }
    /* 刻度写**每学年**（一学年一格） */
    var ticks = el('[data-t3-ticks]');
    if (ticks) {
      ticks.textContent = '';
      var y0 = new Date(DAY0).getUTCFullYear();
      var y1 = new Date(DAY1).getUTCFullYear();
      for (var y = y0; y <= y1; y += 1) {
        var s = document.createElement('span');
        s.textContent = String(y);
        ticks.appendChild(s);
      }
    }
    var prev = el('[data-t3-prev-day]');
    if (prev) {
      prev.addEventListener('click', function () {
        dispatch({ type: 'day', at: state.dayMs - DAY });
        syncTimebar();
      });
    }
    var next = el('[data-t3-next-day]');
    if (next) {
      next.addEventListener('click', function () {
        dispatch({ type: 'day', at: state.dayMs + DAY });
        syncTimebar();
      });
    }
    syncTimebar();
  }

  /* ---- 难度层（右侧那条竖排）：五个档**各自一个开关**，点名字就开 / 关那一层 ----
     用户 2026-09-30："难度层本意应该是在右边……点击它们的名字，就可以开关这个层。" */
  function buildLevels() {
    var box = el('[data-t3-levels]');
    if (!box) { return; }
    box.textContent = '';
    var cap = document.createElement('div');
    cap.className = 't3-levels__cap';
    cap.textContent = '难度层';
    box.appendChild(cap);
    LEVELS.forEach(function (lv) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 't3-levels__btn';
      btn.setAttribute('data-t3-level', String(lv.no));
      btn.setAttribute('data-t3-tip', lv.name + '（难度 ' + lv.no + '）· 点一下开 / 关');
      btn.setAttribute('aria-label', lv.name + '（难度 ' + lv.no + '）');
      btn.setAttribute('aria-pressed', levelOn(lv.no) ? 'true' : 'false');
      var dot = document.createElement('i');
      dot.className = 't3-levels__dot';
      dot.style.background = readColor(lv.token);
      btn.appendChild(dot);
      var nm = document.createElement('span');
      nm.textContent = lv.name;
      btn.appendChild(nm);
      btn.addEventListener('click', function () {
        state.levels[lv.no - 1] = !state.levels[lv.no - 1];
        syncLevels();
        render();
      });
      box.appendChild(btn);
    });
  }

  function syncLevels() {
    var box = el('[data-t3-levels]');
    if (!box) { return; }
    var btns = box.querySelectorAll('[data-t3-level]');
    for (var i = 0; i < btns.length; i += 1) {
      var no = Number(btns[i].getAttribute('data-t3-level'));
      btns[i].setAttribute('aria-pressed', levelOn(no) ? 'true' : 'false');
    }
  }

  function syncLayerBtn(sel, on, tipOn, tipOff) {
    var btn = el(sel);
    if (!btn) { return; }
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    btn.setAttribute('data-t3-tip', on ? tipOn : tipOff);
  }

  function bindChrome() {
    var toggle = el('[data-t3-toggle]');
    if (toggle) {
      toggle.addEventListener('click', function () {
        state.view = state.view === 'axis' ? 'space' : 'axis';
        state.panX = 0;
        state.panY = 0;
        syncMode();
        render();
      });
    }
    var projBtn = el('[data-t3-proj]');
    if (projBtn) {
      projBtn.addEventListener('click', function () {
        state.proj = state.proj === 'persp' ? 'ortho' : 'persp';
        syncProj();
        render();
      });
    }
    var reset = el('[data-t3-reset]');
    if (reset) {
      reset.addEventListener('click', function () { resetCamera(); syncZoomLabel(); render(); });
    }
    /* 柱 ⇄ 曲线 */
    var renderBtn = el('[data-t3-render]');
    if (renderBtn) {
      renderBtn.addEventListener('click', function () {
        state.render = state.render === 'bars' ? 'ribbon' : 'bars';
        syncRenderBtn();
        render();
      });
    }
    /* 按掌握状态 ⇄ 按年级着色 */
    var colorBtn = el('[data-t3-color]');
    if (colorBtn) {
      colorBtn.addEventListener('click', function () {
        state.colorMode = state.colorMode === 'status' ? 'stage' : 'status';
        syncColorBtn();
        render();
      });
    }
    /* 缩放：减 / 读数 / 加（原型的工具条上就这三样） */
    var zoomOut = el('[data-t3-zoom-out]');
    if (zoomOut) {
      zoomOut.addEventListener('click', function () {
        dispatch({ type: 'zoom', value: state.zoom / 1.25 });
      });
    }
    var zoomIn = el('[data-t3-zoom-in]');
    if (zoomIn) {
      zoomIn.addEventListener('click', function () {
        dispatch({ type: 'zoom', value: state.zoom * 1.25 });
      });
    }
    var examBtn = el('[data-t3-exams]');
    if (examBtn) {
      examBtn.addEventListener('click', function () {
        state.layers.exams = !state.layers.exams;
        syncLayerBtn('[data-t3-exams]', state.layers.exams, '考试切片已开 · 点一下关掉', '考试切片关着 · 点一下打开');
        render();
      });
    }
    var helpBtn = el('[data-t3-help-btn]');
    var helpBox = el('[data-t3-help]');
    if (helpBtn && helpBox) {
      helpBtn.addEventListener('click', function () {
        helpBox.hidden = !helpBox.hidden;
        helpBtn.setAttribute('aria-pressed', helpBox.hidden ? 'false' : 'true');
        var rp = el('[data-t3-report]');
        if (rp && !helpBox.hidden) { rp.hidden = true; }
      });
    }
    var listEl = el('[data-t3-report-list]');
    if (listEl) { listEl.addEventListener('click', onReportClick); }
    var closeBtn = el('[data-t3-report-close]');
    if (closeBtn) {
      closeBtn.addEventListener('click', function () {
        state.exam = null;
        render();
        syncReadout();
      });
    }
    var who = el('[data-t3-who]');
    if (who) {
      who.textContent = WHO.name + (WHO.grade ? ' · ' + WHO.grade : '') + (WHO.mine ? '' : '（演示）');
    }
  }

  /* 字号设置变了要重画（画布里的字跟着 --math-fs 走） */
  function watchFont() {
    if (!window.MutationObserver) { return; }
    var mo = new MutationObserver(function () {
      FS = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--math-fs')) || 1;
      render();
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['style', 'data-theme', 'data-scheme'] });
  }

  bindChrome();
  buildTimebar();
  buildLevels();
  syncMode();
  syncProj();
  syncRenderBtn();
  syncColorBtn();
  syncZoomLabel();
  syncLevels();
  syncLayerBtn('[data-t3-exams]', state.layers.exams, '考试切片已开 · 点一下关掉', '考试切片关着 · 点一下打开');
  bind();
  resize();
  syncReadout();
  watchFont();

  window.WK_TIMELINE_3D = {
    state: state, render: render, resize: resize,
    nodes: NODES, exams: EXAMS, stages: STAGES, range: RANGE,
    /* 调试用：当前这一帧的投影与取景（体检 / 排查透视时直接调它量） */
    project: function (x, y, z) { return viewRef.current ? viewRef.current.project(x, y, z) : null; },
    toScreen: function (x, y, z) { return viewRef.current ? viewRef.current.p(x, y, z) : null; },
    coordinates: function () { return viewRef.current; },
    span: function () { return { from: SPAN.from, to: SPAN.to, stage: SPAN.stage, n: N }; },
    zRange: function () { return { t0: T0, t1: T1, today: TODAY }; },
    zOf: zOf
  };
}());
