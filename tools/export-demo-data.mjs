/* ==========================================================================
   一次性导出：把站里的**演示数据**全部落成 JSON，进 seed/
   --------------------------------------------------------------------------
   为什么现在就要导（用户 2026-10-05："一定要保存好现在的演示数据，后面搭后台服务器的时候，
   数据库要搞上现在的演示数据"）：

   这些演示数据现在**长在代码里** —— 结构在 math-tree.js，学习记录/考试在 timeline-data.js，
   题库在 whiteboard-problems.js…… 而接下来要把 reader-live.js / timeline-data.js 改成读接口，
   一改就可能把这些数据改掉或删掉。所以先**冻一份机器可读的快照**出来：
     · 后台建库时按 seed/*.json 灌进去（Task 1.2）
     · 同时也是"一条都不许丢"的**对数基准**（导出前后各数一次，对不上就是丢了）

   为什么是 Node 而不是 Ruby：这些文件是**浏览器 JS**，而且 timeline-data.js 的数据是
   `build()` **算出来的**（确定性种子），没法用静态解析拿到 —— 必须真的把它跑一遍。
   这不是构建链，是一次性导出工具（跑一次，产物进 seed/，之后就不需要它了）。

   用法：node tools/export-demo-data.mjs
   ========================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'seed');
fs.mkdirSync(OUT, { recursive: true });

/* ---- 浏览器环境的最小垫片：只够这几个数据文件跑起来，不碰任何画面 ---- */
/* 一个"假元素"：给 forum.js 那种加载时就想摸 DOM 的文件用 */
function el() {
  const node = {
    style: {}, dataset: {}, classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    setAttribute() {}, getAttribute() { return null; }, removeAttribute() {},
    appendChild() {}, removeChild() {}, insertBefore() {}, addEventListener() {}, removeEventListener() {},
    querySelector() { return null; }, querySelectorAll() { return []; },
    firstChild: null, parentNode: null, innerHTML: '', textContent: '', children: [],
  };
  return node;
}
const mem = {};
const sandbox = {
  console,
  window: {},
  document: {
    addEventListener() {}, removeEventListener() {},
    getElementById() { return null; },
    querySelector() { return null; }, querySelectorAll() { return []; },
    createElement() { return el(); }, createTextNode() { return el(); },
    documentElement: el(), body: el(),
    dispatchEvent() { return true; },
  },
  localStorage: {
    getItem(k) { return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null; },
    setItem(k, v) { mem[k] = String(v); },
    removeItem(k) { delete mem[k]; },
  },
  matchMedia() { return { matches: false, addEventListener() {} }; },
  setTimeout, clearTimeout, setInterval, clearInterval,
  requestAnimationFrame() { return 0; }, cancelAnimationFrame() {},
  CustomEvent: function CustomEvent() {},
  Path2D: function Path2D() {},
};
sandbox.globalThis = sandbox;
sandbox.self = sandbox;
const ctx = vm.createContext(sandbox);

function load(rel) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, rel), 'utf8'), ctx, { filename: rel });
}

const FILES = [
  'assets/js/math-tree.js',
  'assets/js/timeline-axis.js',
  'assets/js/timeline-data.js',
  'assets/js/whiteboard-problems.js',
  'assets/js/exam-scan.js',
  'assets/js/forum-banners.js',
  'assets/js/forum.js',
];
/* forum.js 加载时会自己 init() 去摸 DOM（我们这儿没有画面）—— 但它在摸之前
   就把 window.__FORUM__ 挂好了（第 635 行挂、643 行才 init），所以让它抛，数据照样拿得到。 */
FILES.forEach((rel) => {
  try {
    load(rel);
  } catch (e) {
    console.log(`[warn] ${rel} 加载时抛了（不影响取数据）：${e.message}`);
  }
});

const W = sandbox.window;
const written = [];

function dump(name, value, note) {
  const file = path.join(OUT, name);
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', 'utf8');
  const kb = (fs.statSync(file).size / 1024).toFixed(1);
  written.push({ name, kb: `${kb} KB`, note });
}

/* ---- 1. 知识结构：全站唯一一份（章节 / 图谱 / 时间轴共用） ---- */
dump('math-tree.json', W.MATH_TREE, '知识结构（4 学段 → 册 → 章 → 节 → 知识点）');

/* ---- 2. 摊平后的轴格子：时间轴 2D/3D 的直接输入 ---- */
const axis = W.WK_AXIS.build();
dump('axis-items.json', { total: axis.total, items: axis.items, segs: axis.segs },
  '把结构摊成一根轴的格子序列（时间轴读的就是它）');

/* ---- 3. 学习记录 + 考试：默认那份（设计稿的 43.7% 演示学生） ----
   注意顺序不能颠倒：build() 只给"每格的掌握度/状态"，**轨迹（events）和考试（exams）
   要 buildTimeline() 才会灌进 records**（它顺手改 records，并把 exams 一并返回）。
   只调 build() 就导出 = 拿到一份没有轨迹、没有考试的半成品。 */
const L = W.WK_LEARNING;
const dfltRecords = L.build(axis.items, {});
const dfltTl = L.buildTimeline(axis.items, dfltRecords, {});
dump('learning-default.json', { records: dfltRecords, timeline: dfltTl },
  '默认演示学生：每格掌握度 + 学习轨迹 + 考试（含卷面逐题与错因）');

/* ---- 4. 三个演示学生：登录后按账号推的那份 ---- */
const students = {};
(L.students || []).forEach(function (s) {
  const who = L.forAccount({ name: s.name, grade: s.grade });
  const recs = L.build(axis.items, { seed: who.seed, progress: who.progress });
  const tl = L.buildTimeline(axis.items, recs, { seed: who.seed });
  students[s.name] = { grade: s.grade, seed: who.seed, progress: who.progress, records: recs, timeline: tl };
});
dump('learning-students.json', students, '三个演示学生各自的那份（名字 → 记录 + 轨迹 + 考试）');

/* ---- 5. 词表与常量：错因七种、卡片六类、状态七档 —— 后台要照着建字典表 ---- */
dump('learning-dict.json', {
  status: L.status, factors: L.factors, cardTypes: L.cardTypes,
  causes: L.causes, causeGroups: L.causeGroups, causeBys: L.causeBys,
  marks: L.marks, eventKinds: L.eventKinds, calendar: L.calendar, todayAt: L.todayAt,
}, '掌握度档位 / 五因子 / 卡片六类 / 错因七种 / 标记 / 事件类型 / 日历');

/* ---- 6. 白板题库 ---- */
dump('wb-problems.json', W.WB_PROBLEMS, '白板题库（一键送上白板演算的题）');

/* ---- 7. 原卷扫描件与框（坐标一律百分比，换图 / 压缩都不重算） ---- */
dump('exam-scan.json', W.WK_EXAM_SCAN.scans, '真题原卷：正/反面页 + 每题的红框坐标');

/* ---- 8. 论坛首页轮播 ---- */
dump('forum-banners.json', W.WK_BANNERS, '论坛首页轮播');

/* ---- 9. 论坛演示数据：板 / 帖 / 回复（forum.js 用 localStorage 当库，未登录时灌的是 seed()） ---- */
let forum = null;
try {
  forum = W.__FORUM__ ? W.__FORUM__.load() : null;
} catch (e) {
  forum = null;
}
if (!forum && W.__FORUM__) { forum = W.__FORUM__.seed(); }
dump('forum.json', { me: W.__FORUM__ && W.__FORUM__.ME, boards: W.__FORUM__ && W.__FORUM__.BOARDS, db: forum },
  '论坛：板 / 帖 / 回复（现在存在 localStorage 里，接后台要挪进库）');

/* ---- 对数：导出前先把"有多少条"数清楚，后台灌完要一条不差 ---- */
const countNodes = (n) => 1 + (n.children || []).reduce((a, c) => a + countNodes(c), 0);
/* 注意：scans 是**对象**（按 examId 索引），不是数组 */
const scanIds = Object.keys(W.WK_EXAM_SCAN.scans || {});
const counts = {
  treeNodes: countNodes(W.MATH_TREE),
  treeTopStage: (W.MATH_TREE.children || []).length,
  book: axis.total.book, chapter: axis.total.chapter,
  section: axis.total.section, point: axis.total.point,
  axisItems: axis.items.length,
  axisSegs: axis.segs.length,
  records: dfltRecords.length,
  recordsWithTrajectory: dfltRecords.filter((r) => (r.events || []).length > 0).length,
  exams: (dfltTl.exams || []).length,
  paperQuestions: (dfltTl.exams || []).reduce((a, e) => a + ((e.paper || []).length), 0),
  wbProblems: (W.WB_PROBLEMS || []).length,
  scans: scanIds.length,
  scanBoxes: scanIds.reduce((a, id) => a + ((W.WK_EXAM_SCAN.scans[id].boxes || []).length), 0),
  forumBoards: (W.__FORUM__ && W.__FORUM__.BOARDS || []).length,
  forumPosts: (forum && forum.posts || []).length,
  forumBanners: (W.WK_BANNERS || []).length,
  students: (L.students || []).length,
};
dump('_counts.json', counts, '对数基准：后台灌完必须逐项一致');

console.log('\n导出到 seed/：');
written.forEach((w) => console.log('  ' + w.name.padEnd(26) + w.kb.padStart(10) + '   ' + w.note));
console.log('\n对数基准 _counts.json：');
Object.entries(counts).forEach(([k, v]) => console.log('  ' + k.padEnd(18) + v));
