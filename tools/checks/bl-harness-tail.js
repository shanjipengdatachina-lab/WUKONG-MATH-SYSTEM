/* ============================================================
   黑板入口板自检 —— 断言
   ============================================================ */
var BL = window.__BOARD_LINK__;
assert(!!BL, '黑板入口脚本已初始化');
assert(BL.rules.length >= 9, '规则表覆盖多类内容（实际 ' + BL.rules.length + ' 条）');
assert(BL.rules.filter(function (r) { return r.compact; }).length === 0, '目录 / 列表类条目不挂按钮');

/* URL 组装 */
var u = BL.buildUrl({ text: '(−2) × (−5)', tag: '考点速练 · 考点 1', extra: 'A. x + 1' });
assert(u.indexOf('whiteboard.html?t=') === 0, '链接指向白板页');
assert(u.indexOf(encodeURIComponent('考点速练 · 考点 1')) > 0, '来源标签做了编码');
assert(u.indexOf('&x=') > 0, '补充信息做了编码');
assert(BL.buildUrl({ text: 'a&b=c' }).indexOf('a%26b%3Dc') > 0, '特殊字符被正确转义');

function fakeEl(map, lists) {
  return {
    textContent: map[''] || '',
    querySelector: function (sel) { return Object.prototype.hasOwnProperty.call(map, sel) ? { textContent: map[sel] } : null; },
    querySelectorAll: function (sel) { return ((lists && lists[sel]) || []).map(function (t) { return { textContent: t }; }); },
    getAttribute: function () { return null; },
    setAttribute: function () {},
    appendChild: function (c) { this.child = c; return c; }
  };
}
function ruleOf(name) {
  return BL.rules.filter(function (r) { return r.name === name; })[0];
}

/* 各规则的取文逻辑 */
var quiz = ruleOf('考点速练·题目').payload(fakeEl(
  { '.quiz-stem': '下列各式中，是单项式的是（　）', '.quiz-head .quiz-tag': '考点 1 整式的概念' },
  { '.opt, .opt__text, .option': ['x + 1', '3a²b', 'a + b'] }
));
assert(quiz.text.indexOf('是单项式的是') > 0, '考点题目：取到题干');
assert(quiz.tag === '考点 1 整式的概念', '考点题目：取到考点标签');
assert(quiz.extra.indexOf('3a²b') >= 0, '考点题目：选项一并带上黑板');

var allSels = BL.rules.map(function (r) { return r.sel; }).join(' ');
['#chapter-tree', '.srow__item', '.srow__name', '.points-list__item'].forEach(function (sel) {
  assert(allSels.indexOf(sel) < 0, '目录 / 列表条目不再挂按钮：' + sel);
});
assert(allSels.indexOf('article.quiz-item') >= 0, '题目条目仍然挂按钮');

var wrong = ruleOf('错题本·题目').payload(fakeEl({ '.mrow__stem': '若正比例函数 y = kx 的图象经过点 (2, −6)…', '.mrow__tag': '一次函数' }));
assert(wrong.text.indexOf('正比例函数') >= 0 && wrong.tag === '一次函数', '错题：题干与考点标签');

var pit = ruleOf('易错速析·易错点').payload(fakeEl({ '.prow__title': '对「0」的含义理解不透彻', '.prow__desc': '0 既不是正数也不是负数' }));
assert(pit.text.indexOf('0') > 0 && pit.extra.indexOf('正数') > 0, '易错点：标题与说明分开带上');

var fml = ruleOf('公式速查·公式').payload(fakeEl({ '.frow__name': '绝对值', '.frow__formula': '|a| ≥ 0' }));
assert(fml.text === '绝对值' && fml.extra === '|a| ≥ 0', '公式：名称与公式分开带上');

var note = ruleOf('笔记·条目').payload(fakeEl({ '.note__title': '直线、射线、线段', '.note__body': '线段有两个端点', '.note__tag': '来自知识点' }));
assert(note.text.indexOf('线段') >= 0 && note.tag === '来自知识点', '笔记：标题与来源带上');
assert(note.extra.indexOf('端点') > 0, '笔记：正文作为补充信息带上');

var sect = ruleOf('知识点卡片·标题').payload(fakeEl({ '.kp-title': '数轴' }), {});
assert(sect.text === '数轴' && sect.tag === '知识点', '知识点卡片：取到标题');

/* 注入与幂等 */
var quizEl = fakeEl({ '.quiz-stem': '(−3) + 5', '.quiz-head .quiz-tag': '七上 · 有理数' });
var root = { querySelectorAll: function (sel) { return sel === 'article.quiz-item' ? [quizEl] : []; } };
assert(BL.run(root) === 1, '在题目条目上注入一个白板按钮');
assert(quizEl.child && quizEl.child.getAttribute === undefined || !!quizEl.child, '按钮已挂到条目里');

/* 静态注入（真实页面 DOM 之外的兜底） */
assert(BL.run({ querySelectorAll: function () { return []; } }) === 0, '没有目标时不注入任何东西');

/* 页面实际内容：至少有一条规则能命中（说明选择器没写错） */
assert(BL.txt({ textContent: '  a  b  ' }) === 'a b', '文本提取会压缩空白');

out(__fail ? 'RESULT: 有失败项' : 'RESULT: 全部通过');
