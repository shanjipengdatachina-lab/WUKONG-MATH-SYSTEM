/* ============================================================
   自检断言
   ============================================================ */
function assert(ok, label) {
  print((ok ? 'PASS  ' : 'FAIL  ') + label);
  if (!ok) __fail = true;
}
var __fail = false;

/* 1. 初始：中栏仍是设计稿手写正文，右栏目录已生成 */
assert(__capture.artInner === '__AUTHORED__', '初始中栏保留手写正文');
assert(__capture.outlineHidden === false, '右栏「本页目录」已展开');
assert(__capture.outlineItems.length === 2, '右栏生成 2 条小标题（h2 + h3）');
assert(__capture.outlineItems[0].className === 'outline__item', 'h2 → 一级目录项');
assert(__capture.outlineItems[1].className === 'outline__item outline__item--sub', 'h3 → 二级目录项');

/* 2. 点「第二章 整式的加减」：整章正文就地生成 */
var chRow = mkRow(['ch-row'], { 'data-chapter': '02' });
chRow.closest = function () { return null; };
clickRow(chRow);
var h1 = __capture.artInner;
assert(h1.indexOf('整式的加减') !== -1, '中栏换成第二章标题');
assert(h1.indexOf('2.1　整式') !== -1, '含 2.1 节标题');
assert(h1.indexOf('2.2　整式的加减') !== -1, '含 2.2 节标题');
assert(h1.indexOf('合并同类项') !== -1, '含该节知识点');
assert(h1.indexOf('本章共 2 节 · 5 个知识点 · 5 个方法 · 3 个易错点 · 2 个考点') !== -1, '统计口径正确');
assert(h1.indexOf('sec-2-1') !== -1, '节锚点 id 正确');
assert(h1.indexOf('grp-method') !== -1 && h1.indexOf('grp-error') !== -1, '方法 / 易错分组锚点正确');
assert(document.title === '整式的加减 · 章节阅读', '文档标题随之更新');

/* 3. 点「1.2 有理数」下的知识点 2：走手写正文 */
var sectionUl = { previousElementSibling: mkRow(['ch-row'], { 'data-chapter': '01' }) };
var secRow = mkRow(['sec-row'], { 'data-section': '1.2' });
secRow.closest = function (sel) { return sel === 'ul.section-list' ? sectionUl : null; };
var pointUl = { previousElementSibling: secRow };
var ptRow = mkRow(['pt-row'], { 'data-point': '2' });
ptRow.closest = function (sel) { return sel === 'ul.point-list' ? pointUl : null; };

__capture.artInner = '';
clickRow(ptRow);
assert(__capture.artInner === '__AUTHORED__', '点数轴 → 回到手写正文');
assert(document.title === '数轴 · 章节阅读', '标题切回数轴');

/* 4. 点同一章的其它知识点：生成正文 + 精确定位到条目 */
__capture.artInner = '';
var ptRow3 = mkRow(['pt-row'], { 'data-point': '3' });
ptRow3.closest = function (sel) { return sel === 'ul.point-list' ? pointUl : null; };
clickRow(ptRow3);
var h2 = __capture.artInner;
assert(h2.indexOf('有理数') !== -1 && h2.indexOf('1.1　知识速查') !== -1, '生成第一章整章正文');
assert(h2.indexOf('id="pt-1-2-3"') !== -1, '目标知识点条目带锚点 id');
assert(h2.indexOf('data-authored="1"') !== -1, '数轴条目保留「图文详解」入口');

/* 5. 点方法速学：定位到本章分组 */
__capture.artInner = '';
var secMethod = mkRow(['sec-row'], { 'data-section': 'method' });
secMethod.closest = function (sel) { return sel === 'ul.section-list' ? { previousElementSibling: mkRow(['ch-row'], { 'data-chapter': '24' }) } : null; };
clickRow(secMethod);
assert(__capture.artInner.indexOf('圆') !== -1, '第 24 章正文生成');
assert(__capture.artInner.indexOf('grp-method') !== -1, '含方法分组锚点');

/* 6. 点「图文详解」入口：回到手写正文 */
__capture.artInner = '';
var authoredHandler = __capture.artHandlers.click;
if (authoredHandler) {
  authoredHandler({ target: { closest: function () { return mkRow([], { 'data-authored': '1' }); } }, preventDefault: function () {} });
  assert(__capture.artInner === '__AUTHORED__', '图文详解 → 回到手写正文');
} else {
  assert(false, '中栏已绑定「图文详解」点击代理');
}

/* 7. 左栏目录：不再手写，按学段现建（默认初中） */
function countIn(text, re) { return (text.match(re) || []).length; }

var tree = __capture.treeInner;
assert(tree.indexOf('class="tree-volume"') !== -1, '左栏目录由数据现建（不再是一段手写 HTML）');
assert(countIn(tree, /class="tree-volume"/g) === 6, '默认只列初中的六册');
assert(countIn(tree, /class="ch-row"/g) === 29, '初中 29 章全在树上');
assert(tree.indexOf('data-chapter="01"') !== -1 && tree.indexOf('data-chapter="29"') !== -1, '初中章号 01-29 一路排下来，可以直接当键');
assert(countIn(tree, /data-active="true"/g) === 3, '手写正文那一支（有理数 / 1.2 / 数轴）默认高亮三处');
assert(tree.indexOf('data-focus="sec-1-2"') !== -1 && tree.indexOf('data-focus="pt-1-2-2"') !== -1, '节与知识点自带目标锚点');
assert(tree.indexOf('七年级（上）') !== -1, '册名照原样列出来');
assert(tree.indexOf('class="tree-note"') === -1, '初中没有没核到的册，不该冒出「还没收录」那行');
assert(treeMetaEl.textContent === '6 册 · 29 章', '目录头写的是当前学段的账');
assert(stageChips[1].getAttribute('aria-pressed') === 'true', '默认按在「初中」那一格上');

/* 8. 换学段：左栏换成那一套，中栏跟着落到那一套的开头 */
window.MathSite = {
  icons: function () {},
  initReaderTree: function () { __capture.rebind = (__capture.rebind || 0) + 1; }
};
__capture.docHandlers.DOMContentLoaded();   // 先让 pages.js 绑过一轮，之后才轮到补绑

function pickStage(code) {
  stageBarEl.handlers.click({ target: { closest: function () { return stageChips[code]; } } });
}

pickStage(0);
var treeP = __capture.treeInner;
assert(countIn(treeP, /class="tree-volume"/g) === 12, '小学换成十二册');
assert(countIn(treeP, /class="ch-row"/g) === 104, '小学 104 章全在树上');
assert(treeP.indexOf('七年级') === -1, '小学这棵树里不该混进初中的册');
assert(treeP.indexOf('data-chapter="b0c0"') !== -1, '小学章号每册从 01 重来，键改用「册·章」序号');
assert(treeP.indexOf('data-chapter="01"') === -1, '小学不该出现裸章号作键（会串册）');
assert(countIn(treeP, /class="tree-note"/g) === 0, '二下 / 三下的新版目录核到了，不该再有「还没收录」那行');
assert(countIn(treeP, /class="ch-row__warn"/g) === 1, '只剩三下「生活中的运动现象」一处章级待核，标在树上');
assert(treeP.indexOf('待核') !== -1, '待核那处写明了原因（鼠标悬停可见）');
assert(treeMetaEl.textContent === '12 册 · 104 章 · 1 待核', '目录头跟着换成小学的账（册级与章级待核都算）');
assert(__capture.rebind === 1, '重建之后补绑了一次折叠逻辑（不然册点不开）');
assert(document.title === '数学游戏 · 章节阅读', '中栏落到小学第一册第一章');
assert(__capture.artInner.indexOf('在校园里找一找') !== -1, '正文里是那一章的小节');

/* 小学每册都有「第一单元」：点第八册（四年级下册）的第一个单元，
   必须翻到四年级下册，而不是翻到别的册的第一单元去 */
var firstOfEighth = mkRow(['ch-row'], { 'data-chapter': 'b7c0' });
firstOfEighth.closest = function () { return null; };
__capture.artInner = '';
clickRow(firstOfEighth);
assert(__capture.artInner.indexOf('四年级下册') !== -1, '点第八册的第一个单元，翻到的就是第八册');

pickStage(2);
var treeS = __capture.treeInner;
assert(countIn(treeS, /class="tree-volume"/g) === 5, '高中五册');
assert(countIn(treeS, /class="ch-row"/g) === 22, '高中 22 章');
assert(treeS.indexOf('data-chapter="01"') === -1, '高中必修 / 选必各自从 01 排，章号不能当键');
assert(countIn(treeS, /data-chapter="b\d+c0"/g) === 5, '五册的第一章键各不相同');
assert(treeS.indexOf('必修第一册') !== -1 && treeS.indexOf('选择性必修第三册') !== -1, '五册都在（必修到选必）');
assert(document.title === '集合与常用逻辑用语 · 章节阅读', '中栏落到高中第一册第一章');

pickStage(3);
var treeO = __capture.treeInner;
assert(countIn(treeO, /class="tree-volume"/g) === 4, '竞赛四个板块');
assert(countIn(treeO, /class="ch-row"/g) === 30, '竞赛 30 章');
assert(countIn(treeO, /class="section-list"/g) === 0, '竞赛只做到章，一层节都没有');
assert(treeMetaEl.textContent === '4 板块 · 30 章', '目录头说「板块」不说「册」');
assert(document.title === '集合 · 章节阅读', '中栏落到竞赛第一板块的第一章');
assert(__capture.artInner.indexOf('只有章节框架') !== -1, '竞赛的章只有框架，正文如实说，不假装有内容');

pickStage(1);
assert(__capture.treeInner === tree, '切回初中，左栏回到原来那棵树');
assert(__capture.artInner === '__AUTHORED__', '切回初中，中栏回到手写正文');
assert(treeMetaEl.textContent === '6 册 · 29 章', '目录头也切回来');
assert(stageChips[1].getAttribute('aria-pressed') === 'true' && stageChips[3].getAttribute('aria-pressed') === 'false', '按钮的按下态跟着走');
assert(stageChips[1].className === 'tree-stage__chip is-on', '当前那一格带 is-on');
assert(window.localStorage.getItem('wkmath.graph.stage') === 'junior', '学段记在与图谱同一个键上');

/* 注：左右栏显隐逻辑已移至 assets/js/ide-shell.js，由 ide-shell-check 单独验证 */

print(__fail ? 'RESULT: 有失败项' : 'RESULT: 全部通过');