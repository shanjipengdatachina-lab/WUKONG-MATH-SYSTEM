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

/* 注：左右栏显隐逻辑已移至 assets/js/ide-shell.js，由 ide-shell-check 单独验证 */

print(__fail ? 'RESULT: 有失败项' : 'RESULT: 全部通过');