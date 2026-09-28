/* ============================================================
   白板引擎自检 —— 断言
   ============================================================ */
var WB = window.__WB__;
assert(!!WB && !!WB.state, '引擎已初始化并暴露测试接口');
assert(WB.COLORS.length === 6, '配色 6 种');
assert(WB.WIDTHS.length === 3 && WB.ERASERS.length === 3, '笔粗与橡皮各 3 档');
assert(WB.state.tool === 'pen', '默认工具是画笔');
assert(WB.state.view.dpr === 2 && canvasEl.width === 2400, '按设备像素比放大画布（清晰不虚）');

/* ---------- 题库 ---------- */
var P = window.WB_PROBLEMS || [];
assert(P.length >= 40, '题库至少 40 题（实际 ' + P.length + ' 题）');
var ids = {}, dup = 0;
P.forEach(function (p) { if (ids[p.id]) dup++; ids[p.id] = 1; });
assert(dup === 0, '题目 id 无重复');
var books = {};
P.forEach(function (p) { books[p.book] = 1; });
assert(['七上', '七下', '八上', '八下', '九上', '九下'].every(function (b) { return books[b]; }), '六册都有题目');
assert(P.every(function (p) { return p.text && p.chapter && p.book; }), '每题都有题干、章、册');

/* ---------- 画笔：鼠标 / 数位板 / 手指 ---------- */
draw([[100, 100], [140, 130], [180, 120]]);
assert(WB.state.strokes.length === 1, '鼠标画一笔 → 笔迹 1 条');
assert(WB.state.actions.length === 1, '产生 1 个可撤销操作');
assert(WB.state.strokes[0].points.length === 3, '笔迹记录 3 个采样点');
assert(__ctxCalls.stroke > 0, '画布上确实落了笔');

WB.undo();
assert(WB.state.strokes.length === 0 && WB.state.redo.length === 1, '撤销：笔迹消失并进入重做栈');
WB.redo();
assert(WB.state.strokes.length === 1, '重做：笔迹回来');

draw([[300, 100], [320, 140]], { type: 'pen', pressure: 0.9 });
var penStroke = WB.state.strokes[WB.state.strokes.length - 1];
assert(penStroke.pressured === true, '数位板笔迹标记为带压感');
assert(WB.strokeWidthFor(penStroke, penStroke.points[0], penStroke.points[1]) > penStroke.width, '压感大 → 笔迹更粗');
assert(WB.strokeWidthFor(WB.state.strokes[0], { p: 0 }, { p: 0 }) === WB.state.strokes[0].width, '鼠标笔迹粗细恒定');

draw([[500, 200], [540, 240]], { type: 'touch' });
assert(WB.state.strokes.length === 3, '手指触控也能画（累计 3 笔）');

/* ---------- 橡皮：整笔擦除 ---------- */
var before = WB.state.strokes.slice();
WB.setEraser(26);
canvasEl._h.pointerdown(pe(110, 115));
canvasEl._h.pointerup(pe(110, 115));
assert(WB.state.strokes.length === 2, '橡皮擦掉被碰到的那一笔');
assert(WB.state.strokes.indexOf(before[0]) < 0, '被擦掉的正是第 1 笔');
WB.undo();
assert(WB.state.strokes.length === 3, '撤销擦除后笔迹恢复');
assert(WB.state.strokes[0] === before[0] && WB.state.strokes[1] === before[1] && WB.state.strokes[2] === before[2],
  '恢复后笔迹顺序与原来完全一致');

/* ---------- 命中判定 ---------- */
var seg = { color: '#000', width: 4, points: [{ x: 0, y: 0 }, { x: 100, y: 0 }] };
assert(WB.strokeHit(seg, 50, 3, 6) === true, '命中判定：线段附近算命中');
assert(WB.strokeHit(seg, 50, 60, 6) === false, '命中判定：远离不算命中');
assert(WB.strokeHit(seg, 104, 0, 4) === true, '命中判定：端点附近算命中');

/* ---------- 清空 ---------- */
WB.clearAll();
assert(WB.state.strokes.length === 0, '清空后画布为空');
WB.undo();
assert(WB.state.strokes.length === 3, '清空可以撤销');

/* ---------- 工具与颜色 ---------- */
WB.setColor('#dc2626');
assert(WB.state.color === '#dc2626' && WB.state.tool === 'pen', '选颜色后自动切回画笔');
WB.setWidth(6);
assert(WB.state.width === 6, '切换笔粗生效');
WB.setGrid(true);
assert(WB.state.grid === true, '网格开关生效');
draw([[600, 300], [640, 340]]);
assert(WB.state.strokes[WB.state.strokes.length - 1].color === '#dc2626', '新笔迹使用当前颜色');
assert(WB.state.strokes[WB.state.strokes.length - 1].width === 6, '新笔迹使用当前粗细');
WB.setTool('eraser');
assert(WB.state.tool === 'eraser', '可切到橡皮');

/* ---------- 题目一键上板 ---------- */
var first = P[0];
WB.pickProblem(first.id);
assert(WB.state.problemId === first.id, '点选题目 → 上板');
assert(document.getElementById('wb-problem-text').textContent === first.text, '题面文字写入黑板');
assert(document.getElementById('wb-problem').hidden === false, '题面卡片显示');
assert(document.getElementById('wb-bank-count').textContent.indexOf('题') > 0, '题库计数已刷新');
WB.clearAll();
assert(!!WB.cardData(), '清空画布不影响题面');
WB.pickProblem(first.id);
assert(WB.state.problemId === null && WB.cardData() === null, '再点一次收起题面');

/* ---------- 题面直接画在板上（不是上方的卡片） ---------- */
WB.applyExternal({ text: '(−2) × (−5)', tag: '考点速练 · 考点 1', extra: '' });
__ctxCalls.fillText = 0;
__ctxCalls.texts = [];
WB.setShowProblem(true);
assert(__ctxCalls.fillText > 0, '题面直接画在白板画布上');
assert(__ctxCalls.texts.join('|').indexOf('(−2) × (−5)') >= 0, '画到板上的正是题面文字');
__ctxCalls.fillText = 0;
__ctxCalls.texts = [];
WB.setShowProblem(false);
assert(__ctxCalls.fillText === 0, '隐藏题面后画布不再画题面');
assert(WB.state.showProblem === false, '题面显隐状态记录正确');
assert(document.getElementById('wb-problem-toggle').getAttribute('aria-pressed') === 'false', '题面按钮同步为未按');
WB.setShowProblem(true);
assert(__ctxCalls.fillText > 0, '恢复显示题面');

/* ---------- 悬浮设置面板 ---------- */
WB.setPopover(true);
assert(WB.popoverOpen() === true, '设置面板可以浮出');
assert(document.getElementById('wb-pop').hidden === false, '面板元素可见');
assert(document.getElementById('wb-settings').getAttribute('aria-expanded') === 'true', '设置按钮状态同步');
WB.setPopover(false);
assert(WB.popoverOpen() === false && document.getElementById('wb-pop').hidden === true, '设置面板可以收起');

/* ---------- 悬浮题库面板：工具条按钮开关 + 可拖动 ---------- */
assert(bankPanelEl.hidden === true, '题库面板默认收着，不占画板空间');
assert(typeof WB.setBank === 'function' && typeof WB.bankOpen === 'function', '题库面板开关接口就绪');
assert(document.getElementById('wb-bank-toggle').getAttribute('aria-controls') === 'wb-bank', '工具条按钮指向题库面板');
assert(document.getElementById('wb-bank-head') !== null, '面板顶部有可抓的标题栏');
assert(document.getElementById('wb-bank-close').getAttribute('aria-label') === '关闭题库', '面板带关闭按钮');

document.getElementById('wb-bank-toggle')._h.click(pe(0, 0));
assert(WB.bankOpen() === true, '点工具条里的题库按钮，面板浮出来');
assert(bankPanelEl.hidden === false, '面板元素可见');
assert(bankPanelEl.getAttribute('hidden') === null, 'hidden 属性已摘掉');
assert(document.getElementById('wb-bank-toggle').getAttribute('aria-pressed') === 'true', '按钮状态同步为已按下');

document.getElementById('wb-bank-toggle')._h.click(pe(0, 0));
assert(WB.bankOpen() === false, '再点一次收回面板');
assert(document.getElementById('wb-bank-toggle').getAttribute('aria-pressed') === 'false', '按钮状态同步为未按');

WB.setBank(true);
document.getElementById('wb-bank-close')._h.click(pe(0, 0));
assert(WB.bankOpen() === false, '关闭按钮也能收起面板');

/* 拖动：按住标题栏就能把面板挪走 */
WB.setBank(true);
var pos0 = WB.panelPos(bankPanelEl);
assert(pos0.x === 20 && pos0.y === 40, '未拖动时停在默认落脚点（20,40）');
var bankHead = document.getElementById('wb-bank-head');
bankHead._h.pointerdown(pe(100, 200, { id: 7 }));
assert(bankPanelEl.style.left === '20px' && bankPanelEl.style.top === '40px', '按下标题栏后位置转成行内坐标');
assert(bankPanelEl.style.bottom === 'auto', '改用 left/top 定位后清掉 bottom');
assert(bankPanelEl._classes['is-dragging'] === true, '拖动中给出抓取态');
bankHead._h.pointermove(pe(160, 260, { id: 7 }));
assert(bankPanelEl.style.left === '80px' && bankPanelEl.style.top === '100px', '指针走 60px，面板跟着走 60px');
assert(bankPanelEl.style.bottom === 'auto', '拖动过程中不会被 bottom 拉回去');
bankHead._h.pointerup(pe(160, 260, { id: 7 }));
assert(bankPanelEl._classes['is-dragging'] === undefined, '松手后退出抓取态');
assert(bankPanelEl.style.left === '80px', '松手后停在原地');

/* 不能拖出画板 */
bankHead._h.pointerdown(pe(0, 0, { id: 8 }));
bankHead._h.pointermove(pe(9999, 9999, { id: 8 }));
assert(bankPanelEl.style.left === '892px' && bankPanelEl.style.top === '432px', '右下角被挡在画板边缘');
bankHead._h.pointerup(pe(9999, 9999, { id: 8 }));
bankHead._h.pointerdown(pe(900, 500, { id: 9 }));
bankHead._h.pointermove(pe(0, 0, { id: 9 }));
assert(bankPanelEl.style.left === '8px' && bankPanelEl.style.top === '8px', '左上角被挡在画板边缘');
bankHead._h.pointerup(pe(0, 0, { id: 9 }));

/* 画板变窄（切全屏 / 转屏）时面板自动收回可视范围 */
bankHead._h.pointerdown(pe(1000, 400, { id: 12 }));
bankHead._h.pointermove(pe(1500, 500, { id: 12 }));
bankHead._h.pointerup(pe(1500, 500, { id: 12 }));
assert(parseFloat(bankPanelEl.style.left) === 508, '先拖到右边（508px）');
var ow = wrapEl.clientWidth, oh = wrapEl.clientHeight;
wrapEl.clientWidth = 420; wrapEl.clientHeight = 360;
WB.resize();
assert(parseFloat(bankPanelEl.style.left) === 112, '画板变窄后面板被拉回 112px');
assert(parseFloat(bankPanelEl.style.top) === 92, '纵向同样被拉回 92px');
wrapEl.clientWidth = ow; wrapEl.clientHeight = oh;
WB.resize();
assert(parseFloat(bankPanelEl.style.left) === 112, '画板恢复变宽后位置不再乱跳');

/* 点关闭按钮不该被当成拖拽 */
var dragBefore = bankPanelEl.style.left;
bankHead._h.pointerdown(pe(300, 300, { id: 11, target: { closest: function (s) { return s === '.wb-bank__close' ? {} : null; } } }));
bankHead._h.pointermove(pe(400, 400, { id: 11 }));
assert(bankPanelEl.style.left === dragBefore, '按在关闭按钮上不会拖动整块面板');
bankHead._h.pointerup(pe(400, 400, { id: 11 }));

/* 面板里选完题，面板保持打开，题面立刻上板 */
WB.setBank(true);
WB.pickProblem(P[1].id);
assert(WB.bankOpen() === true, '从面板选题后，面板不自动消失（方便连着挑）');
assert(WB.state.problemId === P[1].id, '选中的题目已经上板');
WB.setBank(false);

/* ---------- 工具条分组（仿 PS：同类工具合成一个格子，点开再选） ---------- */
WB.setTool('pen');
assert(typeof WB.groupOf === 'function' && typeof WB.setFlyout === 'function', '工具分组接口就绪');
assert(WB.groupOf('pen') === 'draw' && WB.groupOf('eraser') === 'draw', '画笔 / 荧光笔 / 橡皮 归为画笔组');
assert(WB.groupOf('line') === 'shape' && WB.groupOf('ellipse') === 'shape', '直线 / 箭头 / 矩形 / 椭圆 归为图形组');
assert(WB.groupOf('undo') === null && WB.groupOf('grid') === null, '撤销 / 网格这类动作按钮不占工具组');
assert(WB.groupSlot('draw') === 'pen', '画笔组格子显示画笔');
assert(WB.groupSlot('shape') === 'line', '图形组格子显示它上次用的直线');
assert(document.getElementById('wb-group-draw').getAttribute('data-active') === 'pen', '格子图标跟随当前工具');
assert(document.getElementById('wb-group-draw')._classes['is-on'] === true, '当前所在的组高亮');
assert(document.getElementById('wb-group-shape')._classes['is-on'] === undefined, '另一组不高亮');

WB.setTool('rect');
assert(WB.groupSlot('shape') === 'rect', '选中矩形后，图形组格子改显示矩形');
assert(WB.groupSlot('draw') === 'pen', '另一组照旧显示画笔（互不影响）');
assert(document.getElementById('wb-group-shape').getAttribute('data-active') === 'rect', '图形组格子已刷新');
assert(document.getElementById('wb-group-shape')._classes['is-on'] === true, '高亮跟着切到图形组');
assert(document.getElementById('wb-group-draw')._classes['is-on'] === undefined, '画笔组取消高亮');

WB.setTool('highlighter');
assert(WB.groupSlot('draw') === 'highlighter' && WB.groupSlot('shape') === 'rect', '两组各自记住上次用的工具');

/* 点开 / 收起浮层 */
assert(WB.flyoutGroup() === null, '默认没有展开的工具组');
document.getElementById('wb-group-draw')._h.click(pe(0, 0));
assert(WB.flyoutGroup() === 'draw' && document.getElementById('wb-flyout-draw').hidden === false, '点画笔组格子，浮层展开');
assert(document.getElementById('wb-group-draw').getAttribute('aria-expanded') === 'true', '按钮状态同步为已展开');
document.getElementById('wb-group-shape')._h.click(pe(0, 0));
assert(WB.flyoutGroup() === 'shape', '点另一组时，前一组浮层自动收起');
assert(document.getElementById('wb-flyout-draw').hidden === true &&
  document.getElementById('wb-flyout-shape').hidden === false, '两块浮层此消彼长，不会同时开着');
document.getElementById('wb-group-shape')._h.click(pe(0, 0));
assert(WB.flyoutGroup() === null, '再点同一组就收起');

/* 从浮层里选工具：选完浮层收起、格子换成它 */
document.getElementById('wb-group-draw')._h.click(pe(0, 0));
document.getElementById('wb-pen')._h.click(pe(0, 0));
assert(WB.state.tool === 'pen', '从浮层里点画笔就切到画笔');
assert(WB.flyoutGroup() === null, '选完自动收起浮层');
assert(document.getElementById('wb-group-draw').getAttribute('data-active') === 'pen', '格子随之显示画笔');
assert(document.getElementById('wb-pen').getAttribute('aria-pressed') === 'true', '浮层里当前工具高亮');
assert(document.getElementById('wb-line').getAttribute('aria-pressed') === 'false', '浮层里其它工具不高亮');
assert(WB.state.groupLast.draw === 'pen' && WB.state.groupLast.shape === 'rect', '每组"上次用的"存进状态');

/* 开设置面板时，工具浮层让位 */
WB.setFlyout('shape');
WB.setPopover(true);
assert(WB.flyoutGroup() === null && WB.popoverOpen() === true, '打开设置面板会自动收起工具浮层');
WB.setPopover(false);

/* 快捷键依旧直达，格子同步 */
var groupKeydown = __capture.docHandlers.keydown;
groupKeydown(pe(0, 0, { key: 'o' }));
assert(WB.state.tool === 'ellipse', '按 O 直达椭圆，不必先点开组');
assert(document.getElementById('wb-group-shape').getAttribute('data-active') === 'ellipse', '格子图标同步换成椭圆');

/* 点空白处 / Esc 收起浮层 */
WB.setFlyout('shape');
assert(WB.flyoutGroup() === 'shape', '浮层可以再次展开');
__capture.docHandlers.click(pe(0, 0, { target: { closest: function () { return null; } } }));
assert(WB.flyoutGroup() === null, '点画布空白处收起工具浮层');
assert(WB.popoverOpen() === false, '点画布空白处同样收起设置面板');
WB.setFlyout('draw');
groupKeydown(pe(0, 0, { key: 'Escape' }));
assert(WB.flyoutGroup() === null, 'Esc 收起工具浮层');
WB.setTool('pen');

/* ---------- 全屏：按钮已并入侧栏，白板只负责切换后重排画布 ---------- */
var fsHandler = __capture.docHandlers.fullscreenchange;
assert(typeof fsHandler === 'function', '监听了全屏切换（全屏后画布要重排）');
assert(typeof WB.toggleFull === 'undefined', '白板不再自己管全屏（全屏按钮已挪到侧栏）');
assert(typeof WB.setFocus === 'undefined', '专注模式那套已移除');
var wideW = wrapEl.clientWidth;
wrapEl.clientWidth = 1440;
fsHandler();
assert(canvasEl.width === 1440 * 2, '全屏后画布按新尺寸重排');
wrapEl.clientWidth = wideW;
fsHandler();
assert(canvasEl.width === wideW * 2, '退出全屏后画布跟着收回');

/* ---------- 悬浮提示：自绘气泡（data-wb-tip），不再用系统 title ---------- */
assert(document.getElementById('wb-widths').innerHTML.indexOf('data-wb-tip') >= 0, '笔粗按钮用自绘提示');
assert(document.getElementById('wb-widths').innerHTML.indexOf('title="') < 0, '笔粗按钮不再挂系统 title');
assert(document.getElementById('wb-erasers').innerHTML.indexOf('data-wb-tip') >= 0, '橡皮按钮用自绘提示');
assert(document.getElementById('wb-erasers').innerHTML.indexOf('title="') < 0, '橡皮按钮不再挂系统 title');

/* ---------- 工具条精简：撤销/重做按可用性置灰 ---------- */
WB.clearAll();
WB.undo();
WB.undo();
assert(document.getElementById('wb-undo').disabled === true || WB.state.actions.length > 0, '撤销按钮状态随操作栈更新');
assert(typeof WB.drawProblemLayer === 'function', '题面层绘制函数已暴露（供自检）');

/* ---------- 无限画布：缩放与平移 ---------- */
assert(WB.state.view.scale === 1, '默认是 100%');
var origin = WB.toWorld(16, 16);
assert(Math.abs(origin.x) < 0.01 && Math.abs(origin.y) < 0.01, '世界原点与视图偏移对齐');
WB.zoomAt(300, 200, 2);
assert(Math.abs(WB.state.view.scale - 2) < 1e-6, '可以放大到 200%');
var fixed = WB.toWorld(300, 200);
assert(Math.abs(fixed.x - (300 - 16)) < 0.01, '缩放锚点固定在光标处（该点世界坐标不变）');
WB.resetZoom();
assert(Math.abs(WB.state.view.scale - 1) < 1e-6, '一键回到 100%');
WB.zoomBy(1 / 1.2);
assert(WB.state.view.scale < 1, '可以缩小');
for (var zi = 0; zi < 40; zi++) WB.zoomBy(1 / 2);
assert(WB.state.view.scale >= 0.15 - 1e-6, '缩放下限生效（不会缩到看不见）');
for (var zo = 0; zo < 60; zo++) WB.zoomBy(2);
assert(WB.state.view.scale <= 8 + 1e-6, '缩放上限生效');
WB.resetZoom();

var vy0 = WB.state.view.y;
WB.onWheel(pe(200, 200, { deltaY: 120 }));
assert(WB.state.view.y === vy0 - 120, '普通滚轮平移画布（纵向）');
var sc0 = WB.state.view.scale;
WB.onWheel(pe(200, 200, { deltaY: -120, meta: true }));
assert(WB.state.view.scale > sc0, '⌘ / Ctrl + 滚轮缩放画布');
assert(isFinite(WB.state.view.x) && isFinite(WB.state.view.y) && isFinite(WB.state.view.scale), '视图参数始终是有效数字');
WB.resetZoom();
WB.fitContent();
assert(WB.state.view.scale > 0 && WB.state.view.scale <= 8, '适应内容可用');

WB.onDown(pe(100, 100, { button: 1 }));
assert(!!WB.state.active && WB.state.active.mode === 'pan', '中键拖拽进入平移模式');
WB.onMove(pe(160, 140, { button: 1 }));
assert(WB.state.view.x !== 16 || WB.state.view.y !== 16, '拖拽改变了视图偏移');
WB.onUp(pe(160, 140, { button: 1 }));
assert(WB.state.active === null, '松开结束平移');

/* ---------- 箭头与标记 ---------- */
WB.setTool('line');
WB.onDown(pe(200, 200));
WB.onMove(pe(300, 240));
WB.onUp(pe(300, 240));
var lineStroke = WB.state.strokes[WB.state.strokes.length - 1];
assert(lineStroke.type === 'line' && lineStroke.points.length === 2, '直线工具：两点成线');
WB.setTool('arrow');
WB.onDown(pe(200, 260));
WB.onMove(pe(320, 260));
WB.onUp(pe(320, 260));
assert(WB.state.strokes[WB.state.strokes.length - 1].type === 'arrow', '箭头工具生效');
WB.onDown(pe(200, 300));
WB.onUp(pe(200, 300));
assert(WB.state.strokes[WB.state.strokes.length - 1].type === 'arrow', '只点一下不拖拽不会留下空图形');
WB.setTool('rect');
WB.onDown(pe(360, 200));
WB.onMove(pe(460, 280));
WB.onUp(pe(460, 280));
assert(WB.state.strokes[WB.state.strokes.length - 1].type === 'rect', '矩形工具生效');
WB.setTool('ellipse');
WB.onDown(pe(500, 200));
WB.onMove(pe(600, 280));
WB.onUp(pe(600, 280));
assert(WB.state.strokes[WB.state.strokes.length - 1].type === 'ellipse', '椭圆工具生效');

WB.setTool('line');
WB.onDown(pe(200, 320));
WB.onMove(pe(300, 332, { shift: true }));
WB.onUp(pe(300, 332, { shift: true }));
var ortho = WB.state.strokes[WB.state.strokes.length - 1];
assert(Math.abs(ortho.points[1].y - ortho.points[0].y) < 0.01, '按住 Shift 锁定为水平直线');

var na = WB.state.actions.length;
WB.undo();
assert(WB.state.actions.length === na - 1, '图形同样可以撤销');
WB.redo();
assert(WB.state.actions.length === na, '图形同样可以重做');

var rectHit = { type: 'rect', width: 3, color: '#000', points: [{ x: 0, y: 0 }, { x: 100, y: 60 }] };
assert(WB.strokeHit(rectHit, 50, 0, 4) === true, '矩形边框可被橡皮命中');
assert(WB.strokeHit(rectHit, 50, 30, 4) === false, '矩形内部不算命中');
var ellHit = { type: 'ellipse', width: 3, color: '#000', points: [{ x: 0, y: 0 }, { x: 100, y: 100 }] };
assert(WB.strokeHit(ellHit, 50, 0, 6) === true, '椭圆边框可被命中');
assert(WB.strokeHit(ellHit, 50, 50, 6) === false, '椭圆中心不算命中');
var arrowHit = { type: 'arrow', width: 3, color: '#000', points: [{ x: 0, y: 0 }, { x: 100, y: 0 }] };
assert(WB.strokeHit(arrowHit, 50, 2, 4) === true, '箭头线段可被命中');

WB.setTool('highlighter');
WB.onDown(pe(700, 200));
WB.onMove(pe(760, 220));
WB.onUp(pe(760, 220));
var hl = WB.state.strokes[WB.state.strokes.length - 1];
assert(hl.highlight === true, '荧光标记写入 highlight 标识');
assert(hl.width >= 12, '荧光标记笔宽更粗');
assert(hl.pressured === false, '荧光标记不跟随压感');
WB.setTool('pen');
assert(WB.state.tool === 'pen', '可切回画笔');

/* ---------- 筛选与搜索 ---------- */
WB.bank.book = '九上';
WB.renderBank();
var bankHtml = document.getElementById('wb-bank-list').innerHTML;
assert(bankHtml.indexOf('九上') >= 0 && bankHtml.indexOf('七上') < 0, '按册筛选生效');
WB.bank.book = '全部';
WB.bank.q = '因式分解';
WB.renderBank();
assert(document.getElementById('wb-bank-list').innerHTML.indexOf('因式分解') >= 0, '关键词搜索生效');
assert(document.getElementById('wb-bank-list').innerHTML.indexOf('有理数') < 0, '搜索会过滤掉无关题目');
WB.bank.book = '全部';
WB.bank.q = '';
WB.renderBank();

/* ---------- 本地记忆 ---------- */
var stored = JSON.parse(window.localStorage.getItem('wkmath.whiteboard.v1'));
assert(stored.grid === true, '偏好写入本地存储');
assert(stored.strokes.length === WB.state.strokes.length, '笔迹一并写入本地存储');
assert(stored.color === '#dc2626' && stored.width === 6, '颜色与粗细也记住了');

var snapshot = WB.state.strokes.length;
WB.state.strokes.length = 0;
WB.state.grid = false;
WB.restore();
assert(WB.state.strokes.length === snapshot && WB.state.grid === true, '刷新后能恢复笔迹与偏好');

/* ---------- 键盘快捷键 ---------- */
var keydown = __capture.docHandlers.keydown;
assert(typeof keydown === 'function', '已绑定键盘快捷键');
keydown(pe(0, 0, { key: 'b' }));
assert(WB.state.tool === 'pen', '按 B 切画笔');
keydown(pe(0, 0, { key: 'e' }));
assert(WB.state.tool === 'eraser', '按 E 切橡皮');
keydown(pe(0, 0, { key: '2' }));
assert(WB.state.color === WB.COLORS[1].value, '按数字键换颜色');
var n1 = WB.state.actions.length;
keydown(pe(0, 0, { key: 'z', meta: true }));
assert(WB.state.actions.length === n1 - 1, '⌘Z 触发撤销');
var n2 = WB.state.actions.length;
keydown(pe(0, 0, { key: 'z', meta: true, shift: true }));
assert(WB.state.actions.length === n2 + 1, '⇧⌘Z 触发重做');

/* ⌘/Ctrl + B 开合题库面板；Esc 收面板 */
var toolBefore = WB.state.tool;
keydown(pe(0, 0, { key: 'b', meta: true }));
assert(WB.bankOpen() === true, '⌘/Ctrl + B 唤出题库面板');
assert(WB.state.tool === toolBefore, '⌘B 只开面板，不顺手切画笔');
keydown(pe(0, 0, { key: 'b', meta: true }));
assert(WB.bankOpen() === false, '⌘/Ctrl + B 是开合开关');
keydown(pe(0, 0, { key: 'b', meta: true }));
WB.setPopover(true);
keydown(pe(0, 0, { key: 'Escape' }));
assert(WB.bankOpen() === false && WB.popoverOpen() === false, 'Esc 把悬浮面板一并收起');
keydown(pe(0, 0, { key: 'b' }));
assert(WB.state.tool === 'pen', '不按 ⌘ 的 B 仍然是切画笔');

/* ---------- 外部送来内容（其它页面的「白板」按钮） ---------- */
WB.applyExternal({ text: '(−2) × (−5)', tag: '考点速练 · 考点 1 整式的概念', extra: 'A. x + 1；B. 3a²b' });
assert(!!WB.state.external && WB.state.external.text === '(−2) × (−5)', '外部内容进入题面卡片');
assert(document.getElementById('wb-problem-text').textContent === '(−2) × (−5)', '题面文字写入黑板');
assert(document.getElementById('wb-problem-meta').textContent.indexOf('考点速练') >= 0, '来源标签写入黑板');
assert(document.getElementById('wb-problem-extra').textContent.indexOf('3a²b') >= 0, '补充信息（选项）写入黑板');
assert(!!WB.cardData(), '题面数据已就位');
assert(document.getElementById('wb-problem-toggle').disabled === false, '题面按钮可用');
assert(WB.state.problemId === null, '外部内容与题库选题互斥');
var stored2 = JSON.parse(window.localStorage.getItem('wkmath.whiteboard.v1'));
assert(!!stored2.external && stored2.external.text === '(−2) × (−5)', '外部内容写入本地存储');
WB.state.external = null;
WB.restore();
assert(!!WB.state.external && WB.state.external.text === '(−2) × (−5)', '刷新后外部内容仍能恢复');
WB.applyProblem(P[1].id);
assert(WB.state.external === null && WB.state.problemId === P[1].id, '从题库选题会覆盖外部内容');
WB.pickProblem(P[1].id);
assert(WB.state.problemId === null, '再点一次收起题面');

/* ---------- 地址栏参数解析 ---------- */
window.location = {
  search: '?t=' + encodeURIComponent('3x + 5 = 11') +
    '&g=' + encodeURIComponent('七上 · 一元一次方程') +
    '&x=' + encodeURIComponent('提示：先移项')
};
var q = WB.readQuery();
assert(q.t === '3x + 5 = 11', '解析地址栏题目参数');
assert(q.g === '七上 · 一元一次方程', '解析地址栏来源参数（中文正确解码）');
assert(q.x === '提示：先移项', '解析地址栏补充参数');
window.location = { search: '' };
assert(Object.keys(WB.readQuery()).length === 0, '无参数时返回空对象');

/* ---------- 回到知识点：把题面来源带进图谱 ---------- */
function eq2(a, b, label) { assert(String(a) === String(b), label + '（期望 ' + b + '，实际 ' + a + '）'); }

assert(WB.kpKeyword({ tag: '七上 · 有理数' }) === '有理数', '「册 · 章」只取章名');
assert(WB.kpKeyword({ tag: '七上 · 第二章 整式的加减' }) === '整式的加减', '去掉「第 N 章」前缀');
assert(WB.kpKeyword({ tag: '考点速练 · 考点 1 整式的概念' }) === '整式的概念', '去掉「考点 N」前缀');
assert(WB.kpKeyword({ tag: '' }) === '' && WB.kpKeyword(null) === '', '没有来源时不瞎猜');

window.location = { search: '', href: '' };
WB.applyExternal({ text: '(−2) × (−5)', tag: '七上 · 有理数' });
eq2(document.getElementById('wb-jump-kp').getAttribute('data-wb-tip'), '回到知识点 · 有理数',
  '按钮提示带上当前知识点');
eq2(WB.kpTargetUrl(WB.cardData()), 'graph.html?q=' + encodeURIComponent('有理数'),
  '目标地址把知识点编码进参数');
eq2(WB.jumpToKp(), 'graph.html?q=' + encodeURIComponent('有理数'), '点一下返回跳转地址');
eq2(window.location.href, 'graph.html?q=' + encodeURIComponent('有理数'), '真的跳到图谱对应条目');

WB.applyProblem(P[1].id);
assert(WB.kpTargetUrl(WB.cardData()).indexOf('graph.html?q=') === 0, '从题库选题同样能回到知识点');
WB.applyProblem(null);
eq2(WB.kpTargetUrl(WB.cardData()), 'graph.html', '板上没有题面时退回图谱首页');
eq2(document.getElementById('wb-jump-kp').getAttribute('data-wb-tip'), '回到知识点', '没有来源时提示回到默认文案');

/* ============================================================
   7. 题面底纹：去掉边框、宽度随内容自适应
   ============================================================ */
function strokeDelta(fn) {
  var before = __ctxCalls.stroke;
  fn();
  return __ctxCalls.stroke - before;
}

WB.applyProblem('7a-01');            /* −7 + 3：很短的题 */
var shortBox = WB.problemLayout();
WB.applyProblem('7b-01');            /* 两条直线相交……：很长的题 */
var longBox = WB.problemLayout();

assert(shortBox.w > 0 && shortBox.h > 0,
  '题面算出了矩形（' + shortBox.w + ' × ' + shortBox.h + '）');
assert(longBox.w > shortBox.w,
  '宽度随内容自适应：长题比短题宽（' + shortBox.w + ' → ' + longBox.w + '）');
assert(shortBox.w < 720, '短题不顶满上限（实际 ' + shortBox.w + '）');
assert(longBox.w <= 720, '宽度不超过上限 720（实际 ' + longBox.w + '）');

var shown = strokeDelta(function () { WB.setShowProblem(true); WB.redraw(); });
var hiddenStroke = strokeDelta(function () { WB.setShowProblem(false); WB.redraw(); });
assert(shown === hiddenStroke,
  '题面不再画边框（显示 / 隐藏的描边增量应相同，实际 ' + shown + ' / ' + hiddenStroke + '）');

WB.setShowProblem(true);

/* 7b. 那层很浅的底只在鼠标压上来时浮现 —— 平时题面就是印在板上的一段字 */
WB.clearAll();
WB.applyProblem('7a-01');

function fillDelta(fn) {
  var before = __ctxCalls.fill;
  fn();
  return __ctxCalls.fill - before;
}

WB.setProblemHover(false);
var idleFills = fillDelta(function () { WB.redraw(); });
WB.setProblemHover(true);
var hoverFills = fillDelta(function () { WB.redraw(); });
WB.setProblemHover(false);

assert(idleFills === 0, '未悬停时题面不画底（填充增量应为 0，实际 ' + idleFills + '）');
assert(hoverFills === 4,
  '悬停时浮现底 + 竖条 + 把手的两道短横（填充增量应为 4，实际 ' + hoverFills + '）');

/* 命中判定：悬停和（后面的）拖动共用同一个谓词 */
var hovBox = WB.problemLayout();
assert(WB.hitProblem(hovBox.x + 10, hovBox.y + 10) === true, '题面里的点算命中');
assert(WB.hitProblem(hovBox.x - 10, hovBox.y - 10) === false, '题面外的点不算命中');

/* 走一遍真实的 pointermove：移进题面 → 底浮现；移开 → 收起 */
var hv = WB.state.view;
function screenOf(wx, wy) { return { x: hv.x + wx * hv.scale, y: hv.y + wy * hv.scale }; }
var inPt = screenOf(hovBox.x + 20, hovBox.y + 20);
var outPt = screenOf(hovBox.x + hovBox.w + 300, hovBox.y + hovBox.h + 300);
canvasEl._h.pointermove(pe(inPt.x, inPt.y));
assert(WB.state.problemHover === true, '鼠标移进题面 → 底浮现');
canvasEl._h.pointermove(pe(outPt.x, outPt.y));
assert(WB.state.problemHover === false, '鼠标移开题面 → 底收起');

/* 7c. 坐标坏掉的事件不能混进点列 —— 用户报过"从板子最左边多射出一条长线" */
WB.clearAll();
WB.applyProblem(null);
var badBefore = WB.badPoints();
var v7c = WB.state.view;
var ax7c = v7c.x + 300 * v7c.scale, ay7c = v7c.y + 200 * v7c.scale;

canvasEl._h.pointerdown(pe(ax7c, ay7c));
canvasEl._h.pointermove(pe(0, 0));                 /* 坐标坏掉的中间点 */
canvasEl._h.pointermove(pe(ax7c + 40, ay7c + 30));
canvasEl._h.pointerup(pe(ax7c + 40, ay7c + 30));

var st7c = WB.state.strokes[WB.state.strokes.length - 1];
var minX7c = Math.min.apply(null, st7c.points.map(function (p) { return p.x; }));
assert(st7c.points.length === 2,
  '坏点被丢掉，只剩落笔 + 一个好转折（实际 ' + st7c.points.length + ' 个点）');
assert(minX7c > 0, '笔迹没有跑到板子左边去（最左 ' + Math.round(minX7c) + '）');
assert(WB.badPoints() === badBefore + 1,
  '坏点被记了一次（实际 ' + (WB.badPoints() - badBefore) + ' 次）');

/* ============================================================
   8. 题面可拖动：抓住左侧把手把它挪走 —— 不落笔、不带动板面
   ============================================================ */
WB.setTool('pen');
WB.clearAll();
WB.applyProblem('8a-01');
/* 每次从同一个位置起测：题面位置在会话内是活的，不能依赖上一组留下的状态 */
WB.state.problemAt.x = 16;
WB.state.problemAt.y = 16;
WB.redraw();

var box0 = WB.problemLayout();
var v0 = WB.view();
var strokes0 = WB.strokes().length;
var actions0 = WB.state.actions.length;

/* 世界点 → 屏幕点：sx = v.x + wx * scale。视图会被前面的用例改过，所以每次都现算 */
function screenNow(wx, wy) {
  var v = WB.view();
  return { x: v.x + wx * v.scale, y: v.y + wy * v.scale };
}

/* 把手只占左侧那条无字处；正文必须留着能落笔（学生要在题目上圈已知条件） */
assert(WB.hitProblemHandle(box0.x + 10, box0.y + 20) === true, '题面左侧那条算把手');
assert(WB.hitProblemHandle(box0.x + box0.w - 20, box0.y + box0.h - 12) === false,
  '题面正文不算把手（它要能直接圈画）');
assert(WB.hitProblemHandle(box0.x + box0.w - 20, box0.y + box0.h - 12) !== null,
  '把手判定返回布尔值而不是真值（便于断言）');

var grab = screenNow(box0.x + 10, box0.y + 20);
var dx = 120, dy = 80;

canvasEl._h.pointerdown(pe(grab.x, grab.y));
canvasEl._h.pointermove(pe(grab.x + dx, grab.y + dy));
canvasEl._h.pointerup(pe(grab.x + dx, grab.y + dy));

var box1 = WB.problemLayout();
var v1 = WB.view();

assert(Math.round(box1.x - box0.x) === Math.round(dx / v0.scale),
  '题面横向跟着拖了 ' + dx + ' 屏幕像素（' + box0.x + ' → ' + box1.x + '）');
assert(Math.round(box1.y - box0.y) === Math.round(dy / v0.scale),
  '题面纵向跟着拖了 ' + dy + ' 屏幕像素（' + box0.y + ' → ' + box1.y + '）');
assert(WB.strokes().length === strokes0, '拖题面不留下笔迹');
assert(v1.x === v0.x && v1.y === v0.y, '拖题面不带动板面');
assert(WB.state.actions.length === actions0, '拖题面不进撤销栈（挪位置不算一次编辑）');
assert(WB.state.active === null, '松手后没留下未收尾的拖动状态');

/* 缩放后手上拖 100px，题面只该挪 100/scale 个世界单位 */
WB.state.view.scale = 2;
WB.redraw();
var boxZ0 = WB.problemLayout();
var grabZ = screenNow(boxZ0.x + 10, boxZ0.y + 20);
canvasEl._h.pointerdown(pe(grabZ.x, grabZ.y));
canvasEl._h.pointermove(pe(grabZ.x + 100, grabZ.y));
canvasEl._h.pointerup(pe(grabZ.x + 100, grabZ.y));
var boxZ1 = WB.problemLayout();
assert(Math.round(boxZ1.x - boxZ0.x) === 50,
  '放大 2 倍时，手上拖 100px 题面只挪 50 个世界单位（实际 ' + Math.round(boxZ1.x - boxZ0.x) + '）');
WB.state.view.scale = 1;
WB.redraw();

/* 对照组 1：题面正文里按下去，仍然正常落笔（不是"题面一律不能画"） */
var bodyW = { x: boxZ1.x + boxZ1.w - 20, y: boxZ1.y + boxZ1.h - 12 };
assert(WB.hitProblem(bodyW.x, bodyW.y) === true, '对照组：正文确实在题面里（前提）');
var body = screenNow(bodyW.x, bodyW.y);
var strokesBody = WB.strokes().length;
canvasEl._h.pointerdown(pe(body.x, body.y));
canvasEl._h.pointermove(pe(body.x + 30, body.y + 10));
canvasEl._h.pointerup(pe(body.x + 30, body.y + 10));
assert(WB.strokes().length === strokesBody + 1, '题面正文上照常落笔（留着圈已知条件）');

/* 对照组 2：题面之外按下去，也照常落笔 —— 证明这套断言不是把落笔全关掉了 */
var boxC = WB.problemLayout();
var farW = { x: boxC.x + boxC.w + 300, y: boxC.y + 300 };
assert(WB.hitProblem(farW.x, farW.y) === false, '对照组：题面之外（前提）');
var far = screenNow(farW.x, farW.y);
var strokes1 = WB.strokes().length;
canvasEl._h.pointerdown(pe(far.x, far.y));
canvasEl._h.pointermove(pe(far.x + 40, far.y + 30));
canvasEl._h.pointerup(pe(far.x + 40, far.y + 30));
assert(WB.strokes().length === strokes1 + 1, '题面之外按下去仍然正常落一笔（对照组）');

/* 题面收起时，把手也不该生效 —— 否则看不见的题面会偷走一次落笔 */
WB.clearAll();
WB.applyProblem('8a-01');
WB.setShowProblem(false);
WB.redraw();
var strokes2 = WB.strokes().length;
var hid = screenNow(16 + 10, 16 + 20);
canvasEl._h.pointerdown(pe(hid.x, hid.y));
canvasEl._h.pointermove(pe(hid.x + 30, hid.y + 20));
canvasEl._h.pointerup(pe(hid.x + 30, hid.y + 20));
assert(WB.strokes().length === strokes2 + 1, '题面隐藏后，把手位置按下去照常落笔');
WB.setShowProblem(true);

/* 光标提示：压在把手上才变"可抓"，压在正文上还是十字 */
WB.clearAll();
WB.applyProblem('8a-01');
WB.state.problemAt.x = 16;
WB.state.problemAt.y = 16;
WB.redraw();
var boxG = WB.problemLayout();
var onGrip = screenNow(boxG.x + 10, boxG.y + 20);
var onBody = screenNow(boxG.x + boxG.w - 20, boxG.y + boxG.h - 12);
canvasEl._h.pointermove(pe(onGrip.x, onGrip.y));
assert(WB.state.problemGripHot === true, '压在把手上 → 把手亮起');
assert(canvasEl.style.cursor === 'grab', '压在把手上 → 光标变可抓（实际 ' + canvasEl.style.cursor + '）');
canvasEl._h.pointermove(pe(onBody.x, onBody.y));
assert(WB.state.problemGripHot === false, '压到正文上 → 把手不再亮');
assert(canvasEl.style.cursor === '', '压到正文上 → 光标恢复十字（实际 ' + canvasEl.style.cursor + '）');

/* ============================================================
   9. 增量绘制必须自己带世界变换
   ------------------------------------------------------------
   用户报的"我在 A 点落笔，画笔却从别处画起、还多一条长线"。
   真因：redraw() 结尾的 restore() 把变换退回设备像素空间，
   而拖动途中的增量墨迹（drawTail）没有自己重设 —— 于是画的时候
   墨按"世界坐标当 CSS 像素"画出来，一松手 redraw() 重画又对了。
   所以只测"落定后的数据"永远看不见它，必须测绘制时用的变换。
   ============================================================ */
WB.clearAll();
var dpr9 = WB.state.view.dpr || 1;
WB.state.view.scale = 0.5;
WB.state.view.x = 30;
WB.state.view.y = 40;
WB.redraw();

var wantTf = { a: dpr9 * 0.5, d: dpr9 * 0.5, e: dpr9 * 30, f: dpr9 * 40 };
var deviceTf = { a: dpr9, d: dpr9, e: 0, f: 0 };

assert(!tfEq(wantTf, deviceTf),
  '前提：世界变换与设备变换确实不同（否则这条断言是空的）');

/* 单独画一笔：drawStroke 必须自己带上世界变换 */
var solo9 = { color: '#111', width: 3, points: [{ x: 10, y: 10, p: 0.5 }, { x: 60, y: 40, p: 0.5 }] };
WB.state.strokes.push(solo9);
__ctxCalls.strokeTfs = [];
WB.drawStroke(solo9);
assert(__ctxCalls.strokeTfs.length > 0, '前提：drawStroke 确实描了边');
assert(tfEq(__ctxCalls.strokeTfs[0], wantTf),
  'drawStroke 自己设了世界变换（实际 ' + JSON.stringify(__ctxCalls.strokeTfs[0]) + '）');

/* 拖动途中的增量墨迹：drawTail 也必须自己设 */
solo9.points.push({ x: 90, y: 70, p: 0.5 });
__ctxCalls.strokeTfs = [];
WB.drawTail(solo9);
assert(__ctxCalls.strokeTfs.length > 0, '前提：drawTail 确实描了边');
assert(tfEq(__ctxCalls.strokeTfs[0], wantTf),
  'drawTail 自己设了世界变换（实际 ' + JSON.stringify(__ctxCalls.strokeTfs[0]) + '）');

/* 端到端：真按一下再拖一下，拖动途中的第一笔也得在世界变换下画。
   桩里的 requestAnimationFrame 是同步的，所以 onMove 里 drawTail 先执行、
   redraw 排在它后面 —— strokeTfs 的第 0 条就是那条增量墨迹。 */
WB.clearAll();
var v9 = WB.state.view;
var px9 = v9.x + 100 * v9.scale, py9 = v9.y + 100 * v9.scale;
canvasEl._h.pointerdown(pe(px9, py9));
__ctxCalls.strokeTfs = [];
canvasEl._h.pointermove(pe(px9 + 40, py9 + 25));
var first9 = __ctxCalls.strokeTfs[0];
assert(tfEq(first9, wantTf),
  '拖动中的第一笔墨迹用世界变换（实际 ' + JSON.stringify(first9) + '）');
canvasEl._h.pointerup(pe(px9 + 40, py9 + 25));

/* 收尾：视图和画布都恢复原状，免得影响后面的用例 */
WB.clearAll();
WB.state.view.scale = 1;
WB.state.view.x = 16;
WB.state.view.y = 16;
WB.redraw();

/* ============================================================
   10. 分析与答案的预置数据
   ============================================================ */
var AN = window.WK_ANALYSIS;
assert(!!AN, '数据模块已挂到 window.WK_ANALYSIS');
assert(typeof AN.steps === 'function' && typeof AN.answer === 'function',
  '数据模块给出 steps() 与 answer() 两个入口');

var guides10 = AN.steps({ text: '−7 + 3' });
assert(guides10.length >= 1 && guides10.length <= 5,
  '台阶数量在 1~5 之间（实际 ' + guides10.length + '）');

var allText10 = guides10.join(' ');
var bad10 = [];
for (var i10 = 0; i10 < guides10.length; i10++) {
  if (!guides10[i10] || typeof guides10[i10] !== 'string' || !guides10[i10].trim()) bad10.push(i10);
}
assert(bad10.length === 0, '每条台阶都是非空文字（空的是 ' + JSON.stringify(bad10) + '）');

/* 「分析」不许出现答案 —— 设计 §2 #6 的核心规矩 */
var leaked10 = [];
for (var id10 in AN.PRESET) {
  if (!AN.PRESET.hasOwnProperty(id10)) continue;
  var res10 = AN.PRESET[id10].result;
  if (!res10) continue;
  if (allText10.indexOf(res10) >= 0) leaked10.push(id10 + ' 的答案 ' + res10);
}
assert(leaked10.length === 0,
  '通用台阶里不出现任何预置答案（漏的是 ' + JSON.stringify(leaked10) + '）');

assert(AN.answer('7a-01') && AN.answer('7a-01').result === '−4',
  '能取到 7a-01 的预置答案');
assert(AN.answer('不存在的题') === null, '没预置的题返回 null（由界面层给说明）');
assert(typeof AN.NO_ANSWER === 'string' && AN.NO_ANSWER.length > 10,
  '没预置答案时有一句老实的说明');

out(__fail ? 'RESULT: 有失败项' : 'RESULT: 全部通过');
