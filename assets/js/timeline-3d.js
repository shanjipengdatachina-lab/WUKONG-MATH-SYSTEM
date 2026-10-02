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
  /* 一年在世界坐标里多长、以及"轴尾再往外两年"那条线 —— 用户 2026-09-30：底下一整排题目点
     要挪到"大约是在 2028 年那个位置"（"相当于加两年的那个位置"）。`zOf` 会把日期夹在
     [T0, T1] 里，所以轴外那段不能走它，得按"一年 ≈ 多少世界单位"直接算。 */
  var YEAR_Z = 20 * (365.25 * DAY) / Math.max(1, T1 - T0);
  var FUTURE_Z = 20 + 2 * YEAR_Z;                /* 轴尾（2026-06 那一刀）再往外两年 */
  /* 实物卷往**过去**挪多远（用户 2026-10-02："它每一次考试基本上就和它拉开大约两年或者三年的距离"，
     挑"两三年"的当中 = 2.5 年）。E13（2025-07）往回收 2.5 年 = 2023 那一格 —— 正是用户说的
     "大约位置在 2023 年那地儿，你可以把它理解为是 2023 年的其中一个切片位置"。
     太早的场（E1 是 2020-11）往回 2.5 年会跑出轴外，`zOf` 自己会把日期夹在 [T0, T1] 里，不用另夹。 */
  var PAPER_BACK_MS = 2.5 * 365.25 * DAY;

  /** '2024-05-18' → '2024年5月18日'（切片顶上那行标题、以及划过一场考试时那一行提示用；
      用户 2026-10-01："上面那个时间只不过没加上年，你需要加上年" —— 年月日一起给全）。
      认不出来就原样返回。 */
  function cnDate(d) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(d || ''));
    return m ? (Number(m[1]) + '年' + Number(m[2]) + '月' + Number(m[3]) + '日') : String(d || '');
  }

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
  var paper = readColor('--math-background');   /* 图板的底：把背后的场景压住，线才读得清 */
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
      mastery: r.mastery || 0,
      /* 这一格**内部的几块**（概念 / 公式 / 例题 / 变式 / 错题 / 复习，各带权重）——
         用户 2026-10-01："3D 的那个数轴，知识点的线应该也像平面的那样，也就是它的知识点线
         是有宽度的，然后里面再根据他的情况有宽细之分……这个数轴和 3D 的数轴、平面的数轴是一致的。"
         2D 早就这么画了（timeline.js 的 drawCards），这里把同一份数据接过来，
         放大到一定程度就按权重把这一格切成几块 —— 两边同一把尺子。 */
      cards: (r.cards || [])
    };
  });

  var EXAMS = examsOfStage().map(function (e) {
    var wrong = {};
    var got = 0;
    var full = 0;
    e.paper.forEach(function (p) {
      var vi = p.index - SPAN.from;
      got += p.score;
      full += p.full;
      if (p.score * 5 < p.full * 3) { wrong[vi] = 1; }
    });
    return {
      id: e.id, name: e.name, day: e.at, date: e.date,
      range: [e.from - SPAN.from, e.to - SPAN.from - 1],
      coverage: e.paper.map(function (p) { return p.index - SPAN.from; }),
      /* 卷面本身**原样留着**（题号 · 满分 · 得分）——「这份试卷」那一页要用它逐题列出来 */
      paper: e.paper,
      wrong: wrong,
      total: e.paper.length,
      wrongN: Object.keys(wrong).length,
      /* 「成绩变化」那条线要的就是它：这场卷子的**得分率**（Σ得分 ÷ Σ满分）；
         另外把**实得 / 满分**也留下 —— 切片顶上那行标题要写（用户 2026-09-30：
         "应该还得加上基础信息，比如月几号、……考试的基础分、满分多少、考了多少分"）。 */
      got: got,
      full: full,
      score: full ? Math.round(got / full * 100) : 0,
      avgDiff: e.paper.reduce(function (s, p) { return s + (NODES[p.index - SPAN.from] || { difficulty: 1 }).difficulty; }, 0) /
        Math.max(1, e.paper.length)
    };
  });

  /* ---- 「投入练习」那一层的数据 ----
     原型那条画的是"有效学习时间（分钟）+ 新题 / 复做"，我们**没有时长**这条数据，
     所以这一层只数**题量**：从学习轨迹里按**每两周**一桶数
     （`first` = 新学的知识点 = 新题；`review` / `fix` = 复习与纠错 = 复做）。
     只数轨迹里真实存在的事件，不编时长 —— 要"分钟"得先有时长模型，那是另一件事。 */
  function buildEffort() {
    var SPAN_MS = 14 * DAY;
    var buckets = {};
    for (var i = 0; i < N; i += 1) {
      var rec = recAt(i);
      if (!rec || !rec.events) { continue; }
      for (var k = 0; k < rec.events.length; k += 1) {
        var ev = rec.events[k];
        if (ev.kind === 'exam') { continue; }
        var b = Math.floor((ev.at - DAY0) / SPAN_MS);
        if (!buckets[b]) { buckets[b] = { at: DAY0 + b * SPAN_MS, first: 0, redo: 0 }; }
        if (ev.kind === 'first') { buckets[b].first += 1; } else { buckets[b].redo += 1; }
      }
    }
    return Object.keys(buckets).map(function (b) { return buckets[b]; })
      .sort(function (p, q) { return p.at - q.at; });
  }
  var EFFORT = [];
  var EFFORT_MAX = 1;

  /* ---- 「学习进度」那一层的数据（照参照原型的 progress：累计完成 对 计划）----
     两条都是**真数据**，不用另造：
       · 实际 = 到那天为止**首学**过的知识点数（从轨迹里数首学那一刻）
       · 计划 = 到那天为止**计划要学**的知识点数（记录上本来就有 `plannedAt`）
     按每两周取一个点，两条一路往上走 —— 中间那段开口就是"欠得最多的时候"。 */
  function buildProgress() {
    var firstAt = [];
    var planAt = [];
    for (var i = 0; i < N; i += 1) {
      var rec = recAt(i);
      var first = null;
      if (rec && rec.events) {
        for (var k = 0; k < rec.events.length; k += 1) {
          if (rec.events[k].kind === 'first') { first = rec.events[k].at; break; }
        }
      }
      if (first !== null) { firstAt.push(first); }
      var p = rec && rec.plannedAt ? parseDay(rec.plannedAt) : null;
      if (p) { planAt.push(p); }
    }
    firstAt.sort(function (a, b) { return a - b; });
    planAt.sort(function (a, b) { return a - b; });
    var SPAN_MS = 14 * DAY;
    var out = [];
    for (var b = 0; DAY0 + b * SPAN_MS <= DAY1; b += 1) {
      var at = DAY0 + b * SPAN_MS;
      var ca = 0;
      while (ca < firstAt.length && firstAt[ca] <= at) { ca += 1; }
      var cp = 0;
      while (cp < planAt.length && planAt[cp] <= at) { cp += 1; }
      out.push({ at: at, done: ca, plan: cp });
    }
    return out;
  }
  var PROGRESS = [];

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
  /** 这一档叫什么（基础层 / 概念层 / 应用层 / 变化层 / 综合层）—— 面板里写的是名字，不是数字 */
  function levelName(diff) {
    var no = Math.max(1, Math.min(5, Math.round(diff)));
    for (var i = 0; i < LEVELS.length; i += 1) {
      if (LEVELS[i].no === no) { return LEVELS[i].name; }
    }
    return '';
  }

  /* ==================================================================== *
   * 3b. 一格里面再分块（与平面数轴那一层**同一套算法**）
   * --------------------------------------------------------------------
   * 用户 2026-10-01："现在的颗粒力度很细，每个知识点里面还可能再分六七个维度……
   * 3D 的那个数轴，知识点的线应该也像平面的那样，也就是它的知识点线是有宽度的，
   * 里面再根据他的情况有宽细之分。这个数轴和 3D 的数轴、平面的数轴是一致的。"
   *   · 一格宽到 `CARD_MIN_GRID_PX` 个屏幕像素才拆；
   *   · 拆开后这一格的宽度**按卡片权重分**（宽度 = 权重），卡与卡之间留 `CARD_GAP_PX` 的缝；
   *   · 高度**齐平**（取这个知识点自己的难度，不再各块一个高矮）—— 与平面 2026-09-30 定的口径一致。
   * **门槛这个数 3D 与平面不一样，故意的**：平面那套是 56px（`timeline.js` 的 `CARD_MIN_W`），
   * 因为平面能缩到 400px/格（`MAX_SCALE`）；**3D 的缩放夹在 .55~24 倍**（照原型那条口径），
   * 而一格 = `100/span` 世界单位，实测 zoom 24 时一格也只有约 29px —— 56 这个门槛在 3D 里
   * **永远到不了**（第一版就是这么写的，功能整条出不来）。所以 3D 取 **20px**（zoom ≈ 16.5 到得了），
   * 这时一块大约 2~4px，看得出"宽细之分"。想看块名就把光标压在 X 轴上滚轮拉伸那根轴
   * （`state.axis.x` 到 4 倍时一格 ≈ 116px，块宽就能过 `CARD_NAME_PX`）。
   * 返回的 x 是**相对格子中心**的世界单位，调用方再加 `xx(n.id)`。没到门槛 / 没卡 → `null`。 */
  var CARD_MIN_GRID_PX = 20;      /* 3D 自己的门槛（平面是 56 —— 见上面为什么不能照抄） */
  var CARD_GAP_PX = 1.4;          /* 块与块之间的缝（屏幕像素，平面也是 1.4） */
  var CARD_NAME_PX = 34;          /* 一块宽到这么多才写得下卡片名（平面 CARD_TYPE_W） */

  function cardBlocks(cards, gridW, gridPx) {
    if (!cards || !cards.length || gridPx < CARD_MIN_GRID_PX) { return null; }
    var sum = 0;
    var i;
    for (i = 0; i < cards.length; i += 1) { sum += cards[i].weight || 0; }
    if (!sum) { return null; }
    var gap = (CARD_GAP_PX / gridPx) * gridW;            /* 屏幕 1.4px 折成世界单位 */
    var usable = gridW - gap * (cards.length - 1);
    if (usable <= gridW * 0.15) { return null; }         /* 挤得画不出来就不拆 */
    var out = [];
    var x = -gridW / 2 + gap / 2;                        /* 从格子左边留半个缝起排 */
    for (i = 0; i < cards.length; i += 1) {
      var w = usable * (cards[i].weight || 0) / sum;
      out.push({
        card: cards[i],
        x0: x, x1: x + w, cx: x + w / 2,
        px: w * (gridPx / gridW)                          /* 这一块在屏幕上大约多少像素 */
      });
      x += w + gap;
    }
    return out;
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
    /* 三根轴**各自的缩放倍率**（用户 2026-10-01："时间是可以缩放的，同样的，X 轴知识点
       也可以缩放，Y 轴也可以缩放，Z 轴也可以缩放"）：光标压在哪根轴上，滚轮就只缩哪一根。 */
    axis: { x: 1, y: 1, z: 1 },
    axisHot: null,             /* 光标现在压在哪根轴上（'x' 知识 / 'y' 难度 / 'z' 时间 / null） */
    selected: Math.max(0, Math.min(N - 1, (SUMMARY && SUMMARY.learned ? SUMMARY.learned : 1) - 1 - SPAN.from)),
    hovered: null,
    render: 'bars',
    colorMode: 'status',
    proj: 'persp',             /* 我们对原型加的一档：persp / ortho */
    exam: null,                /* 钉住的那一场考试 */
    hoverExam: null,           /* 划过的那一场（给它描个边） */
    hoverSlice: false,         /* 划过的是**玻璃板上的那个点**（不是柱脚）→ 板上锁一个圈 */
    /* 划过的那一个**点**的屏幕位置：给它套一个白圈（用户 2026-10-01："它滑动的同时，应该有
       一个 hover 的点，表示我选中了哪一个。可能是个白色的圈"）。 */
    hoverPt: null,
    /* 划过的是**那一排里的某一道题**：{ qi, k, exam } —— 底部那一行提示要指着它说话
       （用户 2026-10-01："这个地方应该是个题，说是多少题"）。 */
    hoverRow: null,
    /* 划到的那个点**落在这个知识点的哪一块**上：{ k, card, qi } —— 用户 2026-10-01：
       "同样的一个知识点，比如绝对值这个知识点，第七题是因为概念不清，第八题是因为计算错了数……
       只有这样才能分清楚。" 块只有几像素宽、写不下字，所以"是哪一块"靠底部那一行提示读出来。 */
    hoverCard: null,
    /* 原卷（扫描件）那一层（用户 2026-10-01："查看到原题 / 原卷"）：
       `scanOpen` 原卷浮层开着没有；`scanQ` 现在看的是卷面第几题；`scanPage` 看的是正面还是反面；
       `scanPick` "再叠一个原因"那排七种展开没有。 */
    scanOpen: false,
    scanQ: null,
    scanPage: 0,
    scanPick: false,
    /* 「实物卷」（用户 2026-10-01："在立体空间当中也是竖着两张卷子，一个是正面，一个是反面"）：
       钉住某一场之后，右侧那颗按钮才出现；**默认不显示**，点了才在 3D 里把这两张卷子立起来。
       `paperHit` 是这一帧两张卷子投影到屏幕上的四边形（点它 → 平面展开，见 hitPaper）。 */
    paper3d: false,
    paperHit: [],
    /* 鼠标压在这两张卷子上没有（用户 2026-10-02："默认设置它，这个是半透明的这个状态。
       然后鼠标滑上去的时候，它再显示透明度百分之百……大约是 80% 吧，你就直接定好，
       默认 80%，鼠标滑上去的时候 100%"）—— `true` 时那两张卷子按 100% 画。 */
    hoverPaper: false,
    examWin: true,             /* 考试浮窗开着没有（收起来只是收起浮窗，钉子还在） */
    examTab: 'report',         /* 考试浮窗那一页：report（分析）/ paper（试卷） */
    railLevels: false,         /* 右侧那排：「难度层」点开没有（点开才展开五档勾选） */
    pickedQ: null,             /* 浮窗里点到的那**一道题**（图上那道题 + 它的知识点一起高亮） */
    nodeAt: null,              /* 点开的那个考点（点一下具体考点才出现的独立浮窗） */
    /* 「清爽模式」（用户 2026-10-01）：左边的导航与底部的工具条 / 时间条滑走，只留场景
       —— **右侧那一竖排自己不许消失**，否则点了就再也点不回来了。 */
    clean: false,
    dayMs: TODAY,              /* 底部时间条：现在停在哪一天（原型是 state.day） */
    /* 五个难度层各自开关（右侧那条竖排按钮点的就是它们）；默认全关 */
    levels: [false, false, false, false, false],
    /* 底部那几颗数据图层（照参照原型的「学习进度 / 成绩变化 / 投入练习」三个模块）。
       这里**没有 exams** —— 考试切片不再是一个"图层开关"（用户 2026-10-01：
       "我们这个切片是一直在的，这个切片是由这个时间轴来控制的，滑动时间轴就知道我们有多少"），
       它跟着时间条走，永远在。 */
    layers: { progress: false, scores: false, effort: false }
  };

  function levelOn(no) { return !!state.levels[no - 1]; }
  function levelAnyOn() { return state.levels.indexOf(true) >= 0; }

  /* 时间条的范围：这一段的第一天 → 最后一天，一天一格（原型是 0–90 天） */
  var DAY0 = T0;
  var DAY1 = T1;
  var DAY_N = Math.max(1, Math.round((DAY1 - DAY0) / DAY));
  function dayIndex(ms) { return Math.max(0, Math.min(DAY_N, Math.round((ms - DAY0) / DAY))); }

  /* 「投入练习」「学习进度」两层都要按天分桶，得等 DAY0 定下来才能算（所以放这儿） */
  EFFORT = buildEffort();
  EFFORT_MAX = EFFORT.reduce(function (m, o) { return Math.max(m, o.first + o.redo); }, 1);
  PROGRESS = buildProgress();

  function resetCamera() {
    state.zoom = 1;
    state.yaw = -0.08;
    state.pitch = 0.38;
    state.panX = 0;
    state.panY = 0;
    state.center = null;
    state.axis.x = 1;
    state.axis.y = 1;
    state.axis.z = 1;
  }

  /* 「重置视角」（工具条那颗 ↺）—— **钉着某一场的时候不许把人踢回总轴**（用户 2026-10-01：
     "进入单个考试面板，只有右侧的回到总轴可以回去，其他的排查一下，记住"）。
     原来它直接 `resetCamera()`：视角回整根轴，可**钉子还留着** —— 变成"钉着却站在总轴视角"
     的怪状态，而且这就是第二条"回总轴"的路。现在：**钉着就把视角恢复成"这一场的默认视角"**
     （重新聚焦这一场：俯视参考角 + 适配这一场），没钉住才是整根轴的默认视角。
     三根轴的拉伸两种情况都归位（它就叫"重置"）。 */
  function resetView() {
    if (state.exam !== null && examById(state.exam)) {
      state.axis.x = 1;
      state.axis.y = 1;
      state.axis.z = 1;
      focusExam(state.exam);
      return;
    }
    resetCamera();
  }

  function dispatch(a) {
    switch (a.type) {
      case 'zoom':
        state.zoom = Math.max(0.55, Math.min(24, a.value));
        syncZoomLabel();
        break;
      /* 只缩**某一根轴**（用户 2026-10-01）：锚点 = 光标底下那个轴上的点，
         它在屏幕上**原地不动**、两边展开 —— 做法是量一下这个点在缩放前后的落点，
         差多少就把画面平移多少（`panX / panY` 就是屏幕平移量）。 */
      case 'axisZoom': {
        var kk = a.axis;
        var cc = viewRef.current;
        var before = cc ? cc.p(a.anchor.x, a.anchor.y, a.anchor.z) : null;
        state.axis[kk] = Math.max(0.4, Math.min(4, a.value));
        render();                      /* 先按新倍率画一帧，才知道锚点跑到哪儿去了 */
        var cc2 = viewRef.current;
        var after = cc2 ? cc2.p(a.anchor.x, a.anchor.y, a.anchor.z) : null;
        if (before && after) {
          state.panX += before.x - after.x;
          state.panY += before.y - after.y;
        }
        syncZoomLabel();
        break;
      }
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
  /* 三根轴这一帧落在屏幕上的位置（`render` 里填）—— 光标压没压在某根轴上就靠它判
     （用户 2026-10-01："如果鼠标放在时间轴上的时候，就可以缩放"）。 */
  var axisSegs = {};
  var AXIS_NAME = { x: '知识轴', y: '难度轴', z: '时间轴' };
  var hoverOffTimer = 0;           /* 光标离开画布之后"稍后再清划过状态"的那个定时器 */

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

  /* 时间刻度：沿 Z 那条棱，每学年一个年份（原型写的是"每 30 天一个日期"）——
     往外多出两年（2027 / 2028）：底下那排题目点要站在轴外 2028 那格上，刻度得跟着画出去。 */
  var TIME_TICKS = [];
  (function buildTicks() {
    var y0 = new Date(T0).getUTCFullYear();
    var y1 = new Date(T1).getUTCFullYear();
    for (var y = y0; y <= y1 + 2; y += 1) {
      var at = Date.UTC(y, 8, 1);
      if (at >= T0 && at <= T1) {
        TIME_TICKS.push({ z: zOf(at), label: (y - y0) % 2 === 0 ? String(y) : '' });
      } else if (at > T1) {
        /* 轴外那两年：z 按"离轴尾还有几年"直接推（`zOf` 会把日期夹在轴尾，不能用） */
        TIME_TICKS.push({ z: 20 + (at - T1) / (365.25 * DAY) * YEAR_Z,
                          label: (y - y0) % 2 === 0 ? String(y) : '', future: true });
      }
    }
  }());

  function render() {
    if (!ctx) { return; }
    var c = ctx;
    var w = size.w;
    var h = size.h;
    c.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    c.clearRect(0, 0, w, h);
    axisSegs = {};                 /* 每帧重新记：这一帧画了哪几根轴 */

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

    /* ---- 投影：**照原型逐行**（平移到盒子中心 → 绕垂直轴 → 绕水平轴 → 按深度缩放）----
       三根轴各自的缩放（用户 2026-10-01）**只加在画到屏幕这一步**；
       **取景仍然按"没缩放过的盒子"算** —— 要是取景也跟着放大，那"把时间拉长"会被它
       原样抵消回去，轴上拉半天屏幕里一点都不变长。 */
    var axisS = state.axis;
    function projectWith(sx, sy, sz, x, y, z) {
      var cx = (x - pivotX) * sx;
      var cy = (state.view === 'axis' ? y : y - 11) * sy;
      var cz = (state.view === 'axis' ? z : z - pivotZ) * sz;
      var rx = cx * cos + cz * sin;
      var rz = -cx * sin + cz * cos;
      var ry = cy * cp + rz * sp;
      var depth = rz * cp - cy * sp;
      var perspective = (state.view === 'axis' || state.proj === 'ortho')
        ? 1 : cameraDistance / Math.max(8, cameraDistance + depth);
      return { u: rx * perspective, v: ry * perspective, depth: depth };
    }
    function project(x, y, z) { return projectWith(axisS.x, axisS.y, axisS.z, x, y, z); }
    function projectBase(x, y, z) { return projectWith(1, 1, 1, x, y, z); }

    /* ---- 取景：对称包围盒（转一圈都不跑偏），宽度上给右侧面板留 310px ----
       Z 方向取到 **FUTURE_Z + 6**：底下那排题目点站在轴外 2028 那一格上，而题号是**用虚线
       再往外牵出去写**的（用户 2026-09-30："用虚线指出来"），取景得把那一截也框住，
       不然一转视角就出画了。 */
    var FRAME_Z = FUTURE_Z + 6;
    var corners = [];
    for (var cx = 0; cx < 2; cx += 1) {
      for (var cyy = 0; cyy < 2; cyy += 1) {
        for (var czz = 0; czz < 2; czz += 1) {
          corners.push(projectBase([-50, 50][cx], [0, 22][cyy], [0, FRAME_Z][czz]));
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
    var baseUnit = Math.min((w - sideW) / Math.max(100, projectedWidth),
                            availableHeight / Math.max(38, projectedHeight + 14));
    var baseScale = baseUnit * zoom;
    /* 「适配」要用（用户 2026-10-01："保留现在的 XYZ……在这个框架内，充满屏幕"）：
       **当前三根轴的拉伸**下，把这一整块框架铺满画面要多少倍 —— 取景本身仍按没拉伸的盒子
       算（见上），这里另外量一份"拉伸之后要多大"，量出来再除以"没拉伸时的 1 倍"。
       三根轴都是 1 时它正好是 1，"适配"的表现和以前一样。 */
    var maxUs = maxU;
    var maxVs = maxV;
    if (state.view !== 'axis') {
      for (var ux = 0; ux < 2; ux += 1) {
        for (var uy = 0; uy < 2; uy += 1) {
          for (var uz = 0; uz < 2; uz += 1) {
            var up = project([-50, 50][ux], [0, 22][uy], [0, FRAME_Z][uz]);
            maxUs = Math.max(maxUs, Math.abs(up.u));
            maxVs = Math.max(maxVs, Math.abs(up.v));
          }
        }
      }
    }
    var zoomFitAll = baseUnit > 0
      ? Math.min((w - sideW) / Math.max(100, 2 * maxUs),
                 availableHeight / Math.max(38, 2 * maxVs + 14)) / baseUnit
      : 1;
    function p(x, y, z) {
      var pt = project(x, y, z || 0);
      return { x: originX + pt.u * baseScale, y: originY - pt.v * baseScale, depth: pt.depth };
    }
    viewRef.current = { xx: xx, p: p, project: project, w: w, h: h, range: range, span: span,
                        baseScale: baseScale, zoomFitAll: zoomFitAll };

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
    /* 把贴图的一小块（uv 子矩形）贴到屏幕上那个四边形上 —— 「实物卷」要用（用户 2026-10-01）。
       canvas 2D **没有四边形贴图**，只能：clip 到这一块的四条边 → `transform` 一次仿射 →
       `drawImage` 那一小块。所以整张图按 6×3 格剖开，每格一次 —— 透视下一个小格内
       仿射已经够准（一个格子里那点非线性看不出来）。
       `transform` 是**乘**在当前矩阵上（当前是 dpr 那层），所以不会被顶掉。 */
    function drawTexCell(tex, u0, v0, u1, v1, d) {
      var sx = u0 * tex.w;
      var sy = v0 * tex.h;
      var sw = (u1 - u0) * tex.w;
      var sh = (v1 - v0) * tex.h;
      if (sw <= 0.5 || sh <= 0.5) { return; }
      c.save();
      c.beginPath();
      c.moveTo(d[0].x, d[0].y);
      c.lineTo(d[1].x, d[1].y);
      c.lineTo(d[2].x, d[2].y);
      c.lineTo(d[3].x, d[3].y);
      c.closePath();
      c.clip();
      c.transform((d[1].x - d[0].x) / sw, (d[1].y - d[0].y) / sw,
                  (d[3].x - d[0].x) / sh, (d[3].y - d[0].y) / sh,
                  d[0].x, d[0].y);
      c.drawImage(tex.cv, sx, sy, sw, sh, 0, 0, sw, sh);
      c.restore();
    }

    var minX = xx(range[0]);
    var maxX = xx(range[1]);
    var dots = [];
    var selectedNode = null;
    var depth = state.view === 'axis' ? 0 : 20;
    var i;

    /* ---- 地面与坐标轴 ----
       两处按用户 2026-09-30 改：
       ① 年份刻度**贴着那条棱**写（原来往右偏 64px，"他离得有点远，导致那些线感觉是跟标错了一样"——
          现在就是一根小刻度 + 紧挨着的年份，落在它自己那根格线上）；
       ② 地面**顺着往外画到 2028**（轴外那段用更淡的线）：底下那排题目点要站在轴外那一格上。 */
    if (state.view !== 'axis') {
      var zLines = Math.ceil(FUTURE_Z / 4);
      for (i = 0; i <= zLines; i += 1) {
        var lz = i * 4;
        if (lz > FUTURE_Z) { break; }
        line(p(minX, 0, lz), p(maxX, 0, lz), grid, lz <= depth ? 0.48 : 0.2);
      }
      for (i = 0; i <= 10; i += 1) {
        var lx = minX + (maxX - minX) * i / 10;
        line(p(lx, 0, 0), p(lx, 0, depth), grid, 0.48);
        if (i % 2 === 0) { line(p(lx, 0, depth), p(lx, 0, FUTURE_Z), grid, 0.2); }
      }
      line(p(minX, 0, 0), p(minX, 22, 0), grid, 0.8);
      line(p(maxX, 0, 0), p(maxX, 0, depth), grid, 0.9);
      /* 这两根棱的位置记下来：光标压上来时滚轮就只缩这一根（用户 2026-10-01）。
         记的是**屏幕两端 + 对应的世界两端**（世界那对用来算"光标底下是轴上哪一点"）。 */
      axisSegs.y = { a: p(minX, 0, 0), b: p(minX, 22, 0), wa: [minX, 0, 0], wb: [minX, 22, 0] };
      axisSegs.z = { a: p(maxX, 0, 0), b: p(maxX, 0, depth), wa: [maxX, 0, 0], wb: [maxX, 0, depth] };
      /* 「Y · 综合难度」「Z · 学习时间」两处标签按用户 2026-09-30 收起来（"就光隐藏就行"）——
         轴还在、刻度还在，只是不挂这八个字。学年刻度（TIME_TICKS）照旧、并且紧挨着轴。
         轴外那两年**不画刻度也不写年份**（用户 2026-09-30："我说的 2028 年是指大约说的那个位置，
         但是那条线和那个数不需要出现……那个位置我们知道就行了"）—— 地面那几根淡格线留着，
         让人看得出"这一排站在轴外"，但不给它安一个年份。 */
      TIME_TICKS.forEach(function (t) {
        if (t.future) { return; }
        var pt = p(maxX, 0, t.z);
        line(p(maxX, 0, t.z), p(maxX + 1.4, 0, t.z), grid, 0.4);
        if (t.label) { text(t.label, { x: pt.x + 9, y: pt.y + 4 }, muted, 'left', 11); }
      });
    } else {
      /* 平面那一档的「Y · 综合难度」也一起收起来（只留 1–5 五个档号，见下） */
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

    /* 一格 = `100/span` 个世界单位（就是 `xx()` 那把尺子）；它在屏幕上有多宽**实量一次**
       （用 `p()` 投影出来），拆块的门槛就看这个数 —— 实量而不是写解析式，转视角 / 透视都不跑偏。
       `blocksOpen`：这一档渲染（柱）**且**放大到一格 ≥ 56px，才把每格按卡片权重切开。 */
    var gridW = 100 / span;
    var gridPx = Math.abs(p(xx(1), 0, currentZ).x - p(xx(0), 0, currentZ).x);
    var blocksOpen = state.render === 'bars' && gridPx >= CARD_MIN_GRID_PX;
    /* 这三个量挂到 `viewRef` 上（`WK_TIMELINE_3D.coordinates()` 就能读）——
       拆块的门槛是"一格多少屏幕像素"，光看状态变量看不出到底到没到，得能直接量。 */
    viewRef.current.gridW = gridW;
    viewRef.current.gridPx = gridPx;
    viewRef.current.blocksOpen = blocksOpen;
    /* 一道题落在**它考的那一块**上的世界 x 偏移（相对格子中心）—— 切片上的点按这个定位。
       没到门槛 / 没卡 / 题上没标块 → 就还是格子中心（0）。 */
    function blockOffset(n, card) {
      if (!blocksOpen || !n) { return 0; }
      var bl = cardBlocks(n.cards, gridW, gridPx);
      if (!bl || !bl[card]) { return 0; }
      return bl[card].cx;
    }

    /* ---- 实物卷：钉住的那一场，把它的**两张卷子（正面 / 反面）立起来**（用户 2026-10-01）----
       "右边加一个按钮，前提是尤且仅有他选择了单个的试卷之后，然后这个按钮才出现，表示是我们这个
        卷子、实物的这个卷子。然后点击了之后……在立体空间当中也是竖着两张卷子，一个是正面，
        一个是反面，就代表着这考试的这次卷子。"
       "然后审的那个题，各个的题目，然后就直接对应那个点，就是相对应那个考点，就代表着这个考点是怎么来的。"
       —— 摆法照那场考试的**玻璃板**（同一个 z 面上的竖直面），只是**往过去挪 2.5 年**、
       立在**另外一个日期格**上（≈ 上一格），稍微浮在地面上；
       卷面上批出来的错题圈红框，再从框心牵一根斜虚线到**场景里那个考点点**上。
       **默认不显示**（`state.paper3d` 初值 false），点了右侧那颗按钮才立起来。 */
    state.paperHit = [];
    var paperData = (state.view !== 'axis' && state.paper3d && pinnedInfo && SCAN)
      ? SCAN.of(state.exam) : null;
    /* 卷子收掉了（或这一场根本没有），"压在卷子上"这个划过状态也一并清掉，
       免得下次按 100% 画一张根本没画出来的卷子。 */
    if (!paperData) { state.hoverPaper = false; }
    if (paperData) {
      var SHEET_H = 8.5;             /* 一张卷子立起来多高（世界单位） */
      var SHEET_GAP = 2.4;
      var SHEET_BOTTOM = 8;          /* **浮在空中**（用户 2026-10-02："它是浮在空中，稍微浮在空中"，
                                        随后又说"你现在放的位置挺好，我还可以再往上再往上来一点"）——
                                        原来摞在切片头顶（24）是错的："他是立在上面，这是不对的。" */
      /* **半透明，鼠标压上去才满**（用户 2026-10-02："默认设置它，这个是半透明的这个状态。然后鼠标
         滑上去的时候，它再显示透明度百分之百。原来透明度可能在 60%~70% 吧，这样的目的是为了不挡住。
         大约是 80% 吧，你就直接定好，默认 80%，鼠标滑上去的时候 100%"）——
         目的是**不挡后面的东西**：卷子大，压着后面那些柱子和点。 */
      var SHEET_ALPHA = 0.8;
      var alpha = state.hoverPaper ? 1 : SHEET_ALPHA;
      c.globalAlpha = alpha;
      /* 摆在哪一格：**往过去挪 2.5 年**（用户 2026-10-02："那个位置……应该是往后。大约位置在
         2023 年那地儿。你可以把它理解为是 2023 年的其中一个切片位置。这样它这个空间关系就可以
         拉得开……它每一次考试基本上就和它拉开大约两年或者三年的距离"）——
         不再贴在考试自己那块板旁边（那样纸和考点挤在一起，看不出"这个考点是怎么来的"）。 */
      var zPaper = zOf(pinnedInfo.day - PAPER_BACK_MS);
      var midPaper = xx((pinnedInfo.range[0] + pinnedInfo.range[1]) / 2);
      var pgList = paperData.pages.slice(0, 2);
      pgList.forEach(function (pg) { loadPaperTex(pg.file); });
      var wides = pgList.map(function (pg) {
        var t = paperTex[pg.file];
        return (t ? t.ar : 2.2211) * SHEET_H;
      });
      var totW = wides.reduce(function (s, v) { return s + v; }, 0) +
        SHEET_GAP * Math.max(0, pgList.length - 1);
      var curL = midPaper - totW / 2;
      var exP = examById(state.exam);
      pgList.forEach(function (pg, si) {
        var tex = paperTex[pg.file];
        var wS = wides[si];
        var xL = curL;
        var xR = curL + wS;
        var yB = SHEET_BOTTOM;
        var yT = yB + SHEET_H;
        curL = xR + SHEET_GAP;
        var dTL = p(xL, yT, zPaper);
        var dTR = p(xR, yT, zPaper);
        var dBR = p(xR, yB, zPaper);
        var dBL = p(xL, yB, zPaper);
        state.paperHit.push({ page: si, quad: [dTL, dTR, dBR, dBL] });
        if (tex) {
          /* 这一大块贴图就是"最挡后面东西"的那部分 —— 按 `alpha` 画。
             注意 `line()` / `polygon()` 各自会把 globalAlpha 调回 1，所以每张卷子进这一支都要重压一次。 */
          c.globalAlpha = alpha;
          var NC = 6;
          var NR = 3;
          for (var ci = 0; ci < NC; ci += 1) {
            for (var cj = 0; cj < NR; cj += 1) {
              var u0 = ci / NC;
              var u1 = (ci + 1) / NC;
              var v0 = cj / NR;
              var v1 = (cj + 1) / NR;
              drawTexCell(tex, u0, v0, u1, v1, [
                p(xL + u0 * wS, yT - v0 * SHEET_H, zPaper),
                p(xL + u1 * wS, yT - v0 * SHEET_H, zPaper),
                p(xL + u1 * wS, yT - v1 * SHEET_H, zPaper),
                p(xL + u0 * wS, yT - v1 * SHEET_H, zPaper)
              ]);
            }
          }
        } else {
          polygon([dTL, dTR, dBR, dBL], muted, 0.3 * alpha);
        }
        line(dTL, dTR, muted, 0.45 * alpha);
        line(dTR, dBR, muted, 0.45 * alpha);
        line(dBR, dBL, muted, 0.45 * alpha);
        line(dBL, dTL, muted, 0.45 * alpha);
        /* 卷面上**批出来的错题**：红框圈住，再从框心牵一根斜虚线到场景里那个考点点 */
        paperData.boxes.forEach(function (o) {
          if (o.p !== si) { return; }
          var item = exP && exP.paper[o.q - 1];
          if (!item) { return; }
          var bxA = xL + o.x / 100 * wS;
          var bxB = xL + (o.x + o.w) / 100 * wS;
          var byA = yT - o.y / 100 * SHEET_H;
          var byB = yT - (o.y + o.h) / 100 * SHEET_H;
          var rf = [p(bxA, byA, zPaper), p(bxB, byA, zPaper),
                    p(bxB, byB, zPaper), p(bxA, byB, zPaper)];
          var on = state.pickedQ !== null && state.pickedQ + 1 === o.q;
          rf.forEach(function (pt, k2) {
            line(pt, rf[(k2 + 1) % 4], weak, on ? 1 : 0.75, on ? 2 : 1.4);
          });
          var kk = item.index - SPAN.from;
          var nd = NODES[kk];
          if (!nd || kk < range[0] || kk > range[1]) { return; }
          var tgt = p(xx(kk) + blockOffset(nd, item.card), nd.difficulty * 4, zOf(pinnedInfo.day));
          line(p((bxA + bxB) / 2, (byA + byB) / 2, zPaper), tgt, accent, 0.28, 1, [3, 3]);
        });
      });
      /* 写一句"点它就是平整地展开" —— 落在**卷子跟前、贴着地面**那一带（往观众这侧再挪 2.4），
         原来写在卷子头顶（+2.4 世界单位）会跟考试切片那一带撞在一起（用户 2026-10-02 之后
         卷子挪到了过去那一格，头顶那行字正好压回切片上）。 */
      c.globalAlpha = alpha;
      text('实物卷 · ' + pinnedInfo.name + '（点它 → 平铺展开）',
           p(midPaper, 0.8, zPaper - 2.4), muted, 'center', 11);
      c.globalAlpha = 1;
    }

    /* ---- 考试切片：一次考试 = 一块立在它那天的竖直板 + 覆盖点 ----
       时间条拖到哪一天，就只画**已经考过**的那些（原型 `e.day <= 当前那天`）。
       选中（钉住）某一场之后：只有这一场和它考到的那些知识点是彩色的，其余灰显；
       划过的那一场只把**边框描重**（用户 2026-09-30 定的两种状态）。 */
    var pinned = state.exam;
    var coveredByPinned = pinned ? COVERED[pinned] : null;
    /* 考试切片**一直在**（用户 2026-10-01："这个切片是由这个时间轴来控制的，滑动时间轴就知道
       我们有多少"）—— 它不再是"图层开关"，所以这里只挡平面视角那一档。 */
    if (state.view !== 'axis') {
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
        /* 板上按**难度分层**切出刻度（用户 2026-09-30："在这个玻璃板上会切一些难度……
           在上面会分一二三四"）—— 五档（基础 4 / 概念 8 / 应用 12 / 变化 16 / 综合 20），
           只在钉住或划过这一场时画：十几块板都挂刻度就糊成一片了。 */
        if (hot || hov) {
          for (var lv = 1; lv <= 5; lv += 1) {
            line(p(xx(a), lv * 4, z), p(xx(b), lv * 4, z), levelColor(lv), 0.26);
            var mid = p(xx(a), (lv - 0.5) * 4, z);
            text(String(lv), { x: mid.x - 7, y: mid.y + 4 }, levelColor(lv), 'right', 10);
          }
        }
        /* 板上的点：**一道题一个点**（不再是一个考点一个点）——
           位置落在**这道题考的那一块**上（`item.card` → `blockOffset()`）。
           用户 2026-10-01："同样的一个知识点，比如绝对值这个知识点，第七题是因为概念不清，
           第八题是因为计算错了数，也就是计算不清。只有这样才能分清楚。"
           —— 同一个考点的两道题落在不同的块上，屏幕上自然就错开了（再配上柱子顶上
           写出来的块名，一眼看出"第 7 题错在概念、第 8 题错在计算"）；
           还没放大到门槛（`blocksOpen` 为假）时偏移是 0，全落回格子中心 —— 跟以前一样只看到一个点。 */
        e.paper.forEach(function (item, qi) {
          var k = item.index - SPAN.from;
          if (k < range[0] || k > range[1]) { return; }
          var nd = NODES[k];
          if (!nd) { return; }
          var bx = xx(k) + blockOffset(nd, item.card);
          var pt = p(bx, nd.difficulty * 4, z);
          /* 选中这一场：板上的点**用一条曲线连到对应柱子的那一块**（照原型"前置关联"那套画法）——
             一看就知道这几道题考的是哪几根柱子、柱子上的哪一块（用户 2026-09-30） */
          if (hot) {
            var top = p(bx, nd.difficulty * 4, currentZ);
            c.beginPath();
            c.moveTo(pt.x, pt.y);
            c.bezierCurveTo(pt.x, pt.y - 22, top.x, top.y - 22, top.x, top.y);
            c.strokeStyle = levelColor(nd.difficulty);
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
          /* 鼠标**正划在板上的这「一个」点**上：锁一个圈 + 就地写出这是哪个考点
             （用户 2026-09-30："鼠标滑到那个玻璃板上……它不是小手，可能是一个小圆圈，
             并锁定某个点，表示这考的是哪个考点"）。
             —— 现在一个考点可能有好几个点（一道题一个），所以**只锁光标底下那一个**：
             拿 `state.hoverPt`（就是刚命中的那个点的屏幕位置）比出来。不这么收的话，
             同一个考点的几个点会**同时**套圈、同时写出好几行字，糊成一片。 */
          if (state.hoverSlice && state.hovered === k && hov && state.hoverPt &&
              Math.abs(pt.x - state.hoverPt.x) < 0.5 && Math.abs(pt.y - state.hoverPt.y) < 0.5) {
            c.beginPath();
            c.arc(pt.x, pt.y, 8.5, 0, Math.PI * 2);
            c.strokeStyle = accent;
            c.globalAlpha = 0.95;
            c.lineWidth = 1.6;
            c.stroke();
            c.globalAlpha = 1;
            c.beginPath();
            c.moveTo(pt.x - 12, pt.y);
            c.lineTo(pt.x - 5.5, pt.y);
            c.moveTo(pt.x + 5.5, pt.y);
            c.lineTo(pt.x + 12, pt.y);
            c.strokeStyle = accent;
            c.globalAlpha = 0.5;
            c.lineWidth = 1;
            c.stroke();
            c.globalAlpha = 1;
            text(String(nd.no).padStart(4, '0') + ' · ' + nd.name,
                 { x: pt.x, y: pt.y - 14 }, accent, 'center', 11);
          }
          /* `card` / `qi` 带上：底板那一行提示要据此说出"第 N 题 · 落在「概念」这一块" */
          dots.push({ x: pt.x, y: pt.y, id: k, exam: e.id, r: 5, onSlice: true,
                      card: item.card, qi: qi });
        });
        dots.push({ quad: pts, id: -1, exam: e.id, r: 0 });
        /* 考试的名字**默认不写**，划到或钉住时才出现（用户 2026-09-30）——
           而且这行字就是**这场考试的标题**：名字 · 月日 · 实得 / 满分（用户 2026-09-30：
           "应该还得加上基础信息，比如月几号、四年级年级考时间、考试的基础分、满分多少、
           考了多少分。它应该类似标题"）。 */
        if (hot || hov) {
          /* 切片顶上那行**标题**（用户 2026-10-01："上面那个时间只不过没加上年，你需要加上年"）——
             月日之前补上**年**，年月日一眼看全，省得再去时间轴上对年份。
             离切片顶边的距离**从 10px 提到 19px**（用户 2026-10-01："那指示信息的标题稍微往上一点"）
             —— 原来几乎贴在切片上沿、压着板顶那条边；往上抬一截才看得清是"这一场的标题"。 */
          text(cnDate(e.date) + ' · ' + e.name + ' · ' + e.got + ' / ' + e.full + ' 分',
               { x: pts[3].x, y: pts[3].y - 19 }, accent, 'left', 12);
        }
      });
    }

    /* ---- 知识柱（原型：一根竖线 + 基点） ---- */
    /* ---- 投入练习图层（照参照原型那个模块：按时间数投入量）----
       原型画的是"有效学习时间（分钟）+ 新题 / 复做"两段，我们**没有时长**这条数据，
       所以这一层只数**题量**：每两周一片，片高 = 新题 + 复做（下段主色 = 新题、
       上段灰 = 复习与纠错）。片立在**地面最左端那条带**上（x 的窄条 = "跟哪一格无关"），
       位置沿 Z 排开 —— 一眼看出哪个学期投入得多、哪个学期塌下去。 */
    if (state.layers.effort && state.view !== 'axis') {
      var bx0 = -50;
      var bx1 = -35;
      EFFORT.forEach(function (o) {
        if (o.at > state.dayMs) { return; }
        var ez = zOf(o.at);
        var hAll = (o.first + o.redo) / EFFORT_MAX * 21;
        var hFirst = o.first / EFFORT_MAX * 21;
        polygon([p(bx0, 0, ez), p(bx1, 0, ez), p(bx1, hAll, ez), p(bx0, hAll, ez)], muted, 0.34);
        polygon([p(bx0, 0, ez), p(bx1, 0, ez), p(bx1, hFirst, ez), p(bx0, hFirst, ez)], accent, 0.55);
      });
      /* 名签写在这条带子的最前端（我们这条 z 越小越靠近观众） */
      var eLbl = p(bx0, 24, zOf(DAY0));
      text('投入练习 · 每两周题量（新题 + 复做）', { x: eLbl.x, y: eLbl.y }, ink, 'left', 12);
    }

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
      /* 格子够宽就把这一格**按卡片权重切成几块**（宽度 = 权重、颜色 = 这块自己的状态）——
         与平面数轴那一层同一套算法（见上面的 `cardBlocks`）。没到门槛 / 没卡 → 还是原来那根细线。
         用户 2026-10-01："我现在只有一根线，这是不行的……首先得有个宽度。"
         注意 `off` 那一档（钉住别的场时的灰显）**也照画**，只是统一涂灰（跟整格那一层一个待遇）。 */
      var blocks = blocksOpen ? cardBlocks(n.cards, gridW, gridPx) : null;
      if (blocks) {
        blocks.forEach(function (b, bi) {
          if (b.px < 0.4) { return; }
          var bcolor = state.colorMode === 'stage' ? ((s && s.color) || accent)
                                                   : ((STATUS[b.card.status] || {}).color || muted);
          var balpha = off ? 0.14
            : (n.id === state.selected ? 0.95 : (b.card.status === UNSEEN ? 0.35 : 0.64));
          var b0 = p(xx(n.id) + b.cx, 0, currentZ);
          var b1 = p(xx(n.id) + b.cx, n.difficulty * 4, currentZ);
          line(b0, b1, off ? grid : bcolor, balpha, Math.max(1, b.px));
          /* 这一块宽到写得下名字，就把**卡片名**写在柱顶上方（照平面那条规则：宽 ≥ 34px 才写）——
             没有它就只看到"分成几块、哪块宽"，看不出哪块是哪块；有了它，
             切片上那些点落在哪一块就能直接读出来（"第 7 题错在概念"）。 */
          if (!off && b.px >= CARD_NAME_PX) {
            text(b.card.type, { x: b1.x, y: b1.y - 6 }, bcolor, 'center', 10);
          }
          /* 每一块都进命中表（`id` 仍是这个知识点）—— 柱子铺开之后，光靠格子中心那一个点
             已经够不着两侧的块了，不补就是"看得见、hover 不出来"。
             `card` 带上块号：底板那一行提示要据此说出"落在哪一块"。 */
          dots.push({ x: b1.x, y: b1.y, id: n.id, base: b0, r: 4, card: bi });
        });
      } else if (state.render === 'bars') {
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

    /* ---- X 轴（与柱子同一条 z）----
       轴上原来那排**年级名**和「X · 知识序列」标签一起撤掉（用户 2026-09-30）：
       "这个数轴上面的一年级、二年级、三年级、四年级，还有知识序列应该去掉……
       因为上面这个考试有这个三年级学年考，他已经知道是哪个年级的考试了"。
       只留一条轴线 —— 年级信息由考试切片自己的名字给。 */
    line(p(minX, 0, currentZ), p(maxX, 0, currentZ), muted, 0.45, 1);
    axisSegs.x = { a: p(minX, 0, currentZ), b: p(maxX, 0, currentZ),
                   wa: [minX, 0, currentZ], wb: [maxX, 0, currentZ] };

    /* ---- 钉住那一场：**这一道道题**排成一排（用户 2026-09-30）----
       链子：切片上的考点 →（曲线）柱状图上的知识点 →（引线）→ 这一道道题。
       一个点 = **卷面上的一道题**（同一个考点考了两道就摆两个点）。
       长度按用户第二次的话定：**这块切片宽度的 2.2 倍**（"我说了是 2 倍到 2.5 倍……
       拉开的时候是比较舒适的那种感觉，每个点都能够知道"），再往外挪一点。
       点到的**那一道题**（`state.pickedQ`）连同它对应的知识点一起高亮。 */
    if (pinned !== null && state.view !== 'axis') {
      var pe = null;
      EXAMS.forEach(function (e) { if (e.id === pinned) { pe = e; } });
      if (pe) {
        var sa = Math.max(range[0], pe.range[0]) - 0.5;
        var sb = Math.min(range[1], pe.range[1]) + 0.5;
        var slabMid = (xx(sa) + xx(sb)) / 2;
        var rowW = Math.min(240, (sb - sa) / span * 100 * 3.3);
        /* 这一排站在**轴尾再往外两年**（≈ 2028 那一格）—— 用户 2026-09-30："底下一整排题目
           那个点，我说了再往外，使劲往外。大约是一格的距离……大约是在 2028 年那个位置。"
           地面网格已经跟着画到那儿了（见"地面与坐标轴"那段）。 */
        var rowZ = FUTURE_Z;
        var qN = pe.paper.length;
        var slot = rowW / Math.max(1, qN);
        /* 题号**只标做错的那几道**（用户 2026-09-30："我问问出的这些题目是错题吗？我觉得最好
           直接出第多少题第多少题，比如第 18 题，就直接出这 18 个红圈，然后对应的是第多少题，
           就是错的题出来"）—— 对的题不写字。
           用户 2026-10-01："做错的题目有好多，被红圈圈起来的有很多，但是显示红色多少第多少题的少？
           应该每个做错的都有文字标记出来" —— 原来那句"至少隔 5 个世界单位才标一个"会**漏标**
           （实测 E3：4 道错题只画出 3 个题号）。现在**每条错题都标**，怕字摞在一起就
           **分四条"车道"轮流往外牵**（在屏幕竖直方向错开 12px，线也跟着指到那一行）。 */
        var labN = 0;
        pe.paper.forEach(function (item, qi) {
          var k = item.index - SPAN.from;
          var nd = NODES[k];
          if (!nd) { return; }
          var qx = slabMid - rowW / 2 + slot * (qi + 0.5);
          var q = p(qx, 0, rowZ);
          var foot = p(xx(k), 0, currentZ);
          var bad = item.score * 5 < item.full * 3;
          var lc = levelColor(nd.difficulty);
          var pick = state.pickedQ === qi;             /* 就是"我点的那道题" */
          /* 点开的那个**考点**（`state.nodeAt`）在这一场里考到的题也一起亮（用户 2026-10-01：
             "它代表的是我点击了这个考点，这个考点相关的那两道题"）—— 一个考点考了几道就亮几道。 */
          /* `pickedQ === null` 这一条是关键：**点的是"某一道题"时只亮那一道**（不再连带兄弟题），
             点的是"考点"（柱顶 / 切片上的那个点）时才是整组亮 —— 用户 2026-10-01：
             "点……题目相关的点，原来是只能点一个，现在为什么经常能点两三个？这个是不对的。"
             浮窗该弹还是弹（`nodeAt`），它管的是"弹哪个窗"，不管"亮几道"。 */
          var mine = state.nodeAt !== null && k === state.nodeAt && state.pickedQ === null;
          var hi = pick || mine;
          /* 这一根线**一道题只有一根**，起点一律是**柱脚**（和这一排里其它题的线同一个起点、
             同一个方向）。用户 2026-10-01："我点了知识点，弹出来那个线的方向和现在它展示的
             方向有些许差别，你仔细核对一下它的样式有差别" —— 原来点开考点时是**两根**：
             这一根从柱脚牵出去（实线加粗），另一根从**柱顶**斜下来（虚线），两根方向正好相反，
             看着就是两支箭对射。现在合成一根：考点选中的那几道，就把这一根画成**斜虚线**。 */
          line(foot, q, hi ? accent : (bad ? weak : lc),
               pick ? 0.95 : (mine ? 0.62 : (bad ? 0.4 : 0.26)),
               pick ? 2.4 : (mine ? 1.4 : 1),
               (mine && !pick) ? [4, 3] : null);
          if (pick) {
            /* 这道题对应的**知识点**也一起高亮：柱脚到柱顶重描一遍 + 头顶加个圈 */
            line(foot, p(xx(k), nd.difficulty * 4, currentZ), accent, 0.9, 2.4);
            var top = p(xx(k), nd.difficulty * 4, currentZ);
            c.beginPath();
            c.arc(top.x, top.y, 6, 0, Math.PI * 2);
            c.strokeStyle = accent;
            c.lineWidth = 1.8;
            c.stroke();
          }
          c.beginPath();
          c.arc(q.x, q.y, pick ? 5 : (hi ? 4.2 : (bad ? 3.4 : 2.6)), 0, Math.PI * 2);
          c.fillStyle = hi ? accent : lc;
          c.fill();
          if (bad || hi) {
            c.beginPath();
            c.arc(q.x, q.y, pick ? 9 : (hi ? 7 : 5.4), 0, Math.PI * 2);
            c.strokeStyle = hi ? accent : weak;
            c.lineWidth = pick ? 1.8 : 1.4;
            c.stroke();
          }
          /* 题号**不再直接贴在那一排点上**（用户 2026-09-30："现在是直接罗列在那个线上，
             我觉得不合适，挡住了。你可以找到那个点，然后用虚线指出来"）——
             从这个点再往外拉一根虚线，字写在虚线末端；只标错题 + 点开那个考点考到的题（见上）。 */
          if (bad || hi) {
            var lane = labN % 4;
            labN += 1;
            var lab = p(qx, 0, rowZ + 3.4);
            var labY = lab.y + 10 + lane * 12;
            line(q, { x: lab.x, y: labY }, hi ? accent : weak, hi ? 0.66 : 0.30, 1, [3, 3]);
            text('第' + (qi + 1) + '题', { x: lab.x, y: labY + 4 },
                 hi ? accent : weak, 'center', 10);
            /* 这行字本身也是**一个可点的靶子**（用户 2026-10-01："这个第几题是可以点击的。点击之后，
               就出来我们的考点……因为考点框下面就会带着我们这个题目"）—— 那一个点太小、不好点，
               字比点大得多，所以把字也挂进命中表：动作与点那个点**完全一样**。 */
            dots.push({ x: lab.x, y: labY + 2, id: k, exam: pe.id, r: 8, onRow: true, qi: qi,
                        card: item.card });
          }
          dots.push({ x: q.x, y: q.y, id: k, exam: pe.id, r: 7, onRow: true, qi: qi,
                      card: item.card });
        });
      }
    }

    /* 点到的那个考点 → 它考到的那几道题：**没有单独一段了**。
       原来这里另起一根"从柱顶斜下来的虚线"，和上面那一排里"从柱脚牵出去的线"**方向正好相反**，
       两根叠在同一个题点上，看着就是两支箭对射（用户 2026-10-01 点出来的"方向有些许差别"）。
       现在合成上面那一根：考点选中的那几道，把**同一根线**画成斜虚线（`mine` 那一支），
       题点上照样套圈、题号照样变高亮色 —— 起点、方向、样式全和一整排对齐。 */

    /* ---- 这一场考试是**哪一天**：从切片底边拉一根**虚线**到时间轴上，并在**轴上**标出来 ----
       用户 2026-10-01："把虚线加回来。和原来一模一样的样式。只不过时间只在时间轴那儿有时间就行，
       不需要在其他地方。如果放大的时候，还得再抵。在切片底下有，其他的不变。"
       —— ① 虚线：从**切片底边中点** → 时间轴那根棱，`[5, 4]`、alpha 0.5、宽 1.2（和原来一模一样）；
       ② 轴上那个位置画一小道刻度（`maxX → maxX + 1.4`，0.95 / 1.8）+ 一个实心点。
       **没有 ③ 了**：原来还在轴的左边写一行年月日（放大时钳到画面边上），
       用户 2026-10-01 看过成品后让删掉（"选中状态下，下表题删去"）—— 那行字正好压在
       底部时间条 / 年份刻度那一带上，跟时间条自己的日期撞在一起，反而糊。
       现在**那一带只有虚线 + 刻度 + 实心点**，日期不另写：要哪一天，看底部时间条那行。 */
    if (state.exam !== null && state.view !== 'axis') {
      var axEx = examById(state.exam);
      if (axEx) {
        var zAx = zOf(axEx.day);
        var axMid = (xx(Math.max(range[0], axEx.range[0]) - 0.5) +
                     xx(Math.min(range[1], axEx.range[1]) + 0.5)) / 2;
        var axFrom = p(axMid, 0, zAx);
        var zPt = p(maxX, 0, zAx);
        line(axFrom, zPt, accent, 0.5, 1.2, [5, 4]);
        line(p(maxX, 0, zAx), p(maxX + 1.4, 0, zAx), accent, 0.95, 1.8);
        c.beginPath();
        c.arc(zPt.x, zPt.y, 3, 0, Math.PI * 2);
        c.fillStyle = accent;
        c.fill();
      }
    }

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

    /* ---- 数据图层的那两块"图板"：正对观众的一块二维图表（横轴 = 时间）----
       用户 2026-09-30 定的形态：**不做**在盒子里穿来穿去的那种线（横坐标是知识、深度是时间、
       高度是值 —— 三根轴各用一点，投影出来就是一条斜着横穿场景的波浪线，读不出"进度"）。
       两块板并排挂在**盒子前缘正下方那块空处**（z 固定 → 永远正对观众；那儿本来什么都没有，
       所以不挡柱子、不挡年级名、也不压底部时间条）：左 = 学习进度，右 = 成绩变化。
       板上有：板面（压住背后的场景）+ 边框 + **学年竖格**（与 Z 轴同一份刻度）。
       返回的两个函数把"时间 / 比例"映成世界坐标，各自再往上画自己的横格与曲线。 */
    function timeBoard(l, r) {
      var b = -14;                 /* 板底：离地面留一段空 */
      var high = 14;               /* 板高 */
      var z = 1.5;
      var pts = [p(l, b, z), p(r, b, z), p(r, b + high, z), p(l, b + high, z)];
      polygon(pts, paper, 0.9);
      pts.forEach(function (pt, k) { line(pt, pts[(k + 1) % 4], muted, 0.55); });
      var xw = function (ms) { return l + tOf(ms) * (r - l); };
      TIME_TICKS.forEach(function (t) {
        var tms = T0 + (t.z / 20) * (T1 - T0);
        line(p(xw(tms), b, z), p(xw(tms), b + high, z), muted, 0.35);
        if (t.label) { text(t.label, p(xw(tms), b + 1.6, z), muted, 'center', 11); }
      });
      return {
        l: l, r: r, z: z,
        x: xw,
        y: function (k) { return b + k * high; }      /* k = 0…1 的比例 */
      };
    }

    /* ---- 学习进度图层（照参照原型那个模块：累计完成 对 计划）----
       **实线 = 实际**（到那天"首学"过的格数）、**虚线 = 计划**（按 `plannedAt` 该学到第几格），
       两条之间的开口就是那段时间欠下的量；横轴与成绩变化那块板同一份时间刻度。 */
    if (state.layers.progress && state.view !== 'axis') {
      var pB = timeBoard(-42, -6);
      /* 纵轴刻度**与 3D 数轴上的格数对齐**：步长取整（10 / 20 / 25 / 50 / 100 / 200 格里
         第一个不会画出五条以上的），所以读数就是轴上第几格；顶上一格永远是 N（这一段的总格数），
         这样"完成 336 格"能和轴上的格号直接对上。 */
      var pStep = [10, 20, 25, 50, 100, 200].filter(function (s) { return N / s <= 5; })[0] || 10;
      var pTicks = [];
      for (var tv = 0; tv < N; tv += pStep) { pTicks.push(tv); }
      pTicks.push(N);
      pTicks.forEach(function (v) {
        line(p(pB.l, pB.y(v / Math.max(1, N)), pB.z), p(pB.r, pB.y(v / Math.max(1, N)), pB.z), muted, 0.35);
        text(String(v), p(pB.l - 0.8, pB.y(v / Math.max(1, N)), pB.z), muted, 'right', 11);
      });
      text('学习进度 · 累计完成（格）· 实线实际 / 虚线计划',
           p((pB.l + pB.r) / 2, pB.y(1) - 1.2, pB.z), ink, 'center', 12);
      var prevA = null;
      var prevP = null;
      var lastA = null;
      var lastDone = 0;
      var lastPlan = 0;
      PROGRESS.forEach(function (o) {
        if (o.at > state.dayMs) { return; }
        var pa = p(pB.x(o.at), pB.y(o.done / Math.max(1, N)), pB.z);
        var pp = p(pB.x(o.at), pB.y(o.plan / Math.max(1, N)), pB.z);
        if (prevA) {
          line(prevA, pa, accent, 0.85, 1.8);
          line(prevP, pp, muted, 0.6, 1.2, [4, 3]);
        }
        prevA = pa;
        prevP = pp;
        lastA = pa;
        lastDone = o.done;
        lastPlan = o.plan;
      });
      if (lastA) {
        c.beginPath();
        c.arc(lastA.x, lastA.y, 4, 0, Math.PI * 2);
        c.fillStyle = accent;
        c.fill();
        text('实际 ' + lastDone + ' / 计划 ' + lastPlan + ' 格',
             { x: lastA.x, y: lastA.y - 12 }, accent, 'right', 11);
      }
    }

    /* ---- 成绩变化图层（照参照原型那个模块：一条得分率折线）----
       与学习进度同一块形制的图板（右边那块）：横轴 = 时间、纵轴 = **得分率 0–100%**
       （Σ得分 ÷ Σ满分）；板上的点接回考试，点一下就钉住那一场。 */
    if (state.layers.scores && state.view !== 'axis') {
      var sB = timeBoard(6, 42);
      [20, 40, 60, 80, 100].forEach(function (v) {
        line(p(sB.l, sB.y(v / 100), sB.z), p(sB.r, sB.y(v / 100), sB.z), muted, 0.35);
        text(v + '%', p(sB.l - 0.8, sB.y(v / 100), sB.z), muted, 'right', 11);
      });
      text('成绩变化 · 每场考试得分率（%）',
           p((sB.l + sB.r) / 2, sB.y(1) - 1.2, sB.z), ink, 'center', 12);
      var runExams = EXAMS.filter(function (e) { return e.day <= state.dayMs; })
        .sort(function (a, b) { return a.day - b.day; });
      var prevPt = null;
      runExams.forEach(function (e) {
        var pt = p(sB.x(e.day), sB.y(e.score / 100), sB.z);
        if (prevPt) { line(prevPt, pt, accent, 0.8, 2); }
        prevPt = pt;
        var hot = pinned === e.id || state.hoverExam === e.id;
        c.beginPath();
        c.arc(pt.x, pt.y, hot ? 5 : 3.6, 0, Math.PI * 2);
        c.fillStyle = accent;
        c.fill();
        c.beginPath();
        c.arc(pt.x, pt.y, hot ? 9.5 : 6.5, 0, Math.PI * 2);
        c.strokeStyle = accent;
        c.globalAlpha = hot ? 0.55 : 0.22;
        c.lineWidth = 1;
        c.stroke();
        c.globalAlpha = 1;
        if (hot || zoom > 1.6) {
          text(e.score + '%', { x: pt.x, y: pt.y - 12 }, hot ? accent : ink, 'center', 11);
        }
        dots.push({ x: pt.x, y: pt.y, id: -1, exam: e.id, r: 8 });
      });
    }

    /* ---- 光标压在哪根轴上 → 那根轴亮起来 + 报一句"滚轮缩放"（用户 2026-10-01）----
       三根轴都能各自缩放，可轴上**平时一个字都不挂**（2026-09-30 定的口径），
       所以"这根轴能缩"这件事只在光标压上来的时候说一次。 */
    if (state.axisHot && axisSegs[state.axisHot]) {
      var hs = axisSegs[state.axisHot];
      line(hs.a, hs.b, accent, 0.9, 3);
      var hmid = p((hs.wa[0] + hs.wb[0]) / 2, (hs.wa[1] + hs.wb[1]) / 2, (hs.wa[2] + hs.wb[2]) / 2);
      text(AXIS_NAME[state.axisHot] + ' · 滚轮缩放 ' + state.axis[state.axisHot].toFixed(1) + '×',
           { x: hmid.x + 12, y: hmid.y + 4 }, accent, 'left', 11);
    }

    /* ---- 划到的那**一个点**：套一个白圈 ----（用户 2026-10-01："它滑动的同时，应该有一个
       hover 的点，表示我选中了哪一个。可能是个白色的圈，就给人一个提示"）
       白圈 + 一圈很淡的描边：压在亮底或暗底上都还看得出是个圈。 */
    if (state.hoverPt) {
      var hp = state.hoverPt;
      c.beginPath();
      c.arc(hp.x, hp.y, 9, 0, Math.PI * 2);
      c.strokeStyle = readColor('--math-popover');
      c.lineWidth = 2.6;
      c.stroke();
      c.beginPath();
      c.arc(hp.x, hp.y, 9, 0, Math.PI * 2);
      c.strokeStyle = readColor('--math-ink-3');
      c.globalAlpha = 0.5;
      c.lineWidth = 1;
      c.stroke();
      c.globalAlpha = 1;
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
    var dot = null;          /* 最近的那个"点"（板上的考点 / 柱脚 / 那一排里的题） */
    var dotD = 1e9;
    var quad = null;         /* 落在哪块板面上 */
    hitRef.current.forEach(function (pt) {
      if (pt.quad) {
        if (inQuad(x, y, pt.quad)) { quad = pt; }
        return;
      }
      /* 总轴（还没钉住任何一场）时，**切片上的那几个考点点不参与命中** —— 用户 2026-10-01：
         "在总轴的时候，知识切片里面那些点我们就不让它点击了。原因很简单：就是那么小，
         我们肯定是优先选那个切片，要不然容易选不中。" 板面照旧可点（点它就是钉住这一场）、
         柱顶点与底下那一排题点照旧可点（"但是我们轴上的点，还是可以选的"）。
         钉住某一场之后再点板上的点 = 点那个考点（那时它才是主角）。 */
      if (pt.onSlice && state.exam === null) { return; }
      var d = Math.hypot(pt.x - x, pt.y - y);
      if (pt.base) { d = Math.min(d, Math.hypot(pt.base.x - x, pt.base.y - y)); }
      if (d < dotD) { dotD = d; dot = pt; }
    });
    /* **全轴（还没钉住任何一场）时：光标落在某块切片的面上 → 只认这块切片**
       （用户 2026-10-01："在全轴模式下，鼠标只能捕捉考试切片，不能捕捉切片的考点"）。
       为什么非要有这一条：柱顶那个考点点与切片上**同一个考点**的点**同 x、同高、只差一个 z**，
       投影到屏幕上几乎重合 —— 实测 74 个切片考点点里 **61 个被判成了柱顶那个点**，
       于是"指着切片"却把柱子上的考点锁了、板子自己反而不亮。全轴时让板面先赢。
       轴上的点照旧可选（"但是我们轴上的点，还是可以选的"）—— 只有落在板面里的那些才让位。 */
    if (state.exam === null && quad) { return quad; }
    /* **点优先于面**（用户 2026-09-30："鼠标 hover 在考试切片的点的时候，它应该出现类似框住
       这个小点的感觉"）—— 板上的点本来就落在板面里，原来板面判定是 dist=0，会把这个点吃掉，
       于是"划到点上"永远命中不了那个点。现在近到 12px 以内先给点，够不着才算板面。 */
    if (dot && dotD <= 12) { return dot; }
    if (quad) { return quad; }
    if (dot && dotD < 22) { return dot; }
    /* 立在场景里那两张**实物卷**：**最低优先级** —— 卷子很大，可要紧的交互（点那道题、
       点考点、点板面）都压在它身上，别把它们抢了。点它就是"把这张卷子平整地展开"。 */
    var pp = hitPaper(x, y);
    if (pp) { return pp; }
    return null;
  }

  /** 点在不在立起来的那两张实物卷上（在 → `{ paperPage }`，点了就展开这一页） */
  function hitPaper(mx, my) {
    var out = null;
    (state.paperHit || []).forEach(function (o) {
      if (inQuad(mx, my, o.quad)) { out = { paperPage: o.page }; }
    });
    return out;
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

  /* 光标压在哪根轴上（12px 以内算压上）—— 三根轴各自的缩放的入口（用户 2026-10-01）。 */
  function axisUnder(mx, my) {
    var best = null;
    Object.keys(axisSegs).forEach(function (k) {
      var s = axisSegs[k];
      var vx = s.b.x - s.a.x;
      var vy = s.b.y - s.a.y;
      var L2 = vx * vx + vy * vy;
      if (L2 < 64) { return; }
      var t = ((mx - s.a.x) * vx + (my - s.a.y) * vy) / L2;
      t = Math.max(0, Math.min(1, t));
      var d = Math.hypot(s.a.x + vx * t - mx, s.a.y + vy * t - my);
      if (!best || d < best.d) { best = { axis: k, d: d, t: t }; }
    });
    return best && best.d <= 12 ? best : null;
  }

  /* "光标底下是轴上哪一点"（世界坐标）—— 缩放时就拿它当锚点，让它原地不动。 */
  function axisAnchor(hitAxis) {
    var s = axisSegs[hitAxis.axis];
    var t = hitAxis.t;
    return {
      x: s.wa[0] + (s.wb[0] - s.wa[0]) * t,
      y: s.wa[1] + (s.wb[1] - s.wa[1]) * t,
      z: s.wa[2] + (s.wb[2] - s.wa[2]) * t
    };
  }

  function down(e) {
    camStop();                       /* 用户一动手就把相机动画停住（别跟人抢镜头） */
    /* 一按下，划过的那点就旧了（视角马上要动）—— 白圈与底部那一行先收掉，别留个错位的圈 */
    state.hoverPt = null;
    state.hoverRow = null;
    /* 指针捕获兜一下：拿不到捕获也不该把整个"按下"作废（浮动面板抓标题栏那边是同一个写法） */
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) { /* 忽略 */ }
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
    var onSlice = !!(best && best.onSlice);
    var onRow = !!(best && best.onRow);
    /* 光标压在某根轴上吗（用户 2026-10-01："如果鼠标放在时间轴上的时候，就可以缩放"）——
       压上了就把这一根点亮、光标变成"缩放"；轴上本来没有别的东西，所以这一路优先。 */
    var rect = canvas ? canvas.getBoundingClientRect() : { left: 0, top: 0 };
    var mx = clientX - rect.left;
    var my = clientY - rect.top;
    var axHit = axisUnder(mx, my);
    var axKey = axHit ? axHit.axis : null;
    /* **点就在手底下时，轴让位**（用户 2026-10-01 定的口径："8px 内先给点"）——
       底下那一排题号点恰好画在**时间轴轴尾那一条带**上，轴的 12px 判定把它们整排抢走
       （实测那 7 个题号点怎么划都划不到，光标只会变 `zoom-in`）。现在：光标离某个真"点"
       在 8px 以内、又同时压着轴时，**点先来**；8px 之外照旧轴优先（压在轴上滚轮就缩那一根）。 */
    if (axKey && best && !best.quad && typeof best.x === 'number') {
      var pd = Math.hypot(best.x - mx, best.y - my);
      if (best.base) { pd = Math.min(pd, Math.hypot(best.base.x - mx, best.base.y - my)); }
      if (pd <= 8) { axKey = null; }
    }
    /* 划到的那个点的屏幕位置（只有真的命中一个"点"才给它套白圈，板面不算） */
    var pt = (!axKey && best && !best.quad && typeof best.x === 'number') ? { x: best.x, y: best.y } : null;
    /* 鼠标压在这两张**实物卷**上没有（用户 2026-10-02："鼠标滑上去的时候，它再显示透明度百分之百"）
       —— 压上就把那两张按 100% 重画；默认 80%（渲染那段 `SHEET_ALPHA`），这样它就不挡后面的东西。 */
    var overPaper = !!hitPaper(mx, my);
    /* 划到的是那一排里的**某一道题**吗 —— 底下一行提示要指着它说 */
    var rowInfo = (!axKey && onRow) ? { qi: best.qi, k: best.id, exam: best.exam } : null;
    /* 划到的这个点落在**这个知识点的哪一块**上（{ k, card, qi }）—— 柱子上那一块、
       切片上的点、底下那排里的题都带了 `card`；底部那一行提示据此说出"第 N 题 · 落在「概念」这一块"。
       块只有几像素宽、写不下字，所以"是哪一块"只能靠这一行读出来（用户 2026-10-01 要的"分得清"）。 */
    var cardInfo = (!axKey && best && typeof best.card === 'number')
      ? { k: best.id, card: best.card, qi: (typeof best.qi === 'number' ? best.qi : null) }
      : null;
    if (axKey) { id = null; ex = null; onSlice = false; onRow = false; }
    /* 这几个是每次新建的对象，得**按值**比 —— 不然鼠标在同一个点上挪一挪就会重画一整帧。 */
    var ptSame = (pt === null && state.hoverPt === null) ||
      (!!pt && !!state.hoverPt && pt.x === state.hoverPt.x && pt.y === state.hoverPt.y);
    var rowSame = (rowInfo === null && state.hoverRow === null) ||
      (!!rowInfo && !!state.hoverRow && rowInfo.qi === state.hoverRow.qi &&
       rowInfo.k === state.hoverRow.k && rowInfo.exam === state.hoverRow.exam);
    var cardSame = (cardInfo === null && state.hoverCard === null) ||
      (!!cardInfo && !!state.hoverCard && cardInfo.k === state.hoverCard.k &&
       cardInfo.card === state.hoverCard.card && cardInfo.qi === state.hoverCard.qi);
    /* 光标：压轴上 = 缩放；划在**板上的那个点**上时是小圆圈（用户 2026-09-30："它不是小手，
       可能是一个小圆圈，并锁定某个点"）；划在板面 / 底下那排考点点上是可以点的；
       其余交给 CSS 的 grab（拖动转视角）。 */
    if (canvas) {
      canvas.style.cursor = axKey ? 'zoom-in'
        : onSlice ? 'crosshair'
          : (best && (best.quad || onRow || best.paperPage !== undefined)) ? 'pointer' : '';
    }
    if (id !== state.hovered || ex !== state.hoverExam || onSlice !== state.hoverSlice ||
        axKey !== state.axisHot || !ptSame || !rowSame || !cardSame ||
        overPaper !== state.hoverPaper) {
      state.hovered = id;
      state.hoverExam = ex;          /* 划过的那一场 → 给它描个边 */
      state.hoverSlice = onSlice;
      state.axisHot = axKey;         /* 划过的那根轴 → 点亮它（滚轮就缩它） */
      state.hoverPt = pt;            /* 划到的那一个点 → 给它套白圈 */
      state.hoverRow = rowInfo;
      state.hoverCard = cardInfo;    /* 落在哪一块 → 底部那一行提示说出来 */
      state.hoverPaper = overPaper;  /* 压在实物卷上 → 那两张按 100% 重画（默认 80%） */
      render();
      syncReadout();
    }
  }

  /* 划过状态清干净（移出画布 / 移出那条提示时用） */
  function clearHover() {
    if (state.hovered === null && state.hoverExam === null && !state.hoverSlice &&
        !state.axisHot && !state.hoverPt && !state.hoverRow && !state.hoverCard &&
        !state.hoverPaper) { return; }
    state.hovered = null;
    state.hoverExam = null;
    state.hoverSlice = false;
    state.axisHot = null;
    state.hoverPt = null;
    state.hoverRow = null;
    state.hoverCard = null;
    state.hoverPaper = false;
    if (canvas) { canvas.style.cursor = ''; }
    render();
    syncReadout();
  }

  /* ---- 相机动画（用户 2026-09-30："那个时间段的长度可以用动画的形式缩一下，相当于说到这个
     周边范围，这样人家不至于说那么长……感觉操纵不方便"）——
     聚焦 / 松开的时候，中心、缩放、两个角度**一起平滑过渡**（~360ms、easeOutCubic），不硬跳；
     用户一动手（按下或滚轮）就立刻停住，别跟人抢镜头。 */
  var camAnim = { on: false, id: 0, t0: 0, dur: 360, from: null, to: null };

  function camNow() {
    return {
      center: state.center === null ? (RANGE[0] + RANGE[1]) / 2 : state.center,
      zoom: state.zoom, yaw: state.yaw, pitch: state.pitch, panX: state.panX, panY: state.panY
    };
  }

  function camStop() { camAnim.on = false; camAnim.id += 1; }

  function camTo(to) {
    var base = camNow();
    camAnim.from = base;
    camAnim.to = { center: to.center, zoom: to.zoom, yaw: to.yaw, pitch: to.pitch, panX: to.panX, panY: to.panY,
                   flat: !!to.flat };
    camAnim.t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    /* 过渡时长可以单次指定（切片选择器上"划过去就得得得得得得"地一层层切，得比 360ms 快一截，
       不然鼠标扫一趟就是一串拖影） */
    camAnim.dur = to.dur || 360;
    camAnim.on = true;
    var my = camAnim.id + 1;
    camAnim.id = my;
    step();
    function step() {
      if (!camAnim.on || camAnim.id !== my) { return; }
      var now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
      var k = Math.min(1, (now - camAnim.t0) / camAnim.dur);
      var e = 1 - Math.pow(1 - k, 3);
      var a = camAnim.from;
      var b = camAnim.to;
      state.center = a.center + (b.center - a.center) * e;
      state.zoom = a.zoom + (b.zoom - a.zoom) * e;
      state.yaw = a.yaw + (b.yaw - a.yaw) * e;
      state.pitch = a.pitch + (b.pitch - a.pitch) * e;
      state.panX = a.panX + (b.panX - a.panX) * e;
      state.panY = a.panY + (b.panY - a.panY) * e;
      if (k >= 1) {
        state.center = b.flat ? null : b.center;
        camAnim.on = false;
      }
      render();
      syncZoomLabel();
      if (camAnim.on) { window.requestAnimationFrame(step); }
      else { syncReadout(); }
    }
  }

  function select(e) {
    var best = hit(e);
    /* 板上的点**先让位给板面**（用户 2026-09-30："我点击切片，现在还给我出这个考点和这个
       分析、试卷呀？……默认是不出现的，是干干净净的"）：这一场还没钉住时，点在板子上**任何
       地方**都算"点这块板" —— 板上的覆盖点非常密，不让位的话随手一点就命中一个点，
       看着就是"点切片也弹东西"。钉住之后，再点板上的**那个点**才是真的点那个考点。 */
    if (best && best.onSlice && state.exam !== best.exam) {
      state.exam = best.exam;
      state.nodeAt = null;
      state.pickedQ = null;
      state.examWin = false;
      focusExam(best.exam);
      render();
      syncReadout();
      syncZoomLabel();
      return;
    }
    if (best && best.onRow) {
      /* 点在底下那一排里的**某一道题**（直接点那个点，或者点它那行「第 N 题」的字）。
         用户 2026-10-01 第一次："……现在为什么经常能点两三个？这个是不对的。" —— 所以**画布上只亮
         这一道**（`pickedQ`，下面渲染时 `mine` 会因此让位）。
         用户 2026-10-01 第二次："我点击题目……但题目面板还是没有出现。应该点击题目也能出现。"
         —— 所以**浮窗要弹**：`nodeAt` 照设（考点浮窗里就列着这个考点这一场考到的那几道题，
         点中的那道在里面也是高亮的）。两件事各归各的：`pickedQ` 管画布亮几道，`nodeAt` 管弹哪个窗。 */
      if (best.exam !== null && best.exam !== undefined && state.exam !== best.exam) {
        state.exam = best.exam;
        focusExam(best.exam);
      }
      state.pickedQ = typeof best.qi === 'number' ? best.qi : null;
      state.selected = null;              /* 那根柱子不套绿环 —— 点的是一道题，不是一根柱子 */
      state.nodeAt = best.id;
    } else if (best && best.onSlice) {
      /* 点在**切片上的那个考点点**：这才是"点知识点" —— 它的 2~3 道题一起出来
         （连线在那一排里画，起点是柱脚，见 render 里 `mine` 那一支）。 */
      if (best.exam !== null && best.exam !== undefined && state.exam !== best.exam) {
        state.exam = best.exam;
        focusExam(best.exam);
      }
      state.selected = best.id;
      state.nodeAt = best.id;
      state.pickedQ = null;
    } else if (best && best.quad) {
      /* 点在**板面**上（没压到任何点）。
         用户 2026-09-30："我选择了这个考试切片的时候，它不应该出现'考试分析'这个，直接聚焦到
         '我的这次考试'这个图……一个相对地适配" —— 所以这里**不弹**浮窗（要看分析去右侧那排点）。
         用户 2026-10-01（改口径）："我进入了单个的考试切片，然后随便点点外面，空白的地方它就回去了呀……
         点外面的地方和点这个玻璃，它都能回去啊" —— 这里的"回去"指的是**这一场被松开**了
         （板不聚焦、底下那排题没了 = 退出了单个考试），不是相机飞哪儿去。
         **所以：进了这一场之后，点板面的空白处只当"取消当前选中的那个点"，绝不松开这一场。**
         要退出只有右侧那颗「回到总轴」。 */
      if (state.exam === best.exam) {
        state.nodeAt = null;
        state.pickedQ = null;
      } else {
        state.exam = best.exam;
        state.examWin = false;
        state.pickedQ = null;
        focusExam(best.exam);
      }
    } else if (best && best.id >= 0) {
      state.selected = best.id;
      state.nodeAt = best.id;
      state.pickedQ = null;
    } else if (best && best.paperPage !== undefined) {
      /* 点在**立起来的那张实物卷**上 → 把它"平整地展开"（用户 2026-10-01："点击了之后，
         然后这张卷子就在屏幕当中……相当于可以加一个层，这个卷子就在这个屏幕当中出现，
         平整地展开"）。点的是正面就展开正面、点的是反面就展开反面。 */
      openScan(null, best.paperPage);
    } else {
      /* 点空白 = **取消选择**（用户 2026-10-01："如果我鼠标放在空白的地方，点击的时候就相当于
         取消了选择。知识点啊、题目或者画板之类的"）—— 原来漏了**选中的那个点**
         （`state.selected`，图上那个绿圈 + 绿字）没清，点完空白它还杵在那儿。
         **用户 2026-10-01 第二次改口径**（"我进入了单个的考试切片，然后随便点点外面，空白的地方
         它就回去了呀……点外面的地方和点这个玻璃，它都能回去啊"）：这里的"回去"**不是相机飞回总轴**，
         而是**这一场被松开了**（板不聚焦、底下那排题没了 = 退出了单个考试）。
         **所以：点空白只清"选中的点 / 考点 / 题"那个绿圈，绝不松钉子、绝不动相机。**
         进了单个考试之后，要退出**只有右侧那颗「回到总轴」**。 */
      state.selected = null;
      state.nodeAt = null;
      state.pickedQ = null;
      state.hovered = null;
      state.hoverExam = null;
      state.hoverSlice = false;
      state.hoverPt = null;
      state.hoverRow = null;
      if (canvas) { canvas.style.cursor = ''; }
      /* `state.exam` 一个字都不碰、相机一行都不动 —— 点空白只是"取消选中的那个点"，
         不是"退出这一场"。要退出只有右侧那颗「回到总轴」。 */
    }
    render();
    syncReadout();
    syncZoomLabel();
  }

  /* 把相机**适配到这一场考试**（用户 2026-09-30："直接聚焦到'我的这次考试'这个图……
     一个相对地适配"）：视野中心挪到这块板的中间，缩放按"这块板的宽度"给 ——
     **收敛一点**（"它的确需要聚焦，但是你这聚焦的也太大了"），角度同时转到
     **俯视**的参考角度（"你一定要有一个俯视的感觉……让人家可以看到空间关系"）。
     松开时回整根轴，见 select。 */
  function focusExam(id, keepAngle, dur) {
    var e = examById(id);
    if (!e) { return; }
    var sa = Math.max(RANGE[0], e.range[0]) - 0.5;
    var sb = Math.min(RANGE[1], e.range[1]) + 0.5;
    var w = (sb - sa) / N * 100;                 /* 这块板在轴上占多宽（世界单位） */
    camTo({
      center: (sa + sb) / 2,
      zoom: Math.max(1, Math.min(2.6, 100 / Math.max(26, w * 3.2))),
      /* `keepAngle`：从「适配」进来时**保留用户自己调好的角度**，只有"点住这块板"那一下才
         转到默认的俯视参考角（用户 2026-10-01："不要恢复到原来的那种角度……角度也不需要变"） */
      yaw: keepAngle ? state.yaw : -0.08,
      pitch: keepAngle ? state.pitch : 0.70,   /* 约 40° —— 俯得下来看空间关系，又不是死板 45° */
      panX: 0,
      panY: 0,
      flat: 0,
      dur: dur
    });
  }

  function bind() {
    if (!canvas) { return; }
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', function () { pointerRef.current = null; });
    canvas.addEventListener('pointerleave', function () {
      /* 不立刻清：底下的那行提示要能点得着 —— 光标从画布挪到提示上（必然先离开画布）
         也得让提示留着。所以给一个很短的缓冲，进了提示就取消（见 bindChrome 里 hint 那几手）。 */
      hoverOffTimer = window.setTimeout(clearHover, 220);
    });
    canvas.addEventListener('pointerenter', function () {
      if (hoverOffTimer) { window.clearTimeout(hoverOffTimer); hoverOffTimer = 0; }
    });
    canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    canvas.addEventListener('wheel', function (e) {
      e.preventDefault();
      camStop();                     /* 滚轮自己缩放，也把相机动画停掉 */
      var rect = canvas.getBoundingClientRect();
      var axHit = axisUnder(e.clientX - rect.left, e.clientY - rect.top);
      if (axHit) {
        /* 光标压在某根轴上 → **只缩这一根**（用户 2026-10-01："如果鼠标焦点放在时间轴上，
           就可以缩放……我们要对时间的细度进行缩放，拉大或拉小"）；
           锚点 = 光标底下那个轴上的点，它原地不动、两边展开。 */
        dispatch({ type: 'axisZoom', axis: axHit.axis, anchor: axisAnchor(axHit),
                   value: state.axis[axHit.axis] * Math.exp(-e.deltaY * 0.0018) });
      } else {
        dispatch({ type: 'zoom', value: state.zoom * Math.exp(-e.deltaY * 0.0018) });
      }
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

  /* 底部那一行划过提示（用户 2026-10-01："这个提示不要太厚，可以直接就是一排字。它主要要
     表达的就是：这是什么题目？或者这个考的是哪个知识点"＋"如果这个 hover 出现的提示在学习
     时间这个上方出现的话，那我们右上角那个就可以直接删掉了"）。
     一行字，三种来源：
       ① 划到那一排里的**某一道题** → `第 18 题 · 考的是「分数的意义」· 8 / 10 · 错`（点一下打开考点面板）；
       ② 划到某个**考点**（柱顶 / 板上的点）→ `考点 0042 分数的意义 · 难度 3.2 · 考到 5 场`；
       ③ 划到某一场**考试**的板 → `8月29日 · 二年级 · 学年考 · 377 / 530 分`。
     —— 右上角那张卡撤了（信息跟这一行重复），"考到哪几场"并到 ② 里。 */
  function syncHint() {
    var box = el('[data-t3-hint]');
    if (!box) { return; }
    var txt = '';
    var row = state.hoverRow;
    /* 划到的那个点落在**这一格的哪一块**上（`state.hoverCard`）—— 柱子上的块只有几像素宽、
       写不下字，所以"是哪一块"只能在这一行读出来。用户 2026-10-01 要的"同样一个知识点，
       第七题是概念不清、第八题是计算不清，得能分清楚"，落点就在这一句上。 */
    var blkType = '';
    var blkQi = null;
    if (state.hoverCard) {
      var hc = NODES[state.hoverCard.k];
      var hcc = hc && hc.cards && hc.cards[state.hoverCard.card];
      if (hcc) { blkType = hcc.type; blkQi = state.hoverCard.qi; }
    }
    if (row !== null && row !== undefined) {
      var item = null;
      var pe = examById(row.exam);
      if (pe && pe.paper[row.qi]) { item = pe.paper[row.qi]; }
      var nd = NODES[row.k];
      txt = '第 ' + (row.qi + 1) + ' 题';
      if (nd) { txt += ' · 考的是「' + nd.name + '」'; }
      if (item) {
        txt += ' · ' + item.score + ' / ' + item.full +
          (item.score * 5 < item.full * 3 ? ' · 错' : '');
      }
      txt += ' · 点一下看这个考点';
    } else if (state.hovered !== null && state.hovered >= 0 && NODES[state.hovered]) {
      var n = NODES[state.hovered];
      var st = nodeState(n);
      txt = '考点 ' + String(n.no).padStart(4, '0') + ' ' + n.name +
        ' · 难度 ' + n.difficulty.toFixed(1) + (st.mastery ? ' · 掌握 ' + st.mastery + '%' : '');
      var hits = examHits(n.id);
      if (hits.length) { txt += ' · 考到 ' + hits.length + ' 场'; }
      if (state.hoverSlice) { txt += ' · 就是这一场板上的点'; }
      /* 切片上的点是**一道题一个点**：带上题号，"第 7 题 · 考点 XXXX · 落在「概念」这一块" */
      if (blkType && blkQi !== null) { txt = '第 ' + (blkQi + 1) + ' 题 · ' + txt; }
    } else if (state.hoverExam !== null) {
      var he = examById(state.hoverExam);
      if (he) {
        txt = cnDate(he.date) + ' · ' + he.name + ' · ' + he.got + ' / ' + he.full + ' 分';
      }
    }
    if (txt && blkType) { txt += ' · 落在「' + blkType + '」这一块'; }
    box.hidden = !txt;
    box.textContent = txt;
  }

  function syncReadout() {
    var nowEl = el('[data-t3-now]');
    var subEl = el('[data-t3-sub]');
    /* 浮窗都跟着这一帧的投影走：考试浮窗（分析 / 试卷）与右侧那排的选中态 */
    syncReport();
    syncRail();
    syncNodePanel();
    syncHint();
    /* 「清爽模式」与时间条上那排考试小圆点也在这儿跟着状态走 —— 它俩都依赖 dayMs / 钉住的那一场，
       凡是走 syncReadout 的地方（拖时间条、切图层、钉住 / 松开）就都跟上了。 */
    syncClean();
    syncMarks();          /* 时间条上那排考试小圆点：钉住的那场换个颜色（有变化才重建） */
    syncScan();           /* 原卷那一层：钉住的那场有没有原卷、看的哪一页 / 哪一道题 */
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
  }

  function put(parent, cls, txt) {
    var d = document.createElement('div');
    d.className = cls;
    d.textContent = txt;
    parent.appendChild(d);
    return d;
  }

  /* ---- 错因（用户 2026-10-01）----
     词表**只有一份**，在 timeline-data.js 里（`WK_LEARNING.causes`），这里只是查表 —— 别再写一套。
     一道错题的 `causes` 是**数组**（复合叠加）：主因写在行里、叠加的几条与应用依据并进 `title`。 */
  var CAUSE_NAME = {};
  var CAUSE_GROUP = {};
  var CAUSE_BY = {};
  (function () {
    var list = (L && L.causes) || [];
    for (var i = 0; i < list.length; i += 1) {
      CAUSE_NAME[list[i].key] = list[i].name;
      CAUSE_GROUP[list[i].key] = list[i].group;
    }
    var bys = (L && L.causeBys) || {};
    Object.keys(bys).forEach(function (k) { CAUSE_BY[k] = bys[k]; });
  }());

  /** 一道题那一小列里写的字：**主因**（`causes[0]`）；叠加几条就在后面挂个 `+N`。 */
  function causeText(item) {
    if (!item || !item.causes || !item.causes.length) { return ''; }
    var t = CAUSE_NAME[item.causes[0].key] || '';
    if (item.causes.length > 1) { t += ' +' + (item.causes.length - 1); }
    return t;
  }
  /** `title` 上那句完整的话：**哪几条错了、每条的判据是什么** —— 数据要能解释自己。 */
  function causeTitle(item) {
    if (!item || !item.causes || !item.causes.length) { return ''; }
    return item.causes.map(function (c) {
      var nd = NODES[c.k];
      var card = nd && nd.cards && nd.cards[c.card];
      return (nd ? String(nd.no).padStart(4, '0') + ' ' + nd.name : '?') +
        (card ? ' · ' + card.type + '这一块' : '') +
        ' · ' + (CAUSE_NAME[c.key] || c.key) +
        (CAUSE_BY[c.by] ? '（' + CAUSE_BY[c.by] + '，那块正确率 ' + c.acc + '%）' : '');
    }).join('；');
  }
  /** 主因属于哪一组（不会 / 失误）—— 决定这一小列用哪个颜色：
     不会 = 得回去补（用"薄弱"那支强调色）；失误 = 提醒就行（次要灰）。 */
  function causeCls(item) {
    if (!item || !item.causes || !item.causes.length) { return ''; }
    var g = CAUSE_GROUP[item.causes[0].key];
    return 't3-float__cause ' + (g === 'slip' ? 'is-slip' : 'is-gap');
  }

  function examById(id) {
    var out = null;
    EXAMS.forEach(function (e) { if (e.id === id) { out = e; } });
    return out;
  }

  /* ==================================================================== *
   * 原卷（扫描件）——「查看原题」那一层（用户 2026-10-01）
   * --------------------------------------------------------------------
   * 用户："这个题错了，然后就框出来……让学生给他一个错因，如果学生认可，就让他点一下，
   * 或者说默认是认可，除非他自己再叠加一些原因。"
   *     "当我点击这道题，我可以加一个按钮了，查看原题、查看原卷。当点击这个按钮时候，
   *      啪，我们就出来这张卷子了。"
   *
   * 数据（卷名 / 正反面 / 框的坐标）**全从 `WK_EXAM_SCAN` 拿** —— 那是后台批卷接口的模拟；
   * 前台这一层只负责**画**，一个坐标都不在这儿编。将来后台做好，把 exam-scan.js 换成
   * fetch，这里一个字都不用动。
   */
  var SCAN = window.WK_EXAM_SCAN || null;
  /* 学生自己对错因的认领：`{ 'E13|16': { ok: 1, extra: ['calc'] } }`，**只落本机**。
     跟已有的 `wkmath.timeline.marks.v1` 一个套路（本机覆盖表，接后端时整块换成接口）。
     ⚠️ 这一份**不是**学习记录（标记 / 掌握度 / 筛选照旧归 2D），所以它单独开一个键、
     单独一对读写口 —— `verify_3d` 那条"3D 页不写学习记录"的守线按这个口径盯着：
     3D 页里只许出现 `SCAN_KEY` 这一个键，碰 marks / mastery / filter 照样红灯。 */
  var SCAN_KEY = 'wkmath.exam.scan.v1';
  var scanAcks = {};
  (function () {
    try {
      var raw = window.localStorage.getItem(SCAN_KEY);
      scanAcks = raw ? (JSON.parse(raw) || {}) : {};
    } catch (e) { scanAcks = {}; }
  }());
  function scanAckKey(examId, q) { return String(examId) + '|' + String(q); }
  function scanAckOf(examId, q) { return scanAcks[scanAckKey(examId, q)] || null; }
  function scanAckSet(examId, q, patch) {
    var k = scanAckKey(examId, q);
    var cur = scanAcks[k] || {};
    Object.keys(patch).forEach(function (kk) { cur[kk] = patch[kk]; });
    scanAcks[k] = cur;
    try { window.localStorage.setItem(SCAN_KEY, JSON.stringify(scanAcks)); } catch (e) { /* 存不下就算了 */ }
  }

  /* ---- 实物卷用的**贴图**：把两张原图缩到 900 宽存成离屏 canvas ----
     原图 2843×1280，直接当纹理每帧剖格 `drawImage` 太重；3D 里 900 宽足够看。
     `w / h` 记的是**这张离屏图自己**的尺寸（剖格时算源矩形要用它，不是原图的像素数）；
     `ar` 才是原图的长宽比（决定这张卷子在场景里多宽）。 */
  var paperTex = {};
  function loadPaperTex(file) {
    if (file in paperTex) { return; }
    paperTex[file] = null;            /* 占位：正在加载 */
    var im = new Image();
    im.onload = function () {
      var tw = 900;
      var th = Math.max(1, Math.round(tw * im.naturalHeight / Math.max(1, im.naturalWidth)));
      var cv = document.createElement('canvas');
      cv.width = tw;
      cv.height = th;
      cv.getContext('2d').drawImage(im, 0, 0, tw, th);
      paperTex[file] = { cv: cv, w: tw, h: th, ar: im.naturalWidth / Math.max(1, im.naturalHeight) };
      render();
    };
    im.src = file;
  }

  /** 打开原卷（平面展开那一层）。
   *  `q` = 卷面题号（1 起，可省）；`page` = 要展开哪一页（可省）。
   *  两个都不给就挑第一道有框的题（后台只标了错题）。 */
  function openScan(q, page) {
    if (!SCAN || !examById(state.exam)) { return; }
    var list = SCAN.of(state.exam);
    if (!list || !list.boxes.length) { return; }
    var b = (q && SCAN.boxOf(state.exam, q)) || null;
    var pg = (typeof page === 'number') ? page : (b ? b.p : list.boxes[0].p);
    if (!b || b.p !== pg) {
      /* 点了某一页 / 那一道不在这一页上 → 换到这一页里第一道有框的题 */
      var cand = list.boxes.filter(function (o) { return o.p === pg; });
      b = cand.length ? cand[0] : (b || list.boxes[0]);
    }
    state.scanQ = b.q;
    state.scanPage = b.p;
    state.scanOpen = true;
    state.scanPick = false;
    syncScan();
  }
  function closeScan() {
    state.scanOpen = false;
    state.scanPick = false;
    syncScan();
  }

  /** 原卷那一层重画：卷名 / 正反面 / 图 / 框 / 这一道的错因 / 学生的认领 */
  function syncScan() {
    var box = el('[data-t3-scan]');
    if (!box) { return; }
    var list = (state.scanOpen && SCAN) ? SCAN.of(state.exam) : null;
    if (!list) {
      /* 没有原卷（没钉住 / 这一场没扫描件）就把浮层收起，顺手把那个开关归零 ——
         否则松开钉子之后标志还留着，再钉回同一场会突然又弹出来。 */
      box.hidden = true;
      state.scanOpen = false;
      return;
    }
    box.hidden = false;
    var q = state.scanQ;
    el('[data-t3-scan-title]').textContent = list.title;
    /* 正反面 */
    var pgs = el('[data-t3-scan-pages]');
    pgs.textContent = '';
    list.pages.forEach(function (pg, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 't3-scan__page' + (i === state.scanPage ? ' is-on' : '');
      b.setAttribute('data-t3-scan-page', String(i));
      b.textContent = pg.label;
      pgs.appendChild(b);
    });
    /* 图：src 一样就不重设，免得每帧都重新加载 */
    var img = el('[data-t3-scan-img]');
    var file = list.pages[state.scanPage] ? list.pages[state.scanPage].file : '';
    if (file && img.getAttribute('src') !== file) { img.setAttribute('src', file); }
    /* 框：**只有批出来的错题才有**；当前这一道加亮，同一页别的淡着（一眼看出"圈的是哪一道"） */
    var layer = el('[data-t3-scan-boxes]');
    layer.textContent = '';
    list.boxes.filter(function (o) { return o.p === state.scanPage; }).forEach(function (o) {
      var d = document.createElement('div');
      d.className = 't3-scan__box' + (o.q === q ? ' is-on' : '');
      d.style.left = o.x + '%';
      d.style.top = o.y + '%';
      d.style.width = o.w + '%';
      d.style.height = o.h + '%';
      d.setAttribute('data-t3-scan-box', String(o.q));
      layer.appendChild(d);
    });
    /* 这一道题的错因（错因词表与试卷表**同一份**） */
    var ex = examById(state.exam);
    var item = (ex && q && ex.paper[q - 1]) ? ex.paper[q - 1] : null;
    var txt = causeText(item);
    el('[data-t3-scan-q]').textContent = '第 ' + q + ' 题';
    var cs = el('[data-t3-scan-cause]');
    cs.textContent = txt;
    cs.className = txt ? causeCls(item) : '';
    if (txt) { cs.setAttribute('title', causeTitle(item)); }
    /* 认领：**默认就是认可**（用户："或者说默认是认可，除非他自己再叠加一些原因"） */
    var ack = scanAckOf(state.exam, q) || {};
    var extra = ack.extra || [];
    el('[data-t3-scan-ack]').textContent = extra.length
      ? '学生认可 · 自己又叠了：' + extra.map(function (k) { return CAUSE_NAME[k] || k; }).join('、')
      : (ack.ok ? '学生认可' : '默认认可');
    var okBtn = el('[data-t3-scan-ok]');
    if (okBtn) { okBtn.className = 't3-scan__btn' + (ack.ok ? ' is-on' : ''); }
    var addBtn = el('[data-t3-scan-add]');
    if (addBtn) { addBtn.className = 't3-scan__btn' + (state.scanPick ? ' is-on' : ''); }
    var pick = el('[data-t3-scan-pick]');
    pick.hidden = !state.scanPick;
    pick.textContent = '';
    if (state.scanPick) {
      ((L && L.causes) || []).forEach(function (c) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 't3-scan__btn' + (extra.indexOf(c.key) >= 0 ? ' is-on' : '');
        b.setAttribute('data-t3-scan-cause', c.key);
        b.textContent = c.name;
        pick.appendChild(b);
      });
    }
  }

  /* 考试浮窗：**一块浮窗、两个页签**（用户 2026-09-30："我点考试分析的时候，这个页面、
     考试分析里面应该有个 tab，它还有个考卷，也就是试卷……要整合在一起，作为一个 tab 来选择"）——
     「分析」= 这一场考了哪些考点 · 正确率 · 小结（一行一个考点，还写着"这一场考到第几题"）；
     「试卷」= 复刻这张卷子的每一道题（第几题 · 考点 · 难度 · 得分 / 满分 · 对错）。
     两处的行都能点：点考点 → 在轴上点出那一格；点某道题 → 图上那道题和它的知识点一起高亮。
     整块正文一起滚，所以不管哪一页都不会被挤没。 */
  function syncReport() {
    var box = el('[data-t3-examwin]');
    if (!box) { return; }
    var listEl = el('[data-t3-examwin-list]');
    var qListEl = el('[data-t3-examwin-qlist]');
    var shown = examById(state.exam);
    if (!shown || !state.examWin) {
      box.hidden = true;
      if (listEl) { listEl.textContent = ''; }
      if (qListEl) { qListEl.textContent = ''; }
      return;
    }
    /* 页签：当前那一页实心浅色，另一页整块藏起来 */
    var tabs = document.querySelectorAll('[data-t3-exam-tab]');
    for (var t = 0; t < tabs.length; t += 1) {
      var on = tabs[t].getAttribute('data-t3-exam-tab') === state.examTab;
      tabs[t].className = 't3-float__tab' + (on ? ' is-on' : '');
      tabs[t].setAttribute('aria-selected', on ? 'true' : 'false');
    }
    var panes = document.querySelectorAll('[data-t3-exam-pane]');
    for (var pz = 0; pz < panes.length; pz += 1) {
      panes[pz].hidden = panes[pz].getAttribute('data-t3-exam-pane') !== state.examTab;
    }
    var rows = [];
    var dSum = 0;
    var dWrong = 0;
    var lvWrong = {};              /* 每个难度档错了几道 —— 小结那一行要用 */
    var weakNames = [];
    shown.coverage.forEach(function (k) {
      var n = NODES[k];
      if (!n) { return; }
      var lv = Math.max(1, Math.min(5, Math.round(n.difficulty)));
      var bad = !!shown.wrong[k];
      if (bad) {
        dWrong += n.difficulty;
        lvWrong[lv] = (lvWrong[lv] || 0) + 1;
        if (weakNames.length < 3) { weakNames.push(n.name); }
      }
      dSum += n.difficulty;
      rows.push({ i: k, no: n.no, name: n.name, diff: n.difficulty, bad: bad });
    });
    var total = rows.length;
    var wrongN = shown.wrongN;
    var got = 0;
    var fullAll = 0;
    /* 每个考点在这一场里考到**第几题**（一个考点可能考到好几道，所以要列出来）——
       面板里那一行、以及地面上贴地写的那几行，用的都是它 */
    var qOf = {};
    shown.paper.forEach(function (p, qi) {
      var kk = p.index - SPAN.from;
      if (!qOf[kk]) { qOf[kk] = []; }
      qOf[kk].push(qi + 1);
    });
    shown.paper.forEach(function (p) { got += p.score; fullAll += p.full; });
    var worst = 0;
    Object.keys(lvWrong).forEach(function (no) { if (lvWrong[no] > (lvWrong[worst] || 0)) { worst = no; } });

    el('[data-t3-examwin-name]').textContent = shown.name;
    el('[data-t3-examwin-meta]').textContent = shown.date +
      ' · 共 ' + shown.paper.length + ' 道题 · 覆盖 ' + total + ' 个考点 · 第 ' +
      (shown.range[0] + 1) + '–' + (shown.range[1] + 1) + ' 格';
    el('[data-t3-examwin-stats]').textContent =
      '得 ' + got + ' / ' + fullAll + ' 分（得分率 ' + shown.score + '%）· 错 ' + wrongN + ' / ' + total +
      '（正确率 ' + (total ? Math.round((total - wrongN) / total * 100) : 0) + '%）· 平均难度 ' +
      (total ? (dSum / total).toFixed(1) : '—') +
      (wrongN ? '（错的 ' + (dWrong / wrongN).toFixed(1) + '）' : '');
    /* 小结：**按这张卷面算出来的**（这一页里没有模型，所以不编"AI 分析"那种话） */
    el('[data-t3-examwin-note]').textContent = wrongN
      ? ('薄弱：' + levelName(Number(worst)) + '错得最多（' + lvWrong[worst] + ' 题）' +
         (weakNames.length ? '；做错的有 ' + weakNames.join('、') +
           (wrongN > weakNames.length ? ' 等' : '') : ''))
      : ('这一场没有做错的题 —— ' + shown.paper.length + ' 道题全对。');
    el('[data-t3-examwin-cap]').textContent = '考点（点一行 → 在轴上点出那一格）';
    var pStats = el('[data-t3-examwin-pstats]');
    if (pStats) {
      pStats.textContent = '共 ' + shown.paper.length + ' 题 · 得 ' + got + ' / ' + fullAll +
        ' 分（得分率 ' + shown.score + '%）· 错 ' + wrongN + ' 题';
    }
    var qCap = el('[data-t3-examwin-qcap]');
    if (qCap) {
      qCap.textContent = '这份试卷 · ' + shown.paper.length +
        ' 道题（点一行 → 图上那道题和它的知识点一起高亮）';
    }

    /* 上半：考点一行一个（点一行落在轴上那一格）
       —— 每行带上**它自己那一档难度的标准色**（`--lv`），并跟着画布上的 hover 亮起来：
       直接划到这个考点点、或者划到它名下的某一道题，这一行都算"划到了"（见 syncNodePanel 的注释）。 */
    if (listEl) {
      listEl.textContent = '';
      rows.forEach(function (row) {
        var li = document.createElement('li');
        var btn = document.createElement('button');
        btn.type = 'button';
        var hovRow = state.hovered === row.i || (state.hoverRow && state.hoverRow.k === row.i);
        btn.className = 't3-float__row' +
          (state.nodeAt === row.i ? ' is-pick' : '') + (hovRow ? ' is-hover' : '');
        btn.style.setProperty('--lv', levelColor(row.diff));
        btn.setAttribute('data-t3-float-row', String(row.i));
        btn.setAttribute('title', row.name + ' · ' + levelName(row.diff) + ' · 难度 ' + row.diff.toFixed(1));
        put(btn, 't3-float__no', String(row.no).padStart(4, '0'));
        put(btn, 't3-float__nm', row.name);
        put(btn, 't3-float__num', '第 ' + (qOf[row.i] || []).join('·') + ' 题');
        put(btn, row.bad ? 't3-float__bad' : 't3-float__ok', row.bad ? '错' : '对');
        li.appendChild(btn);
        listEl.appendChild(li);
      });
    }
    /* 下半：**这份试卷** —— 卷面里那道题原样列出来（第几题 / 考哪个考点 / 哪一档难度 / 得几分 / 对错） */
    if (qListEl) {
      qListEl.textContent = '';
      shown.paper.forEach(function (p, i) {
        var k = p.index - SPAN.from;
        var n = NODES[k] || { no: p.index + 1, name: '—', difficulty: 1 };
        var bad = p.score * 5 < p.full * 3;
        var li = document.createElement('li');
        var row = document.createElement('button');
        row.type = 'button';
        var qHov = !!(state.hoverRow && state.hoverRow.qi === i);
        row.className = 't3-float__row' + (state.pickedQ === i ? ' is-pick' : '') +
          (qHov ? ' is-hover' : '');
        row.style.setProperty('--lv', levelColor(n.difficulty));
        row.setAttribute('data-t3-float-row', String(k));
        row.setAttribute('data-t3-float-q', String(i));
        row.setAttribute('title', '第 ' + (i + 1) + ' 题 · ' + n.name);
        put(row, 't3-float__no', '第 ' + (i + 1) + ' 题');
        put(row, 't3-float__nm', String(n.no).padStart(4, '0') + ' ' + n.name);
        put(row, 't3-float__num', levelName(n.difficulty));
        put(row, 't3-float__num', p.score + ' / ' + p.full);
        put(row, bad ? 't3-float__bad' : 't3-float__ok', bad ? '错' : '对');
        /* 错在哪、凭什么 —— **只有错题才有**（对的题 `causes` 是 null）。
           用户 2026-10-01："肯定有个错因，分个七八种吧……那七八种里面，他还要叠加这个知识点……
           而且里面这东西是复合叠加的。" 主因写在行里，叠加的几条与判据并进 `title`。 */
        if (causeText(p)) {
          put(row, causeCls(p), causeText(p));
          row.setAttribute('title', row.getAttribute('title') + ' · ' + causeTitle(p));
        }
        li.appendChild(row);
        qListEl.appendChild(li);
      });
      /* 「查看原题」（用户 2026-10-01："当我点击这道题，我可以加一个按钮了，查看原题、查看原卷"）
         —— **点住某一道题之后才出现**；而且那一道在原卷上**有框**才给
         （后台只把批出来的错题标了框，没框的题谈不上去原卷上找那一道）。 */
      var openBtn = el('[data-t3-scan-open]');
      if (openBtn) {
        var hasBox = !!(SCAN && state.pickedQ !== null && SCAN.boxOf(state.exam, state.pickedQ + 1));
        openBtn.hidden = !hasBox;
        if (openBtn.parentNode) { openBtn.parentNode.hidden = !hasBox; }
      }
    }
    closeHelp();
    var tipEl = el('[data-t3-exam]');
    if (tipEl) { tipEl.hidden = true; }
    box.hidden = false;
  }

  /** 选中某一场考试 = 与点那块玻璃板**同一件事**：钉住这一场 + 聚焦过去，**不弹浮窗**
   *  （"点住这块板 → 只做两件事……不弹任何浮窗"是 2026-09-30 定的口径）。
   *  现在只有**底部时间条上那排考试小圆点**调它（点一下那个点 = 选中那一场）。
   *  历史上那条"楼层选择器"整条已经撤掉（用户 2026-10-01："考试切面选择器按钮和它左边的
   *  选择切片 删除"），所以那个 `quick` 的短过渡档虽然还在用，但已经没有"划过去"的来路了。 */
  function pickExam(id, quick) {
    var e = examById(id);
    if (!e || state.exam === id) { return; }
    state.exam = id;
    state.nodeAt = null;
    state.pickedQ = null;
    state.examWin = false;
    state.hoverExam = null;
    state.hoverSlice = false;
    focusExam(id, false, quick ? 190 : undefined);
    render();
    syncReadout();
    syncZoomLabel();
  }

  /* 「清爽模式」（用户 2026-10-01）：
     "左边，还有下边。这些按钮就给……隐藏了……这个按钮如果是隐藏的话，我们就永远回不来了。
      我们在这个右边，把右边这个按钮加一个'清爽模式'……右边这一排按钮是不会消失的。"
     —— 所以状态挂在 <html> 上，由 CSS 把左边的导航与底部的工具条 / 时间条滑走；
     **这一竖排不在被收走的名单里**。 */
  function syncClean() {
    var root = document.documentElement;
    if (!root || !root.setAttribute) { return; }
    root.setAttribute('data-t3-clean', state.clean ? 'on' : 'off');
    var btn = el('[data-t3-rail-clean]');
    if (btn) {
      btn.setAttribute('aria-pressed', state.clean ? 'true' : 'false');
      btn.setAttribute('data-t3-tip', state.clean ? '恢复界面（回到带导航的样子）' : '清爽模式（收起左边的导航与底下的工具条）');
      btn.setAttribute('aria-label', state.clean ? '恢复界面' : '清爽模式');
    }
  }

  /* 右侧那一竖排（用户 2026-09-30："参考那个白板，右边我们也弄上竖的那一排"）——
     ①「难度层」：**点开才展开**那五档（并且**在边上**展开，不把这一竖排自己撑高），
       再在里面勾"要显示哪几档"；
     ②「考试分析」：先点住一块玻璃板，再点它 → 在**左边**弹出那一块浮窗
       （分析 + 这份试卷同在一页），再点一下收起。
     两个按钮的选中态与提示都在这儿同步（按钮本体是纯图标，汉字走 data-t3-tip）。 */
  function syncRail() {
    var shown = examById(state.exam);
    /* 「回到总轴」（用户 2026-10-01："右边现在有两个按钮了。你再加一个，就是总轴……
       意思是回到总轴"）：已经在总轴上了就把提示写成"已经在总轴"，省得以为点了没反应。 */
    var home = el('[data-t3-rail-home]');
    if (home) {
      home.setAttribute('data-t3-tip', shown ? '回到总轴' : '已经在总轴');
      home.setAttribute('aria-pressed', shown ? 'false' : 'true');
    }
    var lvBtn = el('[data-t3-rail-levels]');
    if (lvBtn) { lvBtn.setAttribute('aria-pressed', state.railLevels ? 'true' : 'false'); }
    var lvBox = el('[data-t3-levels]');
    if (lvBox) { lvBox.hidden = !state.railLevels; }
    var rep = el('[data-t3-rail-report]');
    if (rep) {
      rep.setAttribute('aria-pressed', shown && state.examWin ? 'true' : 'false');
      /* 提示就写四个字（用户 2026-09-30："它后面那个备注太长了，直接去掉。就考试分析就行了"） */
      rep.setAttribute('data-t3-tip', shown ? '考试分析' : '先点住一块玻璃板');
    }
    /* 「实物卷」（用户 2026-10-01）："尤且仅有他选择了单个的试卷之后，然后这个按钮才出现" ——
       没钉住某一场就整颗藏起来（连它前面那道分隔线也一起藏，不然竖排里会多一道缝）；
       点开才在 3D 里把那两张卷子立起来（**默认不显示**）。
       **还得再收一道**（用户 2026-10-02："我点击之后没有反应"）：钉住的这一场**得真有那张实物卷**才给，
       否则就是一颗点了没反应的死按钮 —— 演示阶段只有 E13 挂了原卷（`WK_EXAM_SCAN.of` 只认它）。 */
    var pHas = !!(shown && SCAN && SCAN.of(state.exam));
    if (!pHas && state.paper3d) { state.paper3d = false; }
    var pBtn = el('[data-t3-rail-paper]');
    if (pBtn) {
      pBtn.hidden = !pHas;
      pBtn.setAttribute('aria-pressed', state.paper3d ? 'true' : 'false');
    }
    var pSep = el('[data-t3-rail-paper-sep]');
    if (pSep) { pSep.hidden = !pHas; }
  }

  /* 单个考点：**点它**才出现的独立小浮窗（用户 2026-09-30："那个面板是只有在点击这个
     具体的某一个的时候，它出现一个单独的"）—— 这个考点本身 + 它在这场考试里的那道题。 */
  function syncNodePanel() {
    var box = el('[data-t3-nodewin]');
    if (!box) { return; }
    var i = state.nodeAt;
    var n = i === null ? null : NODES[i];
    if (!n) { box.hidden = true; return; }
    var rec = recAt(i) || {};
    el('[data-t3-nodewin-name]').textContent = String(n.no).padStart(4, '0') + ' · ' + n.name;
    el('[data-t3-nodewin-meta]').textContent = [n.grade, n.book].filter(Boolean).join(' / ') +
      ' · ' + levelName(n.difficulty) + '（难度 ' + n.difficulty.toFixed(1) + '）';
    el('[data-t3-nodewin-stats]').textContent = n.status +
      (n.mastery ? ' · 掌握 ' + n.mastery + '%' : '') +
      (rec.learnedAt ? ' · 首学 ' + rec.learnedAt : '') +
      (rec.plannedAt ? ' · 计划 ' + rec.plannedAt : '');
    var listEl = el('[data-t3-nodewin-list]');
    var capEl = el('[data-t3-nodewin-cap]');
    if (!listEl) { box.hidden = false; return; }
    listEl.textContent = '';
    var shown = examById(state.exam);
    /* 这个考点在**这一场**里考到的题 —— 可能不止一道（一个考点能出 1~3 道，见 version log 65）。
       原来这里只留了 `forEach` 的最后一个，于是"考了三次"也只看得到一道；现在全列出来，
       并且把**点中的那道**标成选中态（用户 2026-10-01："考点框下面就会带着我们这个题目"）。 */
    var mines = [];
    if (shown) {
      shown.paper.forEach(function (p, k) {
        if (p.index - SPAN.from === i) { mines.push({ q: k + 1, qi: k, p: p }); }
      });
    }
    if (mines.length) {
      capEl.textContent = mines.length > 1
        ? '这一场里的这 ' + mines.length + ' 道题（点其中一道，图上那一道就亮）'
        : '这一场里的这道题';
      mines.forEach(function (m) {
        var bad = m.p.score * 5 < m.p.full * 3;
        var li = document.createElement('li');
        var row = document.createElement('button');
        row.type = 'button';
        var mHov = !!(state.hoverRow && state.hoverRow.qi === m.qi);
        row.className = 't3-float__row' + (state.pickedQ === m.qi ? ' is-pick' : '') +
          (mHov ? ' is-hover' : '');
        row.style.setProperty('--lv', levelColor(n.difficulty));
        row.setAttribute('data-t3-float-row', String(i));
        row.setAttribute('data-t3-float-q', String(m.qi));
        row.setAttribute('title', '第 ' + m.q + ' 题 · ' + n.name);
        put(row, 't3-float__no', '第 ' + m.q + ' 题');
        put(row, 't3-float__nm', levelName(n.difficulty));
        put(row, 't3-float__num', m.p.score + ' / ' + m.p.full + ' 分');
        put(row, bad ? 't3-float__bad' : 't3-float__ok', bad ? '做错了' : '做对了');
        /* 同「试卷」那一页：错因写在行里（主因），叠加的与判据进 `title` */
        if (causeText(m.p)) {
          put(row, causeCls(m.p), causeText(m.p));
          row.setAttribute('title', row.getAttribute('title') + ' · ' + causeTitle(m.p));
        }
        li.appendChild(row);
        listEl.appendChild(li);
      });
    } else {
      capEl.textContent = '考到过哪几场';
      var hits = examHits(n.id);
      if (!hits.length) {
        var none = document.createElement('li');
        none.className = 't3-float__row';
        put(none, 't3-float__ok', '还没有考到过它');
        listEl.appendChild(none);
      } else {
        hits.forEach(function (nm) {
          var row2 = document.createElement('li');
          row2.className = 't3-float__row';
          put(row2, 't3-float__nm', nm);
          listEl.appendChild(row2);
        });
      }
    }
    box.hidden = false;
  }

  /* 浮窗里那一行（分析 / 试卷两张表都走它）：
     点考点那一行 = 在轴上点出那一格；点**某一道题**那一行 = 除了选中这一格，
     还把那道题记进 `pickedQ` —— 图上那道题与它对应的知识点会一起高亮（用户 2026-09-30：
     "我点击哪道题，哪道题就高亮，知识点高亮，对应的这个题目也高亮"）。 */
  function onFloatRowClick(ev) {
    var node = ev.target;
    var btn = null;
    while (node && node !== ev.currentTarget) {
      if (node.getAttribute && node.getAttribute('data-t3-float-row') !== null) { btn = node; break; }
      node = node.parentNode;
    }
    if (!btn) { return; }
    state.selected = Number(btn.getAttribute('data-t3-float-row'));
    state.nodeAt = state.selected;
    var q = btn.getAttribute('data-t3-float-q');
    state.pickedQ = q === null || q === undefined ? null : Number(q);
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

  /* ==================================================================== *
   * 8. 底部的"适配"（用户 2026-10-01："在底部增加一个适配按钮，放在放大缩小的
   *    减号和加号边上。点击这个按钮，就是把整个时间轴都适配画面。如果点击'当前'
   *    或者点击某个考点，也就是某一段，也要适配这段"）
   *    **口径当天改过**（用户 2026-10-01："点击切片，我们调了它，放大缩小之后，再点击下面的
   *    自适应的时候，不要恢复到原来的那种角度……保留现在的 XYZ，和我们自己设定的一些值之后，
   *    在这个框架内，充满屏幕。它的那个角度也不需要变。"）：
   *      **不再把三根轴的拉伸归位、也不动角度** —— 只把视野中心挪到目标中点、平移归零，
   *      再把缩放算成"在当前这个拉伸和角度下刚好铺满"。
   *      ① 钉住某一场考试  → 适配这一场（含它底下那一排题），走 focusExam(…, 保留角度)；
   *      ② 点开了某个考点  → 以它为中心、左右各 ±8 格铺满；
   *      ③ 其余（刚进来 / 点空白之后）→ 整根时间轴（用量出来的 zoomFitAll）。
   * ==================================================================== */
  var FIT_HALF = 8;                /* 适配单个考点时，左右各留几格 */

  /** "当前拉伸下把整块框架铺满"的缩放倍率（渲染时量好放在 viewRef 里；没量到就退回 1）。
      下界放到 0.2：三根轴都拉长过之后，整根轴要装进画面就是得缩到 1 倍以下（滚轮那条
      .55 的下限只管手动缩放，"适配"要能真的把东西装进来）。 */
  function fitZoom() {
    var v = viewRef.current;
    var k = v && v.zoomFitAll ? v.zoomFitAll : 1;
    return Math.max(0.2, Math.min(24, k));
  }

  /** 回到**整根轴**：松开钉住的那一场 / 点开的考点 / 点中的那道题，视野铺满整根轴。
      角度与三根轴的拉伸都保留（和"适配"一个口径，别动用户自己调过的那些）。 */
  function homeAxis() {
    state.selected = null;
    state.nodeAt = null;
    state.pickedQ = null;
    state.exam = null;
    state.examWin = false;
    /* 先空渲染一帧：旋转焦点跟着"松开之后"重算，zoomFitAll 才是这个状态下的量 */
    render();
    camTo({ center: (RANGE[0] + RANGE[1]) / 2, zoom: fitZoom(), yaw: state.yaw, pitch: state.pitch,
            panX: 0, panY: 0, flat: 1 });
  }

  function fitView() {
    if (state.exam !== null && examById(state.exam)) {
      focusExam(state.exam, true);              /* 保留当前角度（不回默认的 -0.08 / 0.70） */
      return;
    }
    if (state.nodeAt !== null && NODES[state.nodeAt]) {
      var a = Math.max(RANGE[0], state.nodeAt - FIT_HALF);
      var b = Math.min(RANGE[1], state.nodeAt + FIT_HALF);
      var w = (b - a) / N * 100;
      camTo({
        center: (a + b) / 2,
        zoom: Math.max(1, Math.min(6, 100 / Math.max(10, w * 2.2))),
        yaw: state.yaw,
        pitch: state.pitch,
        panX: 0, panY: 0, flat: 0
      });
      return;
    }
    camTo({ center: (RANGE[0] + RANGE[1]) / 2, zoom: fitZoom(), yaw: state.yaw, pitch: state.pitch,
            panX: 0, panY: 0, flat: 1 });
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
    syncMarks();
  }

  /* ---- 时间条上的考试小圆点（用户 2026-10-01）----
     "有考试的地方应该有那个小圆点，在上面，小圆点表示这个地方有考试"＋"我们拖动的时候，
      这个小圆点也会同步生成，类似场景里拖动的时候"＋"这个小按键可以选择"。
     —— 和场景里那批玻璃板**同一把尺子**（只画到"当前那一天"为止，拖时间条就一场一场冒出来），
     位置按"那天在整段时间里的比例"落在滑杆的拇指行程上；点一下 = 选中那一场（`pickExam`）。 */
  var marksRef = { key: '' };

  function syncMarks() {
    var box = el('[data-t3-marks]');
    if (!box) { return; }
    var list = EXAMS.filter(function (e) { return e.day <= state.dayMs; })
      .sort(function (a, b) { return a.day - b.day; });
    var key = list.map(function (e) { return e.id; }).join(',') + '|' + state.exam;
    if (key === marksRef.key) { return; }   /* 没变就别重建（`syncReadout` 调得很勤） */
    marksRef.key = key;
    box.textContent = '';
    /* 挨得太近的两场（还有**同一天两场**的，比如 E8 与 E9）横坐标几乎重合 —— 让它们一上一下岔开，
       不然上面那个把下面那个整个盖住、点不着。
       点平时是**压在滑杆那条线上**的（用户 2026-10-01："点放在数轴上吧"，见 CSS 里 `top: -2px`），
       "岔开"的那个只是往上挪一点点（-10px），还是贴着线那一带，不像原来的两排浮在空中。 */
    var lastPct = -1e9;
    var row = 0;
    list.forEach(function (e) {
      var pct = tOf(e.day) * 100;
      row = (pct - lastPct < 1.4) ? (row ? 0 : 1) : 0;
      lastPct = pct;
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 't3-timebar__mark' + (e.id === state.exam ? ' is-on' : '');
      b.setAttribute('data-t3-mark', e.id);
      b.style.left = 'calc(var(--t3-thumb) / 2 + (100% - var(--t3-thumb)) * ' + (pct / 100).toFixed(4) + ')';
      b.style.top = (row ? -10 : -2) + 'px';
      b.setAttribute('title', cnDate(e.date) + ' · ' + e.name + ' · ' + e.got + ' / ' + e.full + ' 分');
      b.setAttribute('aria-label', cnDate(e.date) + ' · ' + e.name);
      box.appendChild(b);
    });
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
    /* 那五档就五个名字（用户 2026-09-30："它难度层后面这些注释也不需[要]" ——
       原来那行"选择要显示哪几档"撤掉了，弹层越干净越好） */
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

  /* ---- 浮窗拖动（照白板那块面板：抓着标题栏拖、夹在画布内、位置记着）----
     用户 2026-09-30："参考白板的面板样式……可以拖动，它不应该老是在那。"
     写法跟 whiteboard.js 的 panelDrag 一套：pointerdown 记起点 → pointermove 跟手（夹住边界）
     → pointerup 收工；拖动中整条标题栏显示"正抓着"。
     位置只记在**这一次打开里**（模块级对象），不落任何存储 —— 这一页是只读的。 */
  var floatDrag = null;
  var floatAt = {};
  function putFloat(box, x, y) {
    box.style.left = Math.round(x) + 'px';
    box.style.top = Math.round(y) + 'px';
    box.style.right = 'auto';
    box.style.bottom = 'auto';
  }
  function clampFloat(box, x, y) {
    var wrap = box.offsetParent || box.parentNode;
    var w = box.offsetWidth || 300;
    var h = box.offsetHeight || 220;
    var maxX = Math.max(8, (wrap.clientWidth || w) - w - 8);
    var maxY = Math.max(8, (wrap.clientHeight || h) - h - 8);
    return { x: Math.min(Math.max(8, x), maxX), y: Math.min(Math.max(8, y), maxY) };
  }
  function bindFloatDrag(boxSel, headSel, key) {
    var box = el(boxSel);
    var head = el(headSel);
    if (!box || !head || !head.addEventListener) { return; }
    if (floatAt[key]) { putFloat(box, floatAt[key].x, floatAt[key].y); }
    head.addEventListener('pointerdown', function (e) {
      var t = e.target;
      if (t && t.closest && t.closest('button')) { return; }   /* 点子控件（页签 / ✕）不算拖 */
      var wrap = box.offsetParent || box.parentNode;
      var a = box.getBoundingClientRect();
      var b = wrap.getBoundingClientRect();
      floatDrag = {
        box: box, id: e.pointerId, key: key,
        sx: e.clientX, sy: e.clientY,
        x: a.left - b.left, y: a.top - b.top
      };
      putFloat(box, floatDrag.x, floatDrag.y);
      box.classList.add('is-dragging');
      if (typeof head.setPointerCapture === 'function') {
        try { head.setPointerCapture(e.pointerId); } catch (err) { /* 忽略 */ }
      }
    });
    head.addEventListener('pointermove', function (e) {
      if (!floatDrag || floatDrag.box !== box || e.pointerId !== floatDrag.id) { return; }
      var p = clampFloat(box,
        floatDrag.x + (e.clientX - floatDrag.sx),
        floatDrag.y + (e.clientY - floatDrag.sy));
      putFloat(box, p.x, p.y);
    });
    function end(e) {
      if (!floatDrag || floatDrag.box !== box) { return; }
      if (e && e.pointerId !== undefined && e.pointerId !== floatDrag.id) { return; }
      box.classList.remove('is-dragging');
      floatAt[key] = { x: parseFloat(box.style.left) || 0, y: parseFloat(box.style.top) || 0 };
      floatDrag = null;
    }
    head.addEventListener('pointerup', end);
    head.addEventListener('pointercancel', end);
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
      reset.addEventListener('click', function () { resetView(); syncZoomLabel(); render(); });
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
    /* 「适配」：就放在减号 / 加号旁边（用户 2026-10-01："在底部增加一个适配按钮，放在放大缩小的
       减号和加号边上。点击这个按钮，就是把整个时间轴都适配画面。如果点击'当前'或者点击某个考点，
       也就是某一段，也要适配这段"）。 */
    var fitBtn = el('[data-t3-fit]');
    if (fitBtn) {
      fitBtn.addEventListener('click', function () { camStop(); fitView(); });
    }
    /* 底部那一行划过提示：① 光标进到它里面就先别清划过状态（要能点得着）；
       ② 点它 = 打开这个考点的那块面板，并把这一道题一起高亮（用户 2026-10-01："对这个题感兴趣，
       然后点击一下，会出现考点的那个面板里，出现它的考点，然后这个题的具体样子"）。 */
    var hintBox = el('[data-t3-hint]');
    if (hintBox) {
      hintBox.addEventListener('pointerenter', function () {
        if (hoverOffTimer) { window.clearTimeout(hoverOffTimer); hoverOffTimer = 0; }
      });
      hintBox.addEventListener('pointerleave', clearHover);
      hintBox.addEventListener('click', function () {
        var row = state.hoverRow;
        if (row !== null && row !== undefined) {
          state.exam = row.exam;
          state.selected = row.k;
          state.nodeAt = row.k;
          state.pickedQ = row.qi;
          state.examWin = false;
          render();
          syncReadout();
          return;
        }
        if (state.hovered !== null && state.hovered >= 0) {
          state.selected = state.hovered;
          state.nodeAt = state.hovered;
          state.pickedQ = null;
          state.examWin = false;
          render();
          syncReadout();
        }
      });
    }
    /* 三颗数据图层（照参照原型的「学习进度 / 成绩变化 / 投入练习」三个模块） */
    var progressBtn = el('[data-t3-progress]');
    if (progressBtn) {
      progressBtn.addEventListener('click', function () {
        state.layers.progress = !state.layers.progress;
        syncLayerBtn('[data-t3-progress]', state.layers.progress,
                     '学习进度层已开 · 点一下关掉',
                     '学习进度层关着 · 点一下开（时间 × 累计完成的图板）');
        render();
      });
    }
    var scoresBtn = el('[data-t3-scores]');
    if (scoresBtn) {
      scoresBtn.addEventListener('click', function () {
        state.layers.scores = !state.layers.scores;
        syncLayerBtn('[data-t3-scores]', state.layers.scores,
                     '成绩变化层已开 · 点一下关掉',
                     '成绩变化层关着 · 点一下开（时间 × 得分率的图板）');
        render();
      });
    }
    var effortBtn = el('[data-t3-effort]');
    if (effortBtn) {
      effortBtn.addEventListener('click', function () {
        state.layers.effort = !state.layers.effort;
        syncLayerBtn('[data-t3-effort]', state.layers.effort,
                     '投入练习层已开 · 点一下关掉',
                     '投入练习层关着 · 点一下开（每两周的新题 / 复做题量）');
        render();
      });
    }
    /* ---- 时间条上那排考试小圆点：点一下 = 选中那一场（用户 2026-10-01："这个小按键可以选择"）----
       点也是每次重建的（拖时间条会多一场少一场），所以同样绑在容器上。 */
    var marksBox = el('[data-t3-marks]');
    if (marksBox) {
      /* 从点里那个 `<button>` 往上找，认出是哪一场（点每次重建，所以只能委托） */
      var markIdOf = function (t) {
        var node = t;
        while (node && node !== marksBox) {
          if (node.getAttribute && node.getAttribute('data-t3-mark') !== null) {
            return node.getAttribute('data-t3-mark');
          }
          node = node.parentNode;
        }
        return null;
      };
      marksBox.addEventListener('click', function (ev) {
        var id = markIdOf(ev.target);
        if (id) { pickExam(id); }
      });
      /* **划过那个小圆点 → 场景里对应那块考试切片亮起来**（用户 2026-10-01："在全轴显示的状态下，
         鼠标划过下面数轴上的点的时候，考试切片对应的选中状态表示提示"）。
         就是"提示"一下：走 `state.hoverExam` —— 与"在场景里划过那块板"**同一个状态、同一个效果**
         （板面变实一点 + 边框加亮），**不动相机、也不钉住**。移开就把这个提示清掉。 */
      marksBox.addEventListener('pointerover', function (ev) {
        var id = markIdOf(ev.target);
        if (!id || state.hoverExam === id) { return; }
        state.hoverExam = id;
        render();
      });
      marksBox.addEventListener('pointerout', function (ev) {
        if (state.hoverExam === null) { return; }
        var to = ev.relatedTarget;
        /* 从一个点挪到另一个点：`relatedTarget` 还在这一排里 —— 别清，交给下一个 pointerover */
        if (to && marksBox.contains(to)) { return; }
        state.hoverExam = null;
        render();
      });
      /* 兜底：`pointerout` 有时拿不到 `relatedTarget`（比如直接移出窗口），`pointerleave`
         是"离开这一排"最干净的信号 —— 两条都挂，属幂等，重复清一次没关系。 */
      marksBox.addEventListener('pointerleave', function () {
        if (state.hoverExam === null) { return; }
        state.hoverExam = null;
        render();
      });
    }
    var helpBtn = el('[data-t3-help-btn]');
    var helpBox = el('[data-t3-help]');
    if (helpBtn && helpBox) {
      helpBtn.addEventListener('click', function () {
        helpBox.hidden = !helpBox.hidden;
        helpBtn.setAttribute('aria-pressed', helpBox.hidden ? 'false' : 'true');
        var win = el('[data-t3-examwin]');
        if (win && !helpBox.hidden) { state.examWin = false; syncReadout(); }
      });
    }
    /* ---- 浮窗那几颗：两个页签 / ✕ / 两张表里的行 ---- */
    var listEl = el('[data-t3-examwin-list]');
    if (listEl) { listEl.addEventListener('click', onFloatRowClick); }
    var qListEl = el('[data-t3-examwin-qlist]');
    if (qListEl) { qListEl.addEventListener('click', onFloatRowClick); }
    /* 考点浮窗里那几行（这一场考到的 2~3 道题）也点得动 —— 点哪一道，图上就只亮哪一道 */
    var nodeListEl = el('[data-t3-nodewin-list]');
    if (nodeListEl) { nodeListEl.addEventListener('click', onFloatRowClick); }
    var examTabs = document.querySelectorAll('[data-t3-exam-tab]');
    for (var et = 0; et < examTabs.length; et += 1) {
      examTabs[et].addEventListener('click', function (ev) {
        state.examTab = ev.currentTarget.getAttribute('data-t3-exam-tab');
        state.examWin = true;
        syncReadout();
      });
    }
    /* 右侧那一竖排：回到总轴 · 难度层（点开才展开五档）· 考试分析 */
    var railHome = el('[data-t3-rail-home]');
    if (railHome) { railHome.addEventListener('click', homeAxis); }   /* 回到总轴（用户 2026-10-01 加） */
    var railLv = el('[data-t3-rail-levels]');
    if (railLv) {
      railLv.addEventListener('click', function () {
        state.railLevels = !state.railLevels;
        syncRail();
      });
    }
    var railRep = el('[data-t3-rail-report]');
    if (railRep) {
      railRep.addEventListener('click', function () {
        if (!examById(state.exam)) { return; }   /* 还没钉住哪一场：先提示（提示词在 syncRail 里） */
        state.examWin = !state.examWin;          /* 点一下开、再点一下收 */
        syncReadout();
      });
    }
    /* 「清爽模式」（用户 2026-10-01）：一下收起左边的导航与底下的工具条 / 时间条；
       再点一下恢复。**这一竖排自己永远在** —— 它要是也没了，就再也点不回来了。 */
    var railClean = el('[data-t3-rail-clean]');
    if (railClean) {
      railClean.addEventListener('click', function () {
        state.clean = !state.clean;
        syncClean();
        /* 画面宽度变了（左边那条让出来了）→ 重算一次画布尺寸，别让 3D 那层变形 */
        resize();
        render();
        syncZoomLabel();
      });
    }
    var examClose = el('[data-t3-examwin-close]');
    if (examClose) {
      examClose.addEventListener('click', function () {
        /* 收起浮窗 —— 钉子还钉着，板上方那排按钮可以再把它叫回来 */
        state.examWin = false;
        syncReadout();
      });
    }
    var nodeClose = el('[data-t3-nodewin-close]');
    if (nodeClose) {
      nodeClose.addEventListener('click', function () {
        state.nodeAt = null;
        syncReadout();
      });
    }
    /* ---- 右侧「实物卷」：把这一场的两张卷子立到 3D 里去（用户 2026-10-01）---- */
    var railPaper = el('[data-t3-rail-paper]');
    if (railPaper) {
      railPaper.addEventListener('click', function () {
        state.paper3d = !state.paper3d;
        syncRail();
        render();
      });
    }

    /* ---- 原卷那一层（用户 2026-10-01："查看原题 / 查看原卷"＋"默认是认可，除非他自己再叠加一些原因"）---- */
    var scanOpenBtn = el('[data-t3-scan-open]');
    if (scanOpenBtn) {
      scanOpenBtn.addEventListener('click', function () {
        openScan(state.pickedQ === null ? null : state.pickedQ + 1);
      });
    }
    var scanCloseBtn = el('[data-t3-scan-close]');
    if (scanCloseBtn) { scanCloseBtn.addEventListener('click', closeScan); }
    var scanPagesBox = el('[data-t3-scan-pages]');
    if (scanPagesBox) {
      scanPagesBox.addEventListener('click', function (ev) {
        var n = ev.target;
        while (n && n !== scanPagesBox) {
          if (n.getAttribute && n.getAttribute('data-t3-scan-page') !== null) {
            state.scanPage = parseInt(n.getAttribute('data-t3-scan-page'), 10) || 0;
            syncScan();
            return;
          }
          n = n.parentNode;
        }
      });
    }
    var scanOkBtn = el('[data-t3-scan-ok]');
    if (scanOkBtn) {
      scanOkBtn.addEventListener('click', function () {
        if (state.scanQ === null) { return; }
        scanAckSet(state.exam, state.scanQ, { ok: 1 });
        syncScan();
      });
    }
    var scanAddBtn = el('[data-t3-scan-add]');
    if (scanAddBtn) {
      scanAddBtn.addEventListener('click', function () {
        state.scanPick = !state.scanPick;
        syncScan();
      });
    }
    var scanPickBox = el('[data-t3-scan-pick]');
    if (scanPickBox) {
      scanPickBox.addEventListener('click', function (ev) {
        var n = ev.target;
        while (n && n !== scanPickBox) {
          var key = n.getAttribute ? n.getAttribute('data-t3-scan-cause') : null;
          if (key) {
            var cur = (scanAckOf(state.exam, state.scanQ) || {}).extra || [];
            var at = cur.indexOf(key);
            var next = cur.slice();
            if (at >= 0) { next.splice(at, 1); } else { next.push(key); }
            /* 自己叠了原因 = 也算认可（用户："如果学生认可，就让他点一下"） */
            scanAckSet(state.exam, state.scanQ, { ok: 1, extra: next });
            syncScan();
            return;
          }
          n = n.parentNode;
        }
      });
    }
    bindFloatDrag('[data-t3-examwin]', '[data-t3-examwin-head]', 'exam');
    bindFloatDrag('[data-t3-nodewin]', '[data-t3-nodewin-head]', 'node');
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
  /* 「考试切片」那颗的选中态与提示由 syncRail() 管（它在右侧竖排上，不在底部的图层组里） */
  syncLayerBtn('[data-t3-progress]', state.layers.progress, '学习进度层已开 · 点一下关掉', '学习进度层关着 · 点一下开（时间 × 累计完成的图板）');
  syncLayerBtn('[data-t3-scores]', state.layers.scores, '成绩变化层已开 · 点一下关掉', '成绩变化层关着 · 点一下开（时间 × 得分率的图板）');
  syncLayerBtn('[data-t3-effort]', state.layers.effort, '投入练习层已开 · 点一下关掉', '投入练习层关着 · 点一下开（每两周的新题 / 复做题量）');
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
    /* 「投入练习」「学习进度」两层的分桶（排查与体检时直接看它们） */
    effort: function () { return EFFORT; },
    progress: function () { return PROGRESS; },
    zRange: function () { return { t0: T0, t1: T1, today: TODAY }; },
    zOf: zOf,
    /* 三根轴各自的缩放（体检 / 排查"光标压没压到轴上"时直接调它们量） */
    axis: state.axis,
    axisSegs: function () { return axisSegs; },
    axisUnder: function (mx, my) { return axisUnder(mx, my); },
    axisAnchor: function (hitAxis) { return axisAnchor(hitAxis); },
    /* 原卷那一层（体检 / 排查"框压没压准"时直接调它们）——
       `openScan(q)` 开、`closeScan()` 关、`scanBoxes()` 量当前那一页画出来的框。 */
    openScan: openScan,
    closeScan: closeScan,
    /* 实物卷：这一帧那两张卷子投影到屏幕上的四边形（体检 / 排查"点没点中"时直接量），
       以及它开着没有。 */
    paperHit: function () { return state.paperHit; },
    paperOn: function () { return state.paper3d; },
    scanBoxes: function () {
      var out = [];
      var layer = el('[data-t3-scan-boxes]');
      if (!layer) { return out; }
      [].slice.call(layer.children).forEach(function (b) {
        out.push({
          q: parseInt(b.getAttribute('data-t3-scan-box'), 10),
          on: b.className.indexOf('is-on') >= 0,
          left: b.style.left, top: b.style.top, w: b.style.width, h: b.style.height
        });
      });
      return out;
    }
  };
}());
