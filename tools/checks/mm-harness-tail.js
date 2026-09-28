/* ============================================================
   知识图谱自检 —— 断言（跑在 minmap.js 之后）
   ============================================================ */
var MM = window.__MM__;
var TREE = window.MATH_TREE;
function eq(a, b, label) { assert(String(a) === String(b), label + '（期望 ' + b + '，实际 ' + a + '）'); }
function has(text, part, label) { assert(String(text).indexOf(part) !== -1, label); }

assert(!!MM, '导出自查接口 window.__MM__');
assert(!!TREE && (TREE.kids || []).length > 0, '知识树有内容');

/* ---- 0. 四个学段：各数一遍册与章 ----
   数错不会崩，只会让某一屏安静地少一块 —— 所以按学段分别对账。
   下面的期望值来自核对过的教材目录，改动会被立刻发现。 */
var STAGE_BOOKS = { primary: 12, junior: 6, senior: 5, olympiad: 4 };
var STAGE_CHAPTERS = { primary: 104, junior: 29, senior: 22, olympiad: 30 };
var stageTally = {};
TREE.kids.forEach(function (b) {
  stageTally[b.stage] = stageTally[b.stage] || { books: 0, chapters: 0 };
  stageTally[b.stage].books++;
  stageTally[b.stage].chapters += (b.children || []).length;
});
Object.keys(STAGE_BOOKS).forEach(function (code) {
  eq(stageTally[code] ? stageTally[code].books : 0, STAGE_BOOKS[code], code + ' 的册（板块）数');
  eq(stageTally[code] ? stageTally[code].chapters : 0, STAGE_CHAPTERS[code], code + ' 的章数');
});
eq(TREE.kids.length, 27, '四学段合计 27 册 / 板块');
var chapters = 0;
TREE.kids.forEach(function (b) { chapters += (b.children || []).length; });
eq(chapters, 185, '四学段合计 185 章');
assert(TREE.kids.every(function (b) { return b.stage && b.source; }),
  '每册都带学段与目录来源（缺一个就不该生成出来）');
var noSource = TREE.kids.filter(function (b) { return !b.source; }).map(function (b) { return b.name; });
eq(noSource.length, 0, '没有缺来源的册（缺的：' + (noSource.join('、') || '没有') + '）');
/* 待核：分两级看 —— 册级（整册目录没核到，只能留空）和章级（章核到了、小节没核到）。
   2026 秋把二下 / 三下的新版目录核到之后，册级待核清零；章级只剩一处，如实标着。 */
var pendBad = TREE.kids.filter(function (b) { return !b.pending && !(b.children || []).length; })
  .map(function (b) { return b.name; });
eq(pendBad.length, 0, '空着的册必须写明"待核"（否则会被当成忘了填；实际 ' + (pendBad.join('、') || '没有') + '）');
var pendingBooks = TREE.kids.filter(function (b) { return b.pending; }).map(function (b) { return b.name; });
eq(pendingBooks.length, 0, '册级待核已清零（二下 / 三下的新版目录核到了；实际 ' + (pendingBooks.join('、') || '没有') + '）');
var pendingChapters = [];
TREE.kids.forEach(function (b) {
  (b.children || []).forEach(function (c) {
    if (c.pending) pendingChapters.push(b.name + '·' + c.name);
  });
});
eq(pendingChapters.length, 1, '章级待核只剩一处，写明原因（实际 ' + (pendingChapters.join('、') || '没有') + '）');
eq(pendingChapters[0], '三年级下册·生活中的运动现象',
  '那一处是三下「生活中的运动现象」——课本站只列到单元名与"剪纸"，不猜');
/* 竞赛只到"章"一级 */
var olympiadSections = 0;
TREE.kids.filter(function (b) { return b.stage === 'olympiad'; }).forEach(function (b) {
  (b.children || []).forEach(function (c) { olympiadSections += (c.children || []).length; });
});
eq(olympiadSections, 0, '竞赛只到「章」，一层节都没有（说好的章节框架）');

/* ---- 1. 初始：默认初中、未登录、没记过 → 学段根 + 六册 + 各章 ---- */
eq(MM.stage.get(), 'junior', '默认落在初中（现在的内容都是初中的）');
eq(MM.scope.get(), '', '未登录时默认看总览，而不是某一册');
eq(bookLabelEl.textContent, '总览', '工具条上的册按钮写着"总览"');
eq(stageLabelEl.textContent, '初中', '工具条最前面的学段按钮写着"初中"');
eq(MM.level.get(), 2, '默认层级是"到章"');
eq(levelLabelEl.textContent, '到章', '层级按钮写着"到章"');
eq(MM.visible().length, 1 + 6 + 29, '默认可见：学段根 + 六册 + 29 章（只这一屏，不含别的学段）');
eq(MM.visible()[0].kind, 'stage', '这一屏的根是「学段」节点，不是那个总根');
has(scopeNoteEl.textContent, '初中', '说明里写清当前看的是哪个学段');
has(scopeNoteEl.textContent, '29 章', '说明里写了这一学段有多少章');
has(scopeNoteEl.textContent, '未登录', '说明里写清了未登录的规则');
eq(MM.signedIn(), false, '侧栏是"登录"时判定为未登录');
eq(MM.studentGrade(), '七年级（下）', '演示学生的年级是七年级（下）');
eq(MM.books().length, 6, '初中六册名单从数据里读出来');
eq(MM.booksOf('primary').length, 12, '小学 12 册也能读出来');
eq(MM.booksOf('olympiad').length, 4, '竞赛 4 个板块');

/* ---- 2. 登录后默认聚焦学生年级 ---- */
window.localStorage.removeItem('wkmath.graph.scope');
accountEl.setAttribute('href', 'profile.html');
eq(MM.signedIn(), true, '侧栏是账号时判定为已登录');
eq(MM.scope.initial(), '七年级（下）', '登录后默认聚焦学生当前年级');
accountEl.setAttribute('href', 'login.html');
eq(MM.scope.initial(), '', '未登录时默认给总览');

/* ---- 3. 记住上次看的册 ---- */
accountEl.setAttribute('href', 'profile.html');
window.localStorage.setItem('wkmath.graph.scope', '八年级（上）');
eq(MM.scope.initial(), '八年级（上）', '记过某册就以记住的为准');
window.localStorage.removeItem('wkmath.graph.scope');

/* ---- 4. 册浮层：开合、互斥、选择 ---- */
fire(bookBtnEl, 'click');
eq(bookMenuEl.hasAttribute('hidden'), false, '点册按钮展开浮层');
eq(bookBtnEl.getAttribute('aria-expanded'), 'true', '展开时按钮标记 expanded');
fire(levelBtnEl, 'click');
eq(bookMenuEl.hasAttribute('hidden'), true, '打开层级浮层时册浮层自动收起');
eq(levelMenuEl.hasAttribute('hidden'), false, '层级浮层打开');
fire(levelBtnEl, 'click');
eq(levelMenuEl.hasAttribute('hidden'), true, '再点一次收起');
fire(bookBtnEl, 'click');
/* 册那一栏的元素现在由 mindmap.js 现建，所以去问接口拿，而不是桩里那份写死的 */
fire(MM.bookItems()[3], 'click');
eq(MM.scope.get(), '八年级（上）', '点浮层里的"八年级（上）"就只看这一册');
eq(bookLabelEl.textContent, '八上', '按钮上的文字跟着变成八上');
eq(bookMenuEl.hasAttribute('hidden'), true, '选完自动收起浮层');
eq(MM.bookItems()[3].getAttribute('aria-pressed'), 'true', '当前册的选中状态对读屏可见');
eq(MM.bookItems()[3].classList.contains('is-on'), true, '当前册在浮层里真的高亮（is-on）');
eq(MM.bookItems()[0].getAttribute('aria-pressed'), 'false', '其它册的选中状态是未选中');
eq(MM.bookItems()[0].classList.contains('is-on'), false, '其它册没被误标高亮');
eq(window.localStorage.getItem('wkmath.graph.scope'), '八年级（上）', '选择记在本机');
assert(TOASTS.length > 0 && TOASTS[TOASTS.length - 1].indexOf('八年级（上）') !== -1, '选完给一句轻提示');
var bookVisible = MM.visible().length;
assert(bookVisible < 1 + 6 + 29, '只看一册时节点数明显变少');
fire(MM.bookItems()[0], 'click');
eq(MM.scope.get(), '', '点"总览·全部册"回到全部');
/* 换学段之后，册那一栏必须整排换掉 —— 只换数据不换名单是最容易漏的一处 */
eq(MM.bookItems().length, 1 + 6, '初中那一栏是"总览 + 六册"共 7 项');
eq(MM.bookItems()[6].getAttribute('data-book'), '九年级（下）', '最后一项是九年级（下）');

/* ---- 5. 搜索面板 ---- */
fire(searchToggleEl, 'click');
eq(MM.searchOpen(), true, '点工具条的搜索按钮弹出定位面板');
assert(searchToggleEl.classList.contains('is-on'), '按钮进入激活态');
fire(searchCloseEl, 'click');
eq(MM.searchOpen(), false, '关掉定位面板');
assert(!searchToggleEl.classList.contains('is-on'), '按钮退出激活态');

/* ---- 6. 点节点：信息浮出来 ---- */
var chapterNode = MM.visible().filter(function (n) { return n.kind === 'chapter'; })[0];
MM.select(chapterNode.id);
eq(MM.infoOpen(), true, '点节点后信息面板浮出来');
/* 标题栏的编号和图里节点上的编号写法一致（都带册的短名）——
   两处写法不同的话，一眼对不上"这是哪一个节点"。 */
eq(panelNoEl.textContent, MM.labelNo(chapterNode), '标题栏显示章节编号（与图里同一写法）');
has(panelBodyEl.innerHTML, chapterNode.name, '正文里是这个节点的名字');
has(panelBodyEl.innerHTML, 'mm-panel__kind', '正文里有类型徽标');
MM.closeInfo();
eq(MM.infoOpen(), false, '关掉信息面板');
eq(panelBodyEl.innerHTML, '', '关掉后正文清空');

/* ---- 7. 拖动：标题栏按住就能挪，边界留在画布内 ---- */
MM.select(chapterNode.id);
fire(panelHeadEl, 'pointerdown', ev({ x: 1100, y: 40 }));
assert(infoPanelEl.classList.contains('is-dragging'), '按下标题栏进入拖动状态');
winFire('pointermove', ev({ x: 1160, y: 80 }));
eq(infoPanelEl.style.left, '1092px', '往右拖会被画布右边界拦住');
eq(infoPanelEl.style.top, '60px', '纵向按位移量走');
eq(infoPanelEl.style.right, 'auto', '拖动后不再用 right 定位');
winFire('pointermove', ev({ x: -400, y: -400 }));
eq(infoPanelEl.style.left, '8px', '往左拖会被左边界拦住');
eq(infoPanelEl.style.top, '8px', '往上拖会被上边界拦住');
winFire('pointerup');
assert(!infoPanelEl.classList.contains('is-dragging'), '松手结束拖动');

/* ---- 8. 层级切档 ---- */
fire(levelBtnEl, 'click');
fire(levelItems[1], 'click');
eq(MM.level.get(), 3, '切到"展开到节"');
eq(levelLabelEl.textContent, '到节', '层级按钮跟着改');
eq(levelMenuEl.hasAttribute('hidden'), true, '选完收起浮层');
eq(levelItems[1].getAttribute('aria-pressed'), 'true', '当前档的选中状态对读屏可见');
eq(levelItems[1].classList.contains('is-on'), true, '当前档在浮层里真的高亮（is-on）');
assert(MM.visible().length > 1 + 6 + 29, '展开到节后节点变多');
MM.level.set(99);
eq(levelLabelEl.textContent, '全部', '切到"全部展开"');
assert(MM.visible().length > 600, '全部展开后节点数上千级（实际 ' + MM.visible().length + '）');
MM.level.set(2);
eq(MM.visible().length, 1 + 6 + 29, '收回"到章"后回到默认规模');

/* ---- 9. 快捷键 ---- */
docFire('keydown', ev({ key: '0', code: 'Digit0', shift: true }));
eq(zoomLabelEl.textContent, '100%', '0 回到 100%（作为下面适应窗口的基准）');
docFire('keydown', ev({ key: '!', code: 'Digit1', shift: true }));
assert(zoomLabelEl.textContent !== '100%', '⇧1 适应窗口把缩放调到贴合整图的档位（当前 ' + zoomLabelEl.textContent + '）');
docFire('keydown', ev({ key: '$', code: 'Digit4', shift: true }));
eq(MM.level.get(), 99, '⇧4 全部展开');
docFire('keydown', ev({ key: '@', code: 'Digit2', shift: true }));
eq(MM.level.get(), 2, '⇧2 收起到章');
docFire('keydown', ev({ key: '0', code: 'Digit0', shift: true }));
eq(zoomLabelEl.textContent, '100%', '0 回到 100%');
MM.openSearch();
MM.select(chapterNode.id);
docFire('keydown', ev({ key: 'Escape' }));
eq(MM.infoOpen(), false, 'Esc 收起信息面板');
eq(MM.searchOpen(), false, 'Esc 收起定位面板');
eq(bookMenuEl.hasAttribute('hidden'), true, 'Esc 收起浮层');

/* ---- 10. 定位跨册节点时自动放开筛选（学段内的册之间） ---- */
fire(MM.bookItems()[3], 'click');
eq(MM.scope.get(), '八年级（上）', '先只看八上');
var otherBookNode = TREE.kids[0].children[0];
MM.locate(otherBookNode.id);
eq(MM.scope.get(), '', '定位别册的章节会自动回到总览');
eq(window.localStorage.getItem('wkmath.graph.scope'), '', '并把这次放开也记下来');

/* ---- 11. 简称映射 ---- */
eq(MM.shortOf(''), '总览', '空串映射成总览');
eq(MM.shortOf('九年级（下）'), '九下', '九年级（下）简称九下');
eq(MM.shortOf('七年级（上）'), '七上', '七年级（上）简称七上');

/* ---- 12. 从别的页面点名进来：graph.html?q=知识点 ---- */
window.location.search = '';
eq(MM.query('q'), '', '没有 q 参数时读出空串');
eq(MM.deepLink(), false, '没有 q 时什么都不做');

window.location.search = '?q=' + encodeURIComponent('有理数');
eq(MM.query('q'), '有理数', '解析地址栏知识点参数（中文正确解码）');
eq(MM.deepLink(), true, '带 q 进来会执行点名定位');
eq(MM.searchOpen(), true, '自动打开定位面板');
eq(searchInputEl.value, '有理数', '搜索框里已经填好点名');
eq(MM.infoOpen(), true, '命中的条目直接把信息面板浮出来');
has(panelBodyEl.innerHTML, '有理数', '信息面板显示的就是这个条目');
eq(searchResultsEl.hasAttribute('hidden'), false, '结果列表同时列出来');

window.location.search = '?q=' + encodeURIComponent('这个条目并不存在');
eq(MM.deepLink(), true, '点名没命中时也把面板打开，好让你改词');
eq(searchResultsEl.hasAttribute('hidden'), false, '提示区保持可见');
has(searchResultsEl.innerHTML, '没有匹配的条目', '给出"没有匹配"的说明');
window.location.search = '';

/* ---- 12b. 点名点进了**别的学段**（用户报的："回到知识点之后图不能放大缩小也不能拖"）----
   白板上的题是初中的，图谱却可能正停在小学（学段是记在本机的，上次看过哪段就停在哪段）。
   原来定位只放开了"册"那一层筛选，没管学段：
   目标不在当前学段里 → 它压根不进布局（x/y/w 全是 undefined）→
   紧随其后的 centerOn 拿 undefined 一算就是 NaN → transform 被写成 translate(NaN,NaN)，
   浏览器把整条属性丢掉，之后怎么拖怎么滚都还是 NaN（用户看到的就是这一条）。
   两头都要守：学段要搬过去，view 也不能出现非有限数。 */
MM.stage.set('primary');
eq(MM.stage.get(), 'primary', '先停在小学（复现现场）');
var juniorBook = TREE.kids.filter(function (b) { return b.stage === 'junior'; })[0];
assert(!!juniorBook, '初中有册（前提）');
var juniorChapter = (juniorBook.children || juniorBook.kids)[0];

/* 前提：这个节点此刻**没有**几何。真机上就是这样 —— 首屏停在小学，初中的节点从没被布局过。
   桩里前面的用例渲染过初中，节点上留着旧坐标，不清掉就复现不出真机那条路（第一版漏了这步，
   于是"踩坏"之后断言照样绿 —— 假绿）。 */
var probeNode = null;
MM.each(function (n) { if (n.id === juniorChapter.id) probeNode = n; });
assert(!!probeNode && typeof probeNode.x === 'number', '桩里这个节点带着上一轮布局留下的坐标（前提）');
delete probeNode.x; delete probeNode.y; delete probeNode.w;
assert(typeof probeNode.x !== 'number', '清掉旧坐标 —— 相当于"这个节点从没被布局过"（前提）');

MM.locate(juniorChapter.id);
eq(MM.stage.get(), 'junior', '定位别的学段的节点 → 学段跟着搬过去');
eq(MM.scope.get(), '', '顺带回到这一学段的总览（不然册筛选还挂在别的学段的册上）');
assert(isFinite(MM.view().tx) && isFinite(MM.view().ty) && isFinite(MM.view().k),
  '定位之后 view 全是有限数（实际 tx=' + MM.view().tx + '，ty=' + MM.view().ty + '）');
assert(MM.visible().length > 0, '定位之后图还在（有节点被布局出来）');

/* 用户的原话是"不能放大缩小和拖动" —— 所以定位完还得真能拖、真能缩。
   注意比的时候必须先判有限数：view 坏掉时 tx 是 NaN，而 NaN !== NaN 恒为真，
   只写 `tx !== 拖之前的 tx` 会**假绿**（第一版就是这么写的，踩过）。 */
var vAfterDeep = MM.view();
fire(canvasEl, 'pointerdown', ev({ x: 600, y: 400, target: worldEl }));
winFire('pointermove', ev({ x: 700, y: 460 }));
winFire('pointerup');
assert(isFinite(MM.view().tx) && MM.view().tx !== vAfterDeep.tx,
  '定位之后画布照样能拖（用户报的就是这里拖不动；实际 tx=' + MM.view().tx + '）');
var kAfterDeep = MM.view().k;
/* 缩放是 ⌘/Ctrl + 滚轮（光滚轮是平移，见画布那段滚轮处理器） */
fire(canvasEl, 'wheel', ev({ x: 600, y: 400, target: worldEl, deltaY: -240, ctrl: true }));
assert(isFinite(MM.view().k) && MM.view().k !== kAfterDeep,
  '定位之后滚轮照样能缩放（实际 k=' + MM.view().k + '，缩放前 ' + kAfterDeep + '）');

/* 画面上那条 transform 永远得是能解析的有限数 —— 浏览器解析不了就整条丢掉，图会瞬移回左上角 */
assert(/^translate\(-?[\d.]+,-?[\d.]+\) scale\([\d.]+\)$/.test(worldEl.getAttribute('transform') || ''),
  '画布变换始终是能解析的有限数（实际 ' + worldEl.getAttribute('transform') + '）');

/* ---- 13. 浮层里的事件不该泄漏到画布 ---- */
var v0 = MM.view();

/* 对照组：在画布空白处按下并拖动 → 画布应该平移。
   有这一条才能证明下面那几条不是"什么都没测"。 */
fire(canvasEl, 'pointerdown', ev({ x: 600, y: 400, target: worldEl }));
winFire('pointermove', ev({ x: 700, y: 460 }));
winFire('pointerup');
assert(MM.view().tx !== v0.tx, '对照：按住画布空白处拖动确实会平移');
var vAfterPan = MM.view();

/* 节点面板：按住标题栏拖动，画布一动都不该动 */
MM.select(chapterNode.id);
fire(canvasEl, 'pointerdown', ev({ x: 800, y: 300, target: panelHeadEl }));
winFire('pointermove', ev({ x: 940, y: 520 }));
winFire('pointerup');
eq(MM.view().tx, vAfterPan.tx, '拖节点面板时画布横向没动');
eq(MM.view().ty, vAfterPan.ty, '拖节点面板时画布纵向没动');
eq(canvasEl.classList.contains('is-panning'), false, '画布没被带进平移态');

/* 定位面板同理 */
var vSearch = MM.view();
fire(canvasEl, 'pointerdown', ev({ x: 100, y: 120, target: searchHeadEl }));
winFire('pointermove', ev({ x: 300, y: 380 }));
winFire('pointerup');
eq(MM.view().tx, vSearch.tx, '拖定位面板时画布没动');

/* 工具条同理 */
var vDock = MM.view();
fire(canvasEl, 'pointerdown', ev({ x: 700, y: 820, target: dockEl }));
winFire('pointermove', ev({ x: 820, y: 700 }));
winFire('pointerup');
eq(MM.view().tx, vDock.tx, '拖工具条时画布没动');

/* 面板里滚轮 = 滚面板自己的内容，不该变成缩放图谱 */
var kBefore = MM.view().k;
fire(canvasEl, 'wheel', ev({ target: infoPanelEl, deltaY: -120, ctrl: true }));
eq(MM.view().k, kBefore, '在面板里滚轮不会缩放图谱');
fire(canvasEl, 'wheel', ev({ target: worldEl, deltaY: -120, ctrl: true }));
assert(MM.view().k !== kBefore, '对照：在画布上滚轮确实缩放');

/* ---- 14. 选中的纯文字节点不能"隐身" ----
   背景：--math-primary-foreground 是 #ffffff，只有 root/book/chapter 有底色板。
   节 / 栏目 / 知识点是纯文字，若沿用"选中 = 白字"，白底白字就整段看不见了。 */
function classesOf(id) {
  var parts = worldEl.innerHTML.split('data-id="' + id + '"');
  if (parts.length < 2) return null;
  var at = parts[0].lastIndexOf('class="');
  if (at < 0) return null;
  var end = parts[0].indexOf('"', at + 7);
  return parts[0].slice(at + 7, end);
}

MM.level.set(99);
var secNode = MM.visible().filter(function (n) { return n.kind === 'section'; })[0];
MM.select(secNode.id);
var secCls = classesOf(secNode.id);
assert(!!secCls, '选中的节节点确实进了渲染结果');
assert(secCls.indexOf('is-selected') >= 0, '节节点带着选中态');
assert(secCls.indexOf('is-text') >= 0, '节节点被标成纯文字节点（选中态要换一种画法）');

var chapNode2 = MM.visible().filter(function (n) { return n.kind === 'chapter'; })[0];
MM.select(chapNode2.id);
var chapCls = classesOf(chapNode2.id);
assert(!!chapCls && chapCls.indexOf('is-text') === -1, '有底色板的章节节点不该被标成纯文字');
MM.level.set(2);

/* ============================================================
   15. 分法切换：年级教材 / 几何代数
   ------------------------------------------------------------
   用户要的是"上面加个 tab，默认按年级教材分，还可以按几何代数分，
   点几何代数就出几个体系"。所以这里守三件事：
     a) 两栏名单各就各位，默认停在年级教材；
     b) 点一个体系 → 图里就以它为根，章是真的章（不是新造的节点）；
     c) 范围落在哪一栏，打开浮层就亮哪一栏（否则"我选的东西在看不见的那一栏里"）。
   ============================================================ */
MM.scope.set('');
MM.axis.set('book');

var FIELDS = MM.fields();          // 当前学段（此刻是初中）的课标领域
eq(FIELDS.length, 3, '初中数据里有三个课标领域（实际 ' + FIELDS.length + ' 个）');
eq(FIELDS.join(' / '), '图形与几何 / 数与代数 / 统计与概率', '体系顺序是几何在前（那一栏的名字就叫「几何代数」）');
eq(MM.fieldOf('平行四边形'), '图形与几何', '章带着自己的领域（平行四边形 → 图形与几何）');
eq(MM.fieldOf('有理数'), '数与代数', '数与代数那边也对得上');
eq(MM.fieldOf('概率初步'), '统计与概率', '统计与概率那三章也在（不然它们会掉出所有体系）');

/* 每一章都得有领域，且三个体系加起来正好是初中的全部 29 章 —— 不重不漏。
   **只看初中**：跨学段整树扫会把小学 / 高中的章一起算进来。 */
var allChapters = [], noField = [], byField = {};
MM.each(function (n) {
  if (n.kind !== 'chapter') return;
  if (!n.parent || n.parent.stage !== 'junior') return;
  allChapters.push(n.id);
  if (!n.field) noField.push(n.name);
  byField[n.field] = (byField[n.field] || 0) + 1;
});
eq(noField.length, 0, '初中的每一章都登记了领域（漏的：' + (noField.join('、') || '没有') + '）');
eq(allChapters.length, 29, '初中一共 29 章');
eq([byField['图形与几何'], byField['数与代数'], byField['统计与概率']].join('+'),
   '13+13+3', '三个体系的章数加起来正好是 29，不重不漏（实际 ' +
  [byField['图形与几何'], byField['数与代数'], byField['统计与概率']].join('+') + '）');

/* 默认停在"年级教材"那一栏 */
eq(MM.axis.get(), 'book', '默认分法是年级教材');
eq(bookPaneEl.hidden, false, '默认露出来的是册那一栏');
eq(fieldPaneEl.hidden, true, '体系那一栏默认收着');
eq(axisItems[0].getAttribute('aria-pressed'), 'true', '年级教材那一格是选中态');
eq(axisItems[0]._classes['is-on'], true, '选中态眼睛也看得见（is-on），不只是读屏知道');

/* 切到几何代数：只换名单，图不动 */
var nodesBefore = MM.visible().length;
fire(axisItems[1], 'click');
eq(MM.axis.get(), 'field', '点「几何代数」切到体系那一栏');
eq(fieldPaneEl.hidden, false, '体系那一栏露出来了');
eq(bookPaneEl.hidden, true, '册那一栏收起来了');
eq(MM.scope.get(), '', '切分法本身不动图 —— 范围还是总览');
eq(MM.visible().length, nodesBefore, '切分法前后图里的节点数一样（切的是名单，不是范围）');
eq(window.localStorage.getItem('wkmath.graph.axis'), 'field', '分法记在本机');

/* 点一个体系 → 它成为根 */
fire(MM.fieldItems()[1], 'click');       // 图形与几何
eq(MM.scope.get(), '图形与几何', '点「图形与几何」→ 只看这个体系');
eq(bookLabelEl.textContent, '几何', '工具条上写短名（图里仍用课标全称）');
var fScope = MM.rootScope();
eq(fScope.kind, 'field', '体系是一个"体系"节点，不是册（类型徽标才不会写错）');
eq(fScope.kids.length, 13, '图形与几何底下 13 章');
eq(fScope.kids.every(function (k) { return k.kind === 'chapter'; }), true, '底下的孩子都是真章');
eq(fScope.kids.every(function (k) { return k.field === '图形与几何'; }), true, '没有别的体系的章混进来');
eq(MM.visible()[0].name, '图形与几何', '图的第一列就是它');
eq(MM.visible().length, 1 + 13, '可见 = 体系 + 13 章（默认收起到章）');
assert(MM.visible().filter(function (n) { return n.kind === 'chapter'; })
  .every(function (n) { return ['七', '八', '九'].indexOf(n.name.charAt(0)) < 0; }),
  '章的节点上没有挂册名（说好保持干净）');

/* 章的短名 / 状态 */
eq(MM.shortOf('图形与几何'), '几何', '体系在名单与工具条上用短名');
eq(MM.shortOf(''), '总览', '空串仍是总览');
eq(MM.shortOf('八年级（上）'), '八上', '册的短名没被改动');
assert(bookBtnEl.getAttribute('data-mm-tip').indexOf('几何') >= 0,
  '工具条提示跟上当前体系（实际 ' + bookBtnEl.getAttribute('data-mm-tip') + '）');
assert(scopeNoteEl.textContent.indexOf('图形与几何') >= 0 && scopeNoteEl.textContent.indexOf('13') >= 0,
  '说明里写清"现在看的是图形与几何、共 13 章"（实际 ' + scopeNoteEl.textContent + '）');

/* 三个体系各点一遍：章数对得上，而且互不串台 */
[['图形与几何', 13], ['数与代数', 13], ['统计与概率', 3]].forEach(function (pair) {
  MM.scope.set(pair[0]);
  eq(MM.rootScope().kids.length, pair[1], pair[0] + ' 底下 ' + pair[1] + ' 章');
});
MM.scope.set('图形与几何');
eq(MM.visible()[0].name, '图形与几何', '切范围后根的显示名字也就位了');

/* 分法跟着范围走：范围是体系时，重新读一次存储也该落在体系那一栏 */
eq(MM.axis.get(), 'field', '范围是体系时，分法自动落在几何代数那一栏');
window.localStorage.setItem('wkmath.graph.scope', '数与代数');
eq(MM.axis.initial(), 'field', '刷新回来仍是体系那一栏（范围能说明是哪一栏）');
eq(MM.scope.initial(), '数与代数', '刷新回来范围也在');
window.localStorage.setItem('wkmath.graph.scope', '八年级（上）');
eq(MM.axis.initial(), 'book', '范围是册时，分法落在年级教材那一栏');
eq(MM.scope.initial(), '八年级（上）', '册也记得住');
window.localStorage.setItem('wkmath.graph.scope', '八年级（上）上');   // 认不出来的值
eq(MM.scope.initial(), '', '存了个认不出来的范围 → 当没存（否则工具条会写个假名字）');

/* 两个分法各有自己的"总览"，都指向同一个范围（互不干扰的选中态） */
MM.scope.set('');
MM.axis.set('field');
eq(MM.fieldItems()[0].getAttribute('aria-pressed'), 'true', '体系那一栏的"总览"亮着');
eq(MM.bookItems()[0].getAttribute('aria-pressed'), 'false',
  '册那一栏的"总览"不再亮（两栏各有各的选中态，不互相点亮）');
MM.scope.set('八年级（上）');
eq(MM.axis.get(), 'book', '选了册 → 分法自动切回年级教材那一栏');
eq(MM.bookItems()[3].getAttribute('aria-pressed'), 'true', '八上亮着');
eq(MM.fieldItems()[1].getAttribute('aria-pressed'), 'false', '体系那一栏没有被误点亮');

/* 定位：同体系的章不该把筛选清掉，别体系的章才清（这是合成根最容易漏的地方）
   注意挑章要限定在初中学段里 —— 全树扫会挑到小学那一章，跟当前的初中范围对不上。 */
MM.stage.set('junior');
MM.scope.set('图形与几何');
var inField = null, outField = null;
MM.each(function (n) {
  if (n.kind !== 'chapter') return;
  if (!n.parent || n.parent.stage !== 'junior') return;
  if (n.field === '图形与几何' && !inField) inField = n;
  if (n.field === '数与代数' && !outField) outField = n;
});
eq(MM.scopeContains(MM.rootScope(), inField), true, '同体系的章算"在范围内"（沿父链走不到合成根，靠孩子索引补上）');
eq(MM.scopeContains(MM.rootScope(), outField), false, '别体系的章算"在范围外"');
MM.locate(inField.id);
eq(MM.scope.get(), '图形与几何', '在范围内定位 → 筛选不动');
MM.locate(outField.id);
eq(MM.scope.get(), '', '定位到别体系的章才放开筛选（回总览，否则目标看不见）');

/* 收尾：回到默认（总览 + 年级教材），免得影响后面的检查 */
MM.scope.set('');
MM.axis.set('book');

/* ============================================================
   16. 画布背景是纯色，不是点阵
   ------------------------------------------------------------
   用户报的："图谱的背景应该是纯色，现在是带灰色的点"。
   点阵原来靠两处配合：CSS 里一条 radial-gradient，加 JS 每次平移缩放松一次
   backgroundSize / backgroundPosition（点阵跟着板走）。
   只删 CSS 不删 JS 的话，那两行会变成没人看见的死代码，下次有人照着它
   把点阵再加回来 —— 所以两边都要守。
   ============================================================ */
fire(canvasEl, 'wheel', ev({ target: worldEl, deltaY: -120, ctrl: true }));
assert(canvasEl.style.backgroundSize === undefined && canvasEl.style.backgroundPosition === undefined,
  '平移缩放不再去同步背景（点阵已删，这两行是死代码）' +
  '（实际 backgroundSize=' + canvasEl.style.backgroundSize + '）');
/* 样式那一半在 verify_graph.rb 里守着（静态读 graph.html），这里只管 JS 这一半 */

/* ============================================================
   17. 学段切换：小学 / 初中 / 高中 / 竞赛
   ------------------------------------------------------------
   学段是"册"上的一个字段，不是树上的一层；选中某个学段时用它当合成根。
   最要紧的三件事：名单整排换、分法跟着学段变、跨学段重名不串台。
   ============================================================ */
MM.stage.set('junior');
MM.scope.set('');
MM.axis.set('book');

eq(MM.stage.list().length, 4, '四个学段');
eq(MM.stage.keys.join(','), 'primary,junior,senior,olympiad', '学段标识与数据里的 stage 一致');

/* 切到高中：名单整排换、分法跟着换 */
MM.stage.set('senior');
eq(MM.stage.get(), 'senior', '切到高中');
eq(MM.scope.get(), '', '换学段时范围归零（上一学段的册名在这里不存在）');
eq(stageLabelEl.textContent, '高中', '学段按钮上的字跟着变');
eq(MM.bookItems().length, 1 + 5, '高中的册那一栏是"总览 + 五册"');
eq(MM.bookItems()[1].getAttribute('data-book'), '必修第一册', '第一册是必修第一册（人教A版按册，不按年级）');
eq(MM.axisTitle().book, '教材册次', '高中第一栏叫「教材册次」');
eq(MM.axisTitle().field, '课标主题', '高中第二栏叫「课标主题」');
eq(MM.fields().length, 5, '高中有五个课标主题');
eq(MM.fields()[0], '预备知识', '第一个是「预备知识」（选择性必修没有它，必修有）');
eq(MM.fieldItems().length, 1 + 5, '第二栏列出五个主题');
eq(MM.visible().length, 1 + 5 + 22, '高中默认可见：学段根 + 五册 + 22 章');

/* 章号挂册的短名：跨册之后光看 04 / 05 / 07 没法看 */
var seniorChapter = null;
MM.each(function (n) {
  if (!seniorChapter && n.kind === 'chapter' && n.parent && n.parent.stage === 'senior') seniorChapter = n;
});
assert(seniorChapter && MM.labelNo(seniorChapter).indexOf('必修一 ') === 0,
  '章号前面挂上册的短名（实际 ' + (seniorChapter ? MM.labelNo(seniorChapter) : '没找到章') + '）');

/* 切到竞赛：没有第二栏，切了会被拒 */
MM.stage.set('olympiad');
eq(MM.axisTitle().field, null, '竞赛没有第二栏');
eq(bookPaneEl.hidden, false, '竞赛只露板块那一栏');
eq(MM.axis.set('field'), false, '竞赛下切第二栏会被拒（setAxis 返回 false）');
eq(MM.axis.get(), 'book', '被拒之后仍停在第一栏');
eq(MM.bookItems().length, 1 + 4, '竞赛那一栏是"总览 + 四板块"');
eq(MM.bookItems()[1].getAttribute('data-book'), '代数', '第一个板块是代数');
eq(MM.stageBooksWord(), '板块', '竞赛里不说"册"，说"板块"');
eq(MM.visible().length, 1 + 4 + 30, '竞赛默认可见：学段根 + 四板块 + 30 章');

/* 小学：四个领域，12 册都进了名单，且名单里没有不该有的"待核" */
MM.stage.set('primary');
eq(MM.axisTitle().book, '教材册次', '小学第一栏叫「教材册次」');
eq(MM.axisTitle().field, '四大领域', '小学第二栏叫「四大领域」');
eq(MM.fields().length, 4, '小学有四个领域（多了「综合与实践」）');
eq(MM.bookItems().length, 1 + 12, '小学那一栏是"总览 + 12 册"');
/* 二下 / 三下的新版目录在 2026 秋核到了，册不再是空的 —— 所以名单里不该再挂「待核」。
   待核机制本身还在（写在章上就标在章上），反向守住"不许乱挂"。 */
var wrongPending = MM.bookItems().filter(function (el) {
  return String(el.innerHTML).indexOf('待核') >= 0;
});
eq(wrongPending.length, 0, '册名单里没有残留的「待核」（实际 ' + wrongPending.length + ' 个）');

/* 跨学段重名：小学和初中都有「数与代数」，不许串台 */
MM.scope.set('数与代数');
var pKids = MM.rootScope().kids;
assert(pKids.length > 0, '小学的「数与代数」有章（实际 ' + pKids.length + ' 章）');
eq(pKids.every(function (k) { return k.parent.stage === 'primary'; }), true,
  '小学的「数与代数」底下全是小学的章（同名领域按学段分开缓存，不串台）');
MM.stage.set('junior');
MM.scope.set('数与代数');
var jKids = MM.rootScope().kids;
eq(jKids.every(function (k) { return k.parent.stage === 'junior'; }), true, '切回初中取的是初中的「数与代数」');
eq(jKids.length, 13, '初中「数与代数」13 章（小学那边 35 章，数字不同就说明没串台）');

/* 学段也记在本机 */
MM.stage.set('senior');
eq(window.localStorage.getItem('wkmath.graph.stage'), 'senior', '换学段就记下来');
eq(MM.stage.initial(), 'senior', '刷新回来还是高中');
window.localStorage.setItem('wkmath.graph.stage', '乱写的');
eq(MM.stage.initial(), 'junior', '存了个认不出来的学段 → 回初中');

/* 收尾：回初中 */
MM.stage.set('junior');
MM.scope.set('');
MM.axis.set('book');

out('----');
out(__fail ? 'RESULT: 有失败项' : 'RESULT: 全部通过');
