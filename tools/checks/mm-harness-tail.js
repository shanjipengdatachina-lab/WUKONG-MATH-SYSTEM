/* ============================================================
   知识图谱自检 —— 断言（跑在 minmap.js 之后）
   ============================================================ */
var MM = window.__MM__;
var TREE = window.MATH_TREE;
function eq(a, b, label) { assert(String(a) === String(b), label + '（期望 ' + b + '，实际 ' + a + '）'); }
function has(text, part, label) { assert(String(text).indexOf(part) !== -1, label); }

assert(!!MM, '导出自查接口 window.__MM__');
assert(!!TREE && (TREE.kids || []).length === 6, '知识树有六册');
var chapters = 0;
TREE.kids.forEach(function (b) { chapters += (b.children || []).length; });
eq(chapters, 29, '一共 29 章');

/* ---- 1. 初始：未登录、没记过 → 总览 + 六册 + 各章 ---- */
eq(MM.scope.get(), '', '未登录时默认看总览，而不是某一册');
eq(bookLabelEl.textContent, '总览', '工具条上的册按钮写着"总览"');
eq(MM.level.get(), 2, '默认层级是"到章"');
eq(levelLabelEl.textContent, '到章', '层级按钮写着"到章"');
eq(MM.visible().length, 1 + 6 + chapters, '默认可见：总览 + 六册 + 29 章');
has(scopeNoteEl.textContent, '未登录', '说明里写清了未登录的规则');
eq(MM.signedIn(), false, '侧栏是"登录"时判定为未登录');
eq(MM.studentGrade(), '七年级（下）', '演示学生的年级是七年级（下）');
eq(MM.books.length, 6, '六册名单从数据里读出来');

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
fire(bookItems[3], 'click');
eq(MM.scope.get(), '八年级（上）', '点浮层里的"八年级（上）"就只看这一册');
eq(bookLabelEl.textContent, '八上', '按钮上的文字跟着变成八上');
eq(bookMenuEl.hasAttribute('hidden'), true, '选完自动收起浮层');
eq(bookItems[3].getAttribute('aria-pressed'), 'true', '当前册的选中状态对读屏可见');
eq(bookItems[3].classList.contains('is-on'), true, '当前册在浮层里真的高亮（is-on）');
eq(bookItems[0].getAttribute('aria-pressed'), 'false', '其它册的选中状态是未选中');
eq(bookItems[0].classList.contains('is-on'), false, '其它册没被误标高亮');
eq(window.localStorage.getItem('wkmath.graph.scope'), '八年级（上）', '选择记在本机');
assert(TOASTS.length > 0 && TOASTS[TOASTS.length - 1].indexOf('八年级（上）') !== -1, '选完给一句轻提示');
var bookVisible = MM.visible().length;
assert(bookVisible < 1 + 6 + chapters, '只看一册时节点数明显变少');
fire(bookItems[0], 'click');
eq(MM.scope.get(), '', '点"总览·六册"回到全部');

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
eq(panelNoEl.textContent, chapterNode.no, '标题栏显示章节编号');
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
assert(MM.visible().length > 1 + 6 + chapters, '展开到节后节点变多');
MM.level.set(99);
eq(levelLabelEl.textContent, '全部', '切到"全部展开"');
assert(MM.visible().length > 600, '全部展开后节点数上千级（实际 ' + MM.visible().length + '）');
MM.level.set(2);
eq(MM.visible().length, 1 + 6 + chapters, '收回"到章"后回到默认规模');

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

/* ---- 10. 定位跨册节点时自动放开筛选 ---- */
fire(bookItems[3], 'click');
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

out('----');
out(__fail ? '有失败项' : '图谱自检全部通过');
