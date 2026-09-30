/* ==========================================================================
   时间轴 · 学习记录（演示数据） (timeline-data.js)
   --------------------------------------------------------------------------
   项目还没有后端，所以"掌握度"与"每个知识点几月几号学的"这两份数据由这里生成：
   按图谱的顺序**确定性**铺一份学习记录 —— 种子写死，同一个知识点每次进页面
   拿到的都是同一份，不会一刷新就换一张脸（与白板 58 道题、论坛 6 帖同一套路）。

   演示的学生学到哪儿了：**前 43.7% 已学**（设计稿上写的就是"总进度 43.7%"）。
   已学的那一段里，越早学的越熟，中间故意留了起伏（有的忘了、有的还在学）——
   全是绿色的话，"待复习 / 薄弱" 那几档就没有意义了。

   为什么单独一个文件：
     · 它是**唯一需要换掉**的东西。接后端时只替换 build()，视图层一个字不用动；
     · 以后粒度要细到"知识点内部的部分"（例：绝对值再分定义 / 理解 / 应用七八块）时，
       在这里给每条记录加一个 parts 数组就行 —— 轴上的小刻度与卡片都按这个留了位置。

   状态 → 颜色令牌的对应照设计稿的图例：已掌握绿 / 精通金 / 初步掌握深金 /
   学习中蓝 / 待复习紫 / 薄弱红 / 未开始灰（令牌在 tokens.css 的 --math-bar-*）。
   ========================================================================== */

(function () {
  'use strict';

  /* 状态分档：从高到低，mastery 落进哪一档就是哪个状态 */
  var STATUS = [
    { name: '精通',     min: 90, token: '--math-bar-gold' },
    { name: '已掌握',   min: 80, token: '--math-bar-ok' },
    { name: '初步掌握', min: 65, token: '--math-bar-first' },
    { name: '学习中',   min: 45, token: '--math-bar-learn' },
    { name: '待复习',   min: 30, token: '--math-bar-review' },
    { name: '薄弱',     min: 1,  token: '--math-bar-weak' },
    { name: '未开始',   min: 0,  token: '--math-bar-idle' }
  ];

  /* 那四类**特殊标记**（用户 2026-09-29 补的口径 + 参考图里那一栏）
     —— 与"掌握度"是两回事：掌握度是系统判定的学习成果，标记是贴在知识点上的标签。
     `icon` 直接写 lucide 的名字：图例条与筛选用 `data-lucide`，画布从同一个 lucide 里
     取路径（`Path2D`），所以两处的图标是同一份，不会一个圆一个尖。
     `token` 指 tokens.css 里的颜色（亮 / 中 / 暗三包齐全）。
     `own` 说的是**这颗标记归谁定**（用户 2026-09-30 定的口径）：
       · `own: true`（重点 / 难点 / 待复习）—— 学员自己的判断，卡片里点一下就改；
       · `own: false`（前置未满足）—— **系统算出来的**，学员改不了。
         它是"前置知识还没掌握，所以这一格现在别碰"的提示，不是自评。
         混在一起让学员能删，就会出现"把最该提醒他的那一条关掉了"。 */
  var MARKS = [
    { key: 'key',    name: '重点',       icon: 'star',       token: '--math-mark-key',    own: true },
    { key: 'hard',   name: '难点',       icon: 'flame',      token: '--math-mark-hard',   own: true },
    { key: 'review', name: '待复习',     icon: 'rotate-ccw', token: '--math-mark-review', own: true },
    { key: 'block',  name: '前置未满足', icon: 'lock',       token: '--math-mark-block',  own: false }
  ];

  /** 学员自己可改的那几类（卡片里的开关就按这一份排）。 */
  function ownMarks() {
    var out = [];
    for (var i = 0; i < MARKS.length; i += 1) { if (MARKS[i].own) { out.push(MARKS[i]); } }
    return out;
  }

  var DAY = 86400000;
  var PROGRESS = 0.437;          /* 演示学生学到哪（43.7%），设计稿的原话 */
  /* 演示学生的**真实学时**：小学一年级上（2020-09）一直学到七年级下期末（2026-06）——
     拉成 K12 的真实跨度（用户 2026-09-30 定的口径）。原来挤在 9 个月里，
     跟"课程计划日"差了五六年，3D 的 Z 轴把两条线摆在一起就是一团不对的东西。 */
  var START_AT = '2020-09-01';   /* 第一个知识点是这天学的（小学一年级开学） */
  var END_AT   = '2026-06-30';   /* 最后一个已学的知识点是这天（七年级下期末） */
  var DEFAULT_SEED = 20260929;   /* 演示那一份写死的种子：同一个学生每次进页面拿到的都一样 */

  /* ==================================================================== *
   * 3D 轴的数据地基（用户 2026-09-30 定的口径：X = 知识结构、Z = 日历时间）
   * --------------------------------------------------------------------
   * 这一层**完全不动上面那份记录**（mastery / learnedAt / term / marks 一个都不碰），
   * 只在它上面挂两样新东西、外加一组考试：
   *   · rec.plannedAt —— 这个知识点**按课程计划**该在哪天学（K12 的真实学年）
   *   · rec.events    —— 学习轨迹：首学 → 复习若干次 → 纠错 / 考试
   *   · exams         —— 考试实体：一册考一次，每道题有得分，错题一眼看得出
   *
   * 为什么"不动旧字段"是硬要求：2D 那条链路（`build()`）与 1396 条自检都压在上面，
   * 新加的东西一旦混进**主随机流**，掌握度 / 学习日 / 卡片整份都会跟着挪位。
   * 所以这里的每一个随机数都走 `markRoll`（按知识点编号散列的**独立**流），
   * 跟标记那四类共用同一套办法 —— 这正是当初给标记分流时记下的坑。
   * ==================================================================== */

  /** 演示数据里的"今天"：跟着学时窗口走 —— 七年级下期末刚考完。 */
  var TODAY_AT = '2026-06-30';

  /* K12 的真实日历：小学一年级（上）2020 年 9 月开学，一学年两学期。
     轴上的"年级"是按**教材顺序**排的，跟日历不是一回事 —— 接上日历之后，
     "按部就班学"会落在一条斜线上，而复习 / 考试 / 跳学才是偏离它的那部分。 */
  var K12 = {
    startYear: 2020,
    term: { upper: '09-01', lower: '02-20' },
    grades: { '一年级': 1, '二年级': 2, '三年级': 3, '四年级': 4, '五年级': 5, '六年级': 6,
              '七年级': 7, '八年级': 8, '九年级': 9, '高一': 10, '高二': 11 }
  };

  /** 这个知识点按课程计划该在哪天学。竞赛那几支没有年级 → 给空串（3D 里跳过它）。 */
  function plannedAtOf(item) {
    var chain = item && item.chain;
    if (!chain) { return ''; }
    var grade = '';
    var book = '';
    for (var k = 0; k < chain.length; k += 1) {
      if (chain[k].depth === 1) { grade = chain[k].name; }
      if (chain[k].depth === 2) { book = chain[k].name; }
    }
    var n = K12.grades[grade];
    if (!n) { return ''; }
    var year = K12.startYear + (n - 1);
    return (/下/.test(book) ? (year + 1) : year) + '-' +
           (/下/.test(book) ? K12.term.lower : K12.term.upper);
  }

  /* 轨迹上的四类事件（3D 的 Z 轴要看的就是它们） */
  var EVENT_KINDS = [
    { key: 'first',  name: '首学' },
    { key: 'review', name: '复习' },
    { key: 'fix',    name: '纠错' },
    { key: 'exam',   name: '考试' }
  ];

  /* 一册一考时那三档范围（`take` = 这一册里考多少）；另外每学年还会有一场跨册的
     "学年考"（scope: 'year'），那是最长的一种 —— 3D 的板宽就是照这些范围来的 */
  var EXAM_SCOPES = [
    { key: 'unit',  name: '单元测', take: 0.34 },
    { key: 'mid',   name: '期中',   take: 0.6 },
    { key: 'final', name: '期末',   take: 1 }
  ];

  /* 新字段专用的一批散列盐（避开标记那四类用的 0–3） */
  var TL_SALT = { first: 11, peak: 12, review: 13, examDate: 14, examScore: 15, fix: 16, scope: 17 };
  var REVIEW_GAP = [7, 21, 45];      /* 第 1 / 2 / 3 次复习各隔多少天 */

  /** 一个知识点的学习轨迹。
   *  **最后一条的掌握度一定等于 `rec.mastery`** —— 2D 的彩条显示的就是那个数，
   *  两条线必须是同一条，否则 3D 的曲线跟 2D 的柱子会互相打脸。
   *  状态是"待复习 / 薄弱"的那些，中间会先冲到峰值再落下来（学完时不错、后来忘了）。 */
  function trajectoryOf(rec, i, seed0, today) {
    var m = rec.mastery;
    var t0 = parseDay(rec.learnedAt);
    var cnt = m >= 80 ? 3 : (m >= 65 ? 2 : (m >= 45 ? 1 : 0));
    if (!cnt) { return [{ at: t0, kind: 'first', mastery: m }]; }
    var dip = rec.status === '待复习' || rec.status === '薄弱';
    var peak = dip ? Math.min(100, m + 10 + Math.round(markRoll(seed0, i, TL_SALT.peak) * 10)) : m;
    var first = Math.max(4, Math.round(m * (0.45 + 0.2 * markRoll(seed0, i, TL_SALT.first))));
    var out = [{ at: t0, kind: 'first', mastery: first }];
    var prev = t0;
    for (var k = 1; k <= cnt; k += 1) {
      var jitter = Math.round((markRoll(seed0, i, TL_SALT.review + k) * 6 - 3) * DAY);
      var at = t0 + REVIEW_GAP[k - 1] * DAY + jitter;
      if (at > today) { break; }                     /* 还没到的复习不排 */
      if (at <= prev) { at = prev + DAY; }
      if (at > today) { break; }
      prev = at;
      out.push({ at: at, kind: 'review', mastery: Math.round(first + (peak - first) * (k / cnt)) });
    }
    out[out.length - 1].mastery = m;                 /* 钉成 2D 那个数 */
    return out;
  }

  /** 某个时刻的掌握度：在轨迹上按时间取（考试那天的水平就是这么算的）。 */
  function masteryAt(events, atMs) {
    if (!events || !events.length) { return 0; }
    var v = events[0].mastery;
    for (var k = 0; k < events.length; k += 1) {
      if (events[k].at <= atMs) { v = events[k].mastery; } else { break; }
    }
    return v;
  }

  /** 一册的名字（当考试的卷名用）：链上 depth 2 那一级。 */
  function bookOf(item) {
    var chain = item && item.chain;
    if (!chain) { return ''; }
    for (var k = 0; k < chain.length; k += 1) {
      if (chain[k].depth === 2) { return chain[k].name; }
    }
    return '';
  }

  /**
   * 考试：**一册考一场**，只考"已经整册学完"的（学着的那册不考）。
   * 范围轮着来（用户 2026-09-30："他每次考试，他考的范围不一样……考的难度也不一样"）：
   *   单元测 = 这一册里的一段 · 期中 = 前半册 · 期末 = 整册 —— 三场轮着来。
   * 另外**上下两册都学完就来一场跨册的"学年考"** —— 范围最长的那种
   * （用户 2026-09-30："这个长的考试，就涵盖范围长的考试，这样我就可以看到长的是什么样子"）。
   * 3D 那块玻璃板的宽度按**这场实际考到的考点跨度**画，所以范围不同、宽度才不一样。
   * 每道题的得分由"考试那天这个知识点的掌握度"推出来（± 一点起伏），
   * 所以这张卷子是可以对着事件流复算的 —— 3D 的考试切片要的就是这个。
   * `paper` 里每项：{ index, full, score }，错题（不到 60%）一眼看得出来。
   */
  function makeExams(items, records, seed0, today) {
    var groups = [];
    var cur = null;
    for (var i = 0; i < records.length; i += 1) {
      var key = bookOf(items[i]);
      if (!key) { continue; }
      if (!cur || cur.key !== key) {
        cur = { key: key, name: key, from: i, to: i + 1 };
        groups.push(cur);
      } else {
        cur.to = i + 1;
      }
    }
    /** 这一册整册学完了吗 */
    function done(grp) {
      for (var j = grp.from; j < grp.to; j += 1) { if (!records[j].learnedAt) { return false; } }
      return true;
    }
    /** 一场卷子：把 [from, to) 这几格按"考试那天的掌握度"打上分 */
    function paperOver(from, to, at) {
      var paper = [];
      for (var q = from; q < to; q += 1) {
        var mAt = masteryAt(records[q].events, at);
        var noise = (markRoll(seed0, q, TL_SALT.examScore) * 2 - 1) * 12;
        var p = Math.max(0, Math.min(1, (mAt + noise) / 100));
        paper.push({ index: q, full: 10, score: Math.round(p * 10) });
      }
      return paper;
    }
    var out = [];
    for (var g = 0; g < groups.length; g += 1) {
      var grp = groups[g];
      if (!done(grp)) { continue; }                   /* 没学完的册不考 */
      var scope = EXAM_SCOPES[g % EXAM_SCOPES.length];
      var span = grp.to - grp.from;
      var take = span >= 3 ? Math.max(2, Math.round(span * scope.take)) : span;
      var from = grp.from;
      if (take < span) {
        from = grp.from + Math.min(span - take, Math.round(markRoll(seed0, g, TL_SALT.scope) * (span - take)));
      }
      var to = from + take;
      var gap = (6 + Math.round(markRoll(seed0, g, TL_SALT.examDate) * 8)) * DAY;
      var at = Math.min(parseDay(records[to - 1].learnedAt) + gap, today);
      out.push({
        id: '', name: grp.name + ' · ' + scope.name, at: at, date: dayText(at),
        from: from, to: to, scope: scope.key, paper: paperOver(from, to, at)
      });
    }
    /* 学年考：轴上是**连续的上下两册**（一年级上册 → 一年级下册）才算一个学年。
       高中那几册没有"上/下"（必修第一册…），推不出学年就跳过 —— 不硬编一个。 */
    for (var y = 0; y + 1 < groups.length; y += 2) {
      var g1 = groups[y];
      var g2 = groups[y + 1];
      var m1 = /^(.+?)[上下]册$/.exec(g1.name);
      var m2 = /^(.+?)[上下]册$/.exec(g2.name);
      if (!m1 || !m2 || m1[1] !== m2[1]) { continue; }
      if (!done(g1) || !done(g2)) { continue; }
      var yFrom = g1.from;
      var yTo = g2.to;
      var yGap = (6 + Math.round(markRoll(seed0, y, TL_SALT.examDate) * 8)) * DAY;
      var yAt = Math.min(parseDay(records[yTo - 1].learnedAt) + yGap, today);
      out.push({
        id: '', name: m1[1] + ' · 学年考', at: yAt, date: dayText(yAt),
        from: yFrom, to: yTo, scope: 'year', paper: paperOver(yFrom, yTo, yAt)
      });
    }
    /* 编号按**时间**排（E1 就是最早那一场），面板列表读起来才顺 */
    out.sort(function (a, b) { return a.at - b.at; });
    out.forEach(function (e, k) { e.id = 'E' + (k + 1); });
    return out;
  }

  /** 把考试与纠错接回每个知识点的轨迹，按时间排好，最后钉成 rec.mastery。 */
  function attachExams(records, exams, seed0, today) {
    var i, k, q;
    for (k = 0; k < exams.length; k += 1) {
      var ex = exams[k];
      for (q = 0; q < ex.paper.length; q += 1) {
        var item = ex.paper[q];
        var rec = records[item.index];
        if (!rec) { continue; }
        var mAt = masteryAt(rec.events, ex.at);
        rec.events.push({ at: ex.at, kind: 'exam', mastery: mAt, exam: ex.id, score: item.score, full: item.full });
        if (item.score * 5 < item.full * 3) {        /* 不到 60% = 错题 → 之后纠错一笔 */
          var fixAt = Math.min(ex.at + (5 + Math.round(markRoll(seed0, item.index, TL_SALT.fix) * 8)) * DAY, today);
          rec.events.push({
            at: fixAt, kind: 'fix', mastery: Math.min(100, mAt + 12),
            exam: ex.id, from: item.score, to: item.full
          });
        }
      }
    }
    for (i = 0; i < records.length; i += 1) {
      var r = records[i];
      if (!r.events || !r.events.length) { continue; }
      r.events.sort(function (a, b) { return a.at - b.at; });
      r.events[r.events.length - 1].mastery = r.mastery;
    }
  }

  /**
   * 3D 那边要的全部数据。**调用前先 `build(items, opts)`** ——
   * 它会就地给每条记录挂上 plannedAt / events，并返回考试与日历。
   * 2D 那条链路一个字都不碰：`build()` 自己既不加 events、也不读 plannedAt。
   */
  function buildTimeline(items, records, opts) {
    var opt = opts || {};
    var seed0 = typeof opt.seed === 'number' ? opt.seed : DEFAULT_SEED;
    var today = parseDay(opt.todayAt || TODAY_AT);
    var i;
    for (i = 0; i < records.length; i += 1) {
      var rec = records[i];
      rec.plannedAt = plannedAtOf(items[i]);
      if (!rec.learnedAt) {                       /* 没学过的格子：没有轨迹 */
        rec.events = [];
        continue;
      }
      rec.events = trajectoryOf(rec, i, seed0, today);
    }
    var exams = makeExams(items, records, seed0, today);
    attachExams(records, exams, seed0, today);
    return { calendar: K12, kinds: EVENT_KINDS, exams: exams, today: dayText(today) };
  }

  /* ------------------------------------------------------------------ *
   * 看谁的学习记录（用户第 11 条：未登录看演示学生，登录了看自己的）
   *   未登录：看下面这几个**演示学生**，默认第一个 —— 就是设计稿上那位（43.7%）。
   *   已登录：看**自己**的。项目还没有后端，所以按账号（姓名 + 年级）在本机推一份：
   *   不同账号拿到的进度与颜色分布不同，同一个账号每次进来一样。
   *   接后端时替掉这一层就行，视图层一个字不用动。
   * ------------------------------------------------------------------ */

  var DEMO_STUDENTS = [
    { name: '林一鸣', grade: '七年级（下）',   short: '林', progress: PROGRESS, seed: DEFAULT_SEED },
    { name: '周雨桐', grade: '五年级（上）',   short: '周', progress: 0.71,     seed: 20260930 },
    { name: '陈子航', grade: '高一 · 必修一', short: '陈', progress: 0.22,     seed: 20261001 }
  ];

  /* 字符串 → 32 位无符号数（FNV-1a）。只是为了"同一个账号每次都一样"，不求密码学。 */
  function hashText(text) {
    var h = 2166136261;
    for (var i = 0; i < text.length; i += 1) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  }

  /* 账号 → 生成参数。进度落在 22%–78%：太低整条轴几乎都是灰的、看不出东西；
     太高又几乎全是绿的，"待复习 / 薄弱" 那几档就没意义了（与演示那一份同样的考虑）。 */
  function forAccount(user) {
    var h = hashText(String((user && user.name) || '') + '|' + String((user && user.grade) || ''));
    return {
      seed: 100000 + (h % 900000),
      progress: 0.22 + ((h >>> 7) % 1000) / 1000 * 0.56
    };
  }

  /* 掌握度的**五因子**（权重照参考图画）：掌握度不是拍出来的一个数，
     是这五项加权算出来的 —— 所以卡片面板里那五个数加起来必须对得上总分。 */
  var FACTORS = [
    { key: 'acc',   name: '正确率',   weight: 0.40 },
    { key: 'solo',  name: '独立完成', weight: 0.20 },
    { key: 'gap',   name: '复习间隔', weight: 0.20 },
    { key: 'speed', name: '速度',     weight: 0.10 },
    { key: 'err',   name: '错题消除', weight: 0.10 }
  ];

  /* 一个知识点内部再细分就是它的**卡片**（参考图里 MATH-KP-0234 名下 12 张卡片：
     概念 / 公式 / 例题 / 变式 / 错题 / 复习），每张卡有自己的类型、难度、正确率、
     状态与日期。轴上放到最细的那一档，画的就是这些卡片（宽 = 卡片权重）。 */
  var CARD_TYPES = [
    { name: '概念', weight: 1.35 },
    { name: '公式', weight: 1.15 },
    { name: '例题', weight: 1.00 },
    { name: '变式', weight: 0.92 },
    { name: '错题', weight: 1.20 },
    { name: '复习', weight: 0.78 }
  ];
  /* 一张知识点的卡片大致按这个次序排：先概念公式，再例题变式，最后错题复习 */
  var CARD_FLOW = ['概念', '概念', '公式', '例题', '公式', '例题', '例题', '变式', '变式', '错题', '复习'];

  function stateOf(mastery) {
    for (var i = 0; i < STATUS.length; i += 1) {
      if (mastery >= STATUS[i].min) { return STATUS[i].name; }
    }
    return '未开始';
  }

  function tokenOf(name) {
    for (var i = 0; i < STATUS.length; i += 1) {
      if (STATUS[i].name === name) { return STATUS[i].token; }
    }
    return '--math-bar-idle';
  }

  function parseDay(text) {
    var p = String(text).split('-');
    return Date.UTC(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  }

  function dayText(ms) {
    var d = new Date(ms);
    var m = String(d.getUTCMonth() + 1);
    var day = String(d.getUTCDate());
    return d.getUTCFullYear() + '-' + (m.length < 2 ? '0' + m : m) + '-' + (day.length < 2 ? '0' + day : day);
  }

  /* 时间段的**粒度是学期**（用户 2026-09-30 定的），不是月：
     12 年的学时按月切是 69 个格子（对比卡列 69 行、筛选摆 69 个胶囊，没法用），
     按学期切是 12 个 —— 也正好对上"一学期一次期中 / 期末"的真实节奏。
     学年以 9 月为界：9–12 月与次年 1 月算**上学期**，2–8 月（含暑假）算**下学期**。 */
  function termOf(ms) {
    var d = new Date(ms);
    var y = d.getUTCFullYear();
    var m = d.getUTCMonth() + 1;
    if (m >= 9) { return y + '-上'; }
    if (m === 1) { return (y - 1) + '-上'; }
    return (y - 1) + '-下';
  }

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

  /* 各类标记的"命中比例"（演示用）：该复习的与硬骨头多标一些，"重点"本来就少 */
  var MARK_RATE = { review: 0.45, hard: 0.4, key: 0.12, block: 0.12 };

  /* "这一格带不带标记"用**另一个不占主随机流**的散列来定：
     主随机流一挪，整份演示数据（掌握度、学习日、卡片）就全跟着变，
     已经对过账的数字（43.7% / 平均掌握 67%）就白对了。
     `salt` 是**第几条流**（用户 2026-09-30 允许一颗知识点同时挂几个标记之后加的）：
     四类标记共用一条骰子的话，"既待复习又难点"永远不会同时出现 —— 每一类得有自己的骰子。
     `salt` 缺省 = 0，而 `imul(0, x) = 0`，所以老的那条流一个数都没动。 */
  function markRoll(seed0, i, salt) {
    var h = (seed0 + Math.imul(i + 1, 2654435761) + Math.imul(salt || 0, 974634319)) >>> 0;
    h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0;
    h = (h ^ (h >>> 13)) >>> 0;
    return (h % 1000) / 1000;
  }
  var MARK_SALT = { block: 0, review: 1, hard: 2, key: 3 };

  /**
   * 按图谱摊平出来的 items 顺序铺一份学习记录。
   * 一条记录：
   *   mastery  0–100 掌握度（0 = 没学过）
   *   status   状态名（七档之一）
   *   learnedAt / reviewAt  学习日 / 下次复习日（未学是空串）
   *   cards    这个知识点名下的卡片数（未学为 0）
   *   diff     难度 1.0–5.0（**综合判定**：这个点有多硬）—— 轴上条子的高矮就是它
   *   term     'YYYY-上' / 'YYYY-下'（**学期**，按时间段对比与筛选要用）
   *   marks    **学员自己贴的标记**（`'key' / 'hard' / 'review'` 的任意组合，可以几个同时挂）
   *   blocked  **系统算的**"前置未满足"（布尔）—— 学员改不了，见 MARKS 上的 `own`
   */
  function build(items, opts) {
    /* opts 可以覆盖"学到哪儿 / 种子 / 起止日" —— 未登录时用默认那一份（设计稿的 43.7%），
       登录后按账号推（见 forAccount）。三个参数都不给时，与第一版**一字不差**。 */
    var opt = opts || {};
    var total = items.length;
    var learned = Math.round(total * clamp(typeof opt.progress === 'number' ? opt.progress : PROGRESS, 0.01, 1));
    var t0 = parseDay(opt.startAt || START_AT);
    var t1 = parseDay(opt.endAt || END_AT);
    var seed = typeof opt.seed === 'number' ? opt.seed : DEFAULT_SEED;
    var seed0 = seed;
    function rnd() {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    }
    function round1(v) { return Math.round(v * 10) / 10; }
    function factor(center, wobble) {
      return Math.round(clamp(center + (rnd() * 2 - 1) * wobble, 3, 100));
    }
    var out = [];
    var prev = t0;
    for (var i = 0; i < total; i += 1) {
      var it = items[i];

      /* 难度：**综合判定**出来的一个数（1.0–5.0，一位小数），与"学没学"无关 ——
         轴上那根条子的高矮就是它，所以每个知识点都得有：没学过的点也有它有多硬。
         演示数据里这么拼：底子 + 一点起伏；"知识点"这一级（节底下细分出来的那种）
         通常比整节更专、更难，所以给它抬一档。接后端时这里换成真实的综合难度即可。 */
      var diffBase = 1.6 + 2.6 * rnd();
      if (it.kind === 'point') { diffBase += 0.5; }
      var diff = round1(clamp(diffBase, 1, 5));

      if (i >= learned) {
        out.push({
          mastery: 0, status: '未开始', learnedAt: '', reviewAt: '',
          diff: diff, term: '', cards: [], factors: null,
          /* 还没学的格子带不出自评标记，只可能被系统标"前置未满足"（就是这一档的意思） */
          marks: [],
          blocked: markRoll(seed0, i, MARK_SALT.block) < MARK_RATE.block
        });
        continue;
      }
      /* 学的顺序就是轴上的顺序：越靠后的学得越晚 —— 时间轴与知识轴是同一条 */
      var t = i / Math.max(1, learned - 1);
      var at = t0 + (t1 - t0) * t + (rnd() * 2 - 1) * 2.2 * DAY;
      if (at < prev) { at = prev; }
      prev = at;

      /* 五因子 + 掌握度。**一条章里就该有绿有红** —— 起伏给得足一点
         （±15 上下的抖动 + 三成多的"退步"），否则一整段会是同一种颜色。 */
      var base = 90 - 30 * t;
      var dip = rnd() < 0.36 ? -(8 + rnd() * 16) : 0;
      var factors = {
        acc:   factor(base + 4 + dip, 15),
        solo:  factor(base - 2 + dip, 17),
        gap:   factor(base - 8 + dip, 21),
        speed: factor(base - 10 + dip, 23),
        err:   factor(base - 6 + dip, 19)
      };
      var sum = 0;
      for (var f = 0; f < FACTORS.length; f += 1) { sum += factors[FACTORS[f].key] * FACTORS[f].weight; }
      var mastery = Math.round(clamp(sum, 4, 100));   /* 不低于 4：学过就是学过 */
      var status = stateOf(mastery);

      /* 下次复习：越不熟越早复习 */
      var gap = status === '精通' || status === '已掌握' ? 30
              : status === '初步掌握' ? 14
              : status === '学习中' ? 7 : 3;
      var reviewAt = dayText(at + gap * DAY);

      /* 卡片：这个知识点内部再细分就是这些卡。正确率围着这个知识点的"正确率因子"起伏，
         状态由正确率分档 —— 所以卡片一群看过去，跟知识点自己的颜色是对得上的。 */
      var cardCount = 3 + Math.round(rnd() * 4);
      var cards = [];
      for (var c = 0; c < cardCount; c += 1) {
        var typeName = CARD_FLOW[c % CARD_FLOW.length];
        var tpl = CARD_TYPES[0];
        for (var q = 0; q < CARD_TYPES.length; q += 1) {
          if (CARD_TYPES[q].name === typeName) { tpl = CARD_TYPES[q]; }
        }
        var acc = Math.round(clamp(factors.acc + (rnd() * 2 - 1) * 22, 12, 100));
        cards.push({
          no: c + 1,
          type: typeName,
          diff: round1(clamp(2 + rnd() * 3.2, 1, 5)),
          acc: acc,
          status: stateOf(acc),
          weight: round1(tpl.weight * (0.85 + rnd() * 0.3)),
          at: dayText(at + (c + 1) * 3 * DAY)
        });
      }

      /* 学员自己贴的标记（**演示规则**，接后端时换成真实的自评）：
         标记的类型跟着这一格的状态走，别掷骰子随便撒 —— 这样图例与筛选点出来的
         东西是说得通的：待复习 / 薄弱 → 待复习；硬骨头（难度 ≥ 4）→ 难点；
         其余被挑中的 → 重点（重点本来就是主观的："这一课我觉得要紧"）。
         三档给不同的比例：该复习的与硬骨头本来就该多标一些，
         "重点"是学员自己划的，本来就少。
         **可以叠**（用户 2026-09-30 定的"多选"口径）：一条 45% 的"待复习"同时又是
         4.2 的硬骨头、还被学员自己划了重点，三个标一起挂着才是真实的用法 ——
         所以每类各掷各的骰子（见 markRoll 的 salt）。 */
      var marks = [];
      if ((status === '待复习' || status === '薄弱') &&
          markRoll(seed0, i, MARK_SALT.review) < MARK_RATE.review) {
        marks.push('review');
      }
      if (diff >= 4 && markRoll(seed0, i, MARK_SALT.hard) < MARK_RATE.hard) {
        marks.push('hard');
      }
      if (markRoll(seed0, i, MARK_SALT.key) < MARK_RATE.key) {
        marks.push('key');
      }

      out.push({
        mastery: mastery, status: status,
        learnedAt: dayText(at), reviewAt: reviewAt,
        factors: factors, cards: cards, diff: diff, term: termOf(at),
        marks: marks, blocked: false
      });
    }
    return out;
  }

  /** 一段的汇总：掌握率、状态、已学数、卡片数、最近学习日。 */
  function rollup(records, from, to) {
    var n = Math.max(0, to - from);
    var sum = 0;
    var learned = 0;
    var cards = 0;
    var last = '';
    var counts = {};
    for (var i = from; i < to && i < records.length; i += 1) {
      var r = records[i];
      sum += r.mastery;
      if (r.status !== '未开始') {
        learned += 1;
        if (r.learnedAt > last) { last = r.learnedAt; }
      }
      cards += (r.cards && r.cards.length) || 0;
      counts[r.status] = (counts[r.status] || 0) + 1;
    }
    var avg = n ? Math.round(sum / n) : 0;
    return {
      count: n,
      learned: learned,
      cards: cards,
      avg: avg,
      rate: avg + '%',
      last: last,
      status: learned ? stateOf(avg) : '未开始',
      counts: counts
    };
  }

  /** 按"学的那一个**学期**"汇总（用户第 13 条的时间段对比用它）：
   *  每个学期学了多少格、平均掌握多少、多少张卡片。按学期升序返回。
   *  没学过的格子没有日期，不参与 —— 所以每个学期的"已学"就是那段时间真实学掉的量。
   *  接后端时这里换成服务端按学期聚合的报表即可。 */
  function terms(records) {
    var map = {};
    var order = [];
    for (var i = 0; i < records.length; i += 1) {
      var r = records[i];
      if (!r.term) { continue; }
      if (!map[r.term]) {
        map[r.term] = { term: r.term, learned: 0, sum: 0, cards: 0 };
        order.push(r.term);
      }
      var m = map[r.term];
      m.learned += 1;
      m.sum += r.mastery;
      m.cards += (r.cards && r.cards.length) || 0;
    }
    order.sort();
    return order.map(function (k) {
      var m = map[k];
      return {
        term: k,
        learned: m.learned,
        avg: m.learned ? Math.round(m.sum / m.learned) : 0,
        cards: m.cards
      };
    });
  }

  /** 整体进度：已学格子数 / 总格子数；掌握率分两份 ——
   *  整条轴的平均（含没学的 0 分）与"只算已学部分"的平均。
   *  读数上用的是后者：把没学的算进去，一个人明明学得不错也会显示成 29%，
   *  那个数看着像"学得很差"，其实是"还没学到"—— 两件事得分开说。 */
  function summary(records) {
    var learned = 0;
    var sum = 0;
    var sumLearned = 0;
    for (var i = 0; i < records.length; i += 1) {
      var r = records[i];
      sum += r.mastery;
      if (r.status !== '未开始') {
        learned += 1;
        sumLearned += r.mastery;
      }
    }
    return {
      total: records.length,
      learned: learned,
      progress: records.length ? Math.round(learned / records.length * 1000) / 10 : 0,
      avg: records.length ? Math.round(sum / records.length) : 0,
      avgLearned: learned ? Math.round(sumLearned / learned) : 0
    };
  }

  window.WK_LEARNING = {
    status: STATUS,
    factors: FACTORS,
    cardTypes: CARD_TYPES,
    marks: MARKS,
    ownMarks: ownMarks,
    students: DEMO_STUDENTS,
    forAccount: forAccount,
    stateOf: stateOf,
    tokenOf: tokenOf,
    build: build,
    rollup: rollup,
    terms: terms,
    summary: summary,
    /* ---- 3D 那一层（用户 2026-09-30）：现有 2D 一个字段都不用它 ---- */
    buildTimeline: buildTimeline,
    plannedAtOf: plannedAtOf,
    eventKinds: EVENT_KINDS,
    calendar: K12,
    todayAt: TODAY_AT
  };
}());
