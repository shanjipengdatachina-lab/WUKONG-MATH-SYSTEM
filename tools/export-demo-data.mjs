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

/* --------------------------------------------------------------------------
   冻结"现在"，让导出**可复现**。
   论坛的演示数据是按"距现在多久"造的（帖子/回复的 `at` = Date.now() - 偏移），
   不冻的话每次导出那些时间戳都会往前漂 —— seed/ 就不成其为快照了：
   git 每次都会显示 forum.json 被改，"只增不改"这条纪律也就没法执行。
   实测：不冻时两次导出相差 191 秒，正好是两次跑之间隔的时间。
   -------------------------------------------------------------------------- */
const FROZEN_NOW = Date.parse('2026-10-05T12:00:00+08:00');
class FrozenDate extends Date {
  constructor(...args) {
    if (args.length === 0) super(FROZEN_NOW);
    else super(...args);
  }
  static now() {
    return FROZEN_NOW;
  }
}
sandbox.Date = FrozenDate;
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

/* ---- 10. 正文：reader.html 里**唯一一篇真写的**（1.2 有理数 · 数轴 · 知识点 2） ----
   全文只有这一篇是人写的，其余章节正文都是 reader-live.js 按树模板生成的占位。
   reader-live.js 第 19/31 行：`var art = document.getElementById('knowledge-point')`、
   `var authoredHTML = art.innerHTML` —— 所以"那篇正文"就是 **#knowledge-point 的 innerHTML**，
   原样搬过来，学生端以后把它塞回同一个容器就能渲染得一字不差。

   坐标不另抄一份：从 reader-live.js 的 AUTHORED 读出来，再回树里解析成路径。
   为什么要带 stage 和册名：`no` **不唯一** —— 十几个册都有 `no=01` 的章、好几个有 `no=1.2` 的节。 */
function extractElementInner(html, tag, id) {
  const open = new RegExp(`<${tag}\\b[^>]*\\bid="${id}"[^>]*>`, 'i').exec(html);
  if (!open) return null;
  const from = open.index + open[0].length;
  const re = new RegExp(`<(/?)${tag}\\b[^>]*?(/?)>`, 'gi');
  re.lastIndex = from;
  let depth = 1;
  let m;
  while ((m = re.exec(html))) {
    if (m[1] === '/') {
      depth -= 1;
      if (depth === 0) return html.slice(from, m.index);
    } else if (m[2] !== '/') {
      depth += 1;
    }
  }
  return null;
}

const readerLive = fs.readFileSync(path.join(ROOT, 'assets/js/reader-live.js'), 'utf8');
const authored = /var AUTHORED = \{ chapter: '([^']+)', section: '([^']+)', point: '([^']+)' \};/.exec(readerLive);
const readerHtml = fs.readFileSync(path.join(ROOT, 'reader.html'), 'utf8');
const authoredHtml = extractElementInner(readerHtml, 'article', 'knowledge-point');

if (!authored) {
  console.error('[warn] reader-live.js 里没找到 AUTHORED —— 正文坐标得手填了');
} else if (!authoredHtml) {
  console.error('[warn] reader.html 里没找到 #knowledge-point 的 article');
} else {
  const [, chapterNo, sectionNo, pointNo] = authored;
  /* 回树里解析：初中 → 章 no → 节 no → 知识点 no */
  const book = (W.MATH_TREE.children || []).find((b) =>
    b.stage === 'junior' &&
    (b.children || []).some((ch) =>
      ch.no === chapterNo &&
      (ch.children || []).some((sec) =>
        sec.no === sectionNo &&
        (sec.children || []).some((pt) => pt.no === pointNo))));
  const chapter = book && book.children.find((ch) => ch.no === chapterNo &&
    (ch.children || []).some((sec) => sec.no === sectionNo &&
      (sec.children || []).some((pt) => pt.no === pointNo)));
  const section = chapter && chapter.children.find((sec) => sec.no === sectionNo &&
    (sec.children || []).some((pt) => pt.no === pointNo));
  const point = section && section.children.find((pt) => pt.no === pointNo);

  dump('content-authored.json', {
    /* 这组坐标就是"挂到哪个节点"的钥匙；导库按它走树，走不到就报错，不许静默跳过 */
    target: {
      stage: 'junior',
      bookName: book ? book.name : null,
      chapterNo,
      sectionNo,
      pointNo,
    },
    resolvedNames: {
      book: book && book.name,
      chapter: chapter && chapter.name,
      section: section && section.name,
      point: point && point.name,
    },
    source: 'reader.html 的 #knowledge-point innerHTML（原样，未加工）',
    html: authoredHtml.trim(),
  }, `唯一一篇真写的正文（${book ? book.name : '?'} · ${chapter ? chapter.name : '?'} · ${point ? point.name : '?'}）`);
}

/* ---- 10. 考点速练的题（practice.html 里那几道，**带选项、正确答案、解析**） ----
   为什么要抽它：白板题库那 58 条只有题面（`{id, book, chapter, text}`），**没有答案**，
   拿它做不了"判分"。而 practice.html 里这几道是写死的真题：正确选项带 `data-correct="true"`、
   填空题带 `data-answer`、还有 `.explain__body` 解析 —— 这是站里唯一一份**可判分**的题。
   抽法与正文同规矩：**先从 HTML 里原样抽进 seed/，再由导库读**，不让导库跨仓库去啃 HTML。 */
function extractPracticeQuestions(html) {
  const items = html.split(/<article class="quiz-item[^"]*">/).slice(1);
  const out = [];
  items.forEach((chunk, idx) => {
    /* 到下一个 </article> 为止（本题的范围） */
    const end = chunk.indexOf('</article>');
    const body = end >= 0 ? chunk.slice(0, end) : chunk;

    const tag = /<span class="quiz-tag">([\s\S]*?)<\/span>/.exec(body);
    const stemRaw = /<p class="quiz-stem">([\s\S]*?)<\/p>/.exec(body);
    const explain = /<p class="explain__body">([\s\S]*?)<\/p>/.exec(body);
    if (!stemRaw) { return; }

    /* ---- 把答案从题干里**抠掉** ----
       填空题的填空格本来就在 `.quiz-stem` 里面（`<input class="blank" data-answer="-3">`），
       直接整段当题干存下来 = **把答案一起发给浏览器**，页面上翻一下 DOM 就看见了。
       所以这里：① 先把每个 input 的 `data-answer` 收进 blanks；② 再把 input 标签本身
       从题干里删掉（空格换成下划线占位），答案只留在 seed 里、只到服务端为止。 */
    const blanks = [];
    const stemClean = stemRaw[1]
      .replace(/<input[^>]*class="blank"[^>]*>/g, (tagHtml) => {
        const label = /aria-label="([^"]*)"/.exec(tagHtml);
        const ans = /data-answer="([^"]*)"/.exec(tagHtml);
        blanks.push({ label: label ? label[1] : '', answer: ans ? ans[1] : '' });
        return '<span class="blank-slot">＿＿</span>';
      })
      /* 兜底：万一还有别的 input 混在题干里，也一并去掉并回收答案 */
      .replace(/<input[^>]*>/g, (tagHtml) => {
        const label = /aria-label="([^"]*)"/.exec(tagHtml);
        const ans = /data-answer="([^"]*)"/.exec(tagHtml);
        if (ans) { blanks.push({ label: label ? label[1] : '', answer: ans[1] }); }
        return '<span class="blank-slot">＿＿</span>';
      });
    const stem = stemClean.trim();

    /* 题干里绝不许再出现答案（写完当场验，别等上线才被翻出来） */
    if (/data-answer=|data-correct=/.test(stem)) {
      throw new Error(`练习题第 ${idx + 1} 题的题干里还残留着答案标记，不能入库`);
    }

    /* 选项：<button ... class="opt" ... data-correct="true"> ... 里抠 key 与 text */
    const opts = [];
    const optRe = /<button[^>]*class="opt"[^>]*>([\s\S]*?)<\/button>/g;
    let m;
    while ((m = optRe.exec(body))) {
      const whole = m[0];
      const key = /<span class="opt__key">([\s\S]*?)<\/span>/.exec(m[1]);
      const text = /<span class="opt__text">([\s\S]*?)<\/span>\s*$/.exec(m[1]);
      opts.push({
        key: key ? key[1].replace(/<[^>]+>/g, '').replace(/\.\s*$/, '').trim() : '',
        text: text ? text[1].trim() : m[1].trim(),
        correct: /data-correct="true"/.test(whole),
      });
    }

    /* 填空题的空格上面已经从题干里收好了（见 stemClean） */

    const correct = opts.filter((o) => o.correct).map((o) => o.key);
    let kind = 'choice';
    let answer = correct.join('');
    if (!opts.length && blanks.length) {
      kind = 'blank';
      answer = blanks.map((b) => b.answer).join('|');
    }
    if (!answer) { return; }   /* 没答案的题不进库 —— 进了也判不了分 */

    out.push({
      no: idx + 1,
      kind,
      tag: tag ? tag[1].replace(/<[^>]+>/g, '').trim() : '',
      stem,
      options: opts.map((o) => ({ key: o.key, text: o.text })),
      blanks,
      answer,
      explanation: explain ? explain[1].trim() : '',
      source: 'practice.html',
    });
  });
  return out;
}

const practiceHtml = fs.readFileSync(path.join(ROOT, 'practice.html'), 'utf8');
const practiceQuestions = extractPracticeQuestions(practiceHtml);
dump('practice-questions.json', { questions: practiceQuestions },
  `考点速练的题（${practiceQuestions.length} 道，带选项与正确答案，可判分）`);

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
  /* 那唯一一篇正文：条数永远是 1，真正要盯的是**字符数**（被截断了数量查不出来） */
  authoredContents: authoredHtml ? 1 : 0,
  authoredChars: authoredHtml ? authoredHtml.trim().length : 0,
  /* 可判分的题（practice.html 抽出来的那份） */
  practiceQuestions: practiceQuestions.length,
};
dump('_counts.json', counts, '对数基准：后台灌完必须逐项一致');

console.log('\n导出到 seed/：');
written.forEach((w) => console.log('  ' + w.name.padEnd(26) + w.kb.padStart(10) + '   ' + w.note));
console.log('\n对数基准 _counts.json：');
Object.entries(counts).forEach(([k, v]) => console.log('  ' + k.padEnd(18) + v));
