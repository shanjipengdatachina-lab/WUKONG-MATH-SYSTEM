/* ============================================================
   白板引擎自检 —— 断言
   ============================================================ */
var WB = window.__WB__;
assert(!!WB && !!WB.state, '引擎已初始化并暴露测试接口');
assert(WB.COLORS.length === 7, '配色 7 种（六支原色 + 用户要的中国红）');
assert(WB.WIDTHS.length === 3 && WB.ERASERS.length === 3, '笔粗与橡皮各 3 档');
assert(WB.state.tool === 'pen', '默认工具是画笔');
assert(WB.state.view.dpr === 2 && canvasEl.width === 2400, '按设备像素比放大画布（清晰不虚）');

/* 光标归位在"启动"这一刻就得对：默认工具是画笔，画笔要把系统十字换成圆圈。
   只把 syncCursor 挂在 setTool 上的话，刚打开页面、还没点过任何工具按钮时
   `#wb-canvas{cursor:crosshair}` 依然生效 —— 用户看到的还是十字（真机上复现过：
   localStorage 里没有记录、工具取默认值，此时没有任何一步会去调 setTool）。
   所以光标由 syncUI 统一归位，而 syncUI 在启动末尾必然走一遍。 */
assert(canvasEl.style.cursor === 'none',
  '一打开页面（没点过任何工具）画笔就不该显示系统十字（实际 "' + canvasEl.style.cursor + '" —— 空值意味着 CSS 的 crosshair 生效）');

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

/* ---------- 橡皮：圆圈擦到哪里，哪里才没（不是碰到就整笔删掉） ---------- */
var before = WB.state.strokes.slice();
/* 记下"擦之前"的样子来比对 —— 别写死坐标：屏幕坐标要经过视图换算才是世界坐标 */
var origPts13a = before[0].points.map(function (p) { return p.x + ',' + p.y; }).join(' ');
var origX13a = before[0].points[0].x;
WB.setEraser(26);
canvasEl._h.pointerdown(pe(110, 115));
canvasEl._h.pointerup(pe(110, 115));
assert(WB.state.strokes.length === 3,
  '橡皮只吃掉被圆圈盖住的那一段，整笔还在（仍是 3 笔，实际 ' + WB.state.strokes.length + '）');
assert(WB.state.strokes.indexOf(before[0]) < 0, '第 1 笔被换成"擦过之后"的新笔，原对象不再在板上');
assert(before[0].points.map(function (p) { return p.x + ',' + p.y; }).join(' ') === origPts13a,
  '原来那一笔的点一个都没被改（撤销靠它完好）');
assert(WB.state.strokes[0].points[0].x > origX13a,
  '第 1 笔的头被吃掉了，起点往后挪（原 x=' + origX13a.toFixed(1) +
  '，现 ' + WB.state.strokes[0].points[0].x.toFixed(1) + '）');
assert(WB.state.strokes[1] === before[1] && WB.state.strokes[2] === before[2], '另外两笔原样没动');
WB.undo();
assert(WB.state.strokes.length === 3, '撤销擦除后仍是 3 笔');
assert(WB.state.strokes[0] === before[0] && WB.state.strokes[1] === before[1] && WB.state.strokes[2] === before[2],
  '撤销后拿回的是原来那一整笔，顺序与原来完全一致');

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

/* ---------- 箭头与标记 ----------
   坐标不能写死：题面上有"把手区"（左侧那一条 + 标题行），而题面落在屏幕哪个位置
   取决于视图（上面刚平移过）。写死坐标就会出现"某一天题面正好挪过来，
   这一笔变成拖题面"—— 真发生过：加"标题行也是把手"之后，箭头那两条在 (200,260) / (200,300)
   正好压在题面的标题行上，画不出来。所以统一从"题面下方"起手。 */
var shapeBox = WB.problemLayout();
var shapeAt = WB.boardToScreen(shapeBox.x + 10, shapeBox.y + shapeBox.h + 80);
var sx = Math.round(shapeAt.x);
var sy = Math.round(shapeAt.y);

WB.setTool('line');
WB.onDown(pe(sx, sy));
WB.onMove(pe(sx + 100, sy + 40));
WB.onUp(pe(sx + 100, sy + 40));
var lineStroke = WB.state.strokes[WB.state.strokes.length - 1];
assert(lineStroke.type === 'line' && lineStroke.points.length === 2, '直线工具：两点成线');
WB.setTool('arrow');
WB.onDown(pe(sx, sy + 60));
WB.onMove(pe(sx + 120, sy + 60));
WB.onUp(pe(sx + 120, sy + 60));
assert(WB.state.strokes[WB.state.strokes.length - 1].type === 'arrow', '箭头工具生效');
WB.onDown(pe(sx, sy + 100));
WB.onUp(pe(sx, sy + 100));
assert(WB.state.strokes[WB.state.strokes.length - 1].type === 'arrow', '只点一下不拖拽不会留下空图形');
WB.setTool('rect');
WB.onDown(pe(sx + 160, sy));
WB.onMove(pe(sx + 260, sy + 80));
WB.onUp(pe(sx + 260, sy + 80));
assert(WB.state.strokes[WB.state.strokes.length - 1].type === 'rect', '矩形工具生效');
WB.setTool('ellipse');
WB.onDown(pe(sx + 300, sy));
WB.onMove(pe(sx + 400, sy + 80));
WB.onUp(pe(sx + 400, sy + 80));
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
/* 只有那层浅底是 fill；题面文字与标签走的是 fillText，不计入这里。
   这个数字是"题面上还挂没挂记号"的总闸 —— 原来 3（浅底 + 两道短横），现在 1。 */
assert(hoverFills === 1,
  '悬停时只浮现那层浅底，题面上不再画任何记号（填充增量应为 1，实际 ' + hoverFills + '）');

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

/* ---- 题面的**标题行**也是把手 ----
   用户要的：面板标题栏整条都能拖（鼠标一到就出小手），题目这边不该只剩最左边那一小条 ——
   原话「只要鼠标焦点到达面板的这个[标题栏]，就会出现小手，表示我们可以拖动。
   包括题目上面的那个标题」。只有带 tag 的题才有标题行；没 tag 的题最上面那一行就是正文第一行，
   那一行是学生最常圈画的地方，不能吃成把手。 */
var keepAt = { x: WB.state.problemAt.x, y: WB.state.problemAt.y };
WB.applyExternal({ text: '(−7) + 3', tag: '考点 1 整式的概念', extra: '' });
WB.state.problemAt.x = 16;
WB.state.problemAt.y = 16;
WB.redraw();
var boxTag = WB.problemLayout();
assert(WB.hitProblemHandle(boxTag.x + boxTag.w - 20, boxTag.y + 20) === true,
  '带标题的题：标题行右侧也算把手（不再只认最左边那一条）');
assert(WB.hitProblemHandle(boxTag.x + boxTag.w - 20, boxTag.y + 60) === false,
  '标题行下面还是正文，不算把手（正文要能圈画）');

/* 从标题行拖：题面跟着走、不留笔迹 */
var strokesTag = WB.strokes().length;
var grabT = screenNow(boxTag.x + boxTag.w - 20, boxTag.y + 20);
canvasEl._h.pointerdown(pe(grabT.x, grabT.y));
canvasEl._h.pointermove(pe(grabT.x + 60, grabT.y));
canvasEl._h.pointerup(pe(grabT.x + 60, grabT.y));
assert(Math.round(WB.problemLayout().x - boxTag.x) === Math.round(60 / WB.view().scale),
  '从标题行也能把题面拖走（' + Math.round(WB.problemLayout().x - boxTag.x) + ' 个世界单位）');
assert(WB.strokes().length === strokesTag, '从标题行拖不留下笔迹');

/* 光标：压在标题行上要变成小手（用户原话："就会出现小手，表示我们可以拖动"） */
WB.state.problemHover = true;
WB.setProblemGripHot(WB.hitProblemHandle(boxTag.x + boxTag.w - 20, boxTag.y + 20));
assert(canvasEl.style.cursor === 'grab',
  '压在题面标题行上光标变成小手（实际 "' + canvasEl.style.cursor + '"）');
/* 反过来：压在正文上不该是"可抓"（不然学生会以为那一条拖不得、也就不敢在上面画了） */
WB.setProblemGripHot(WB.hitProblemHandle(boxTag.x + boxTag.w - 20, boxTag.y + 60));
assert(canvasEl.style.cursor !== 'grab', '压在正文上不是小手（正文要留给圈画）');
WB.state.problemHover = false;
WB.setProblemGripHot(false);

/* 没有 tag 的题：最上面那一行是正文，不能吃成把手 */
WB.applyExternal({ text: '(−7) + 3', tag: '', extra: '' });
WB.redraw();
var boxNoTag = WB.problemLayout();
assert(WB.hitProblemHandle(boxNoTag.x + boxNoTag.w - 20, boxNoTag.y + 20) === false,
  '没有标题的题：正文第一行不算把手（否则那一行就圈不动了）');
assert(WB.hitProblemHandle(boxNoTag.x + 10, boxNoTag.y + 20) === true,
  '没有标题的题：左边那一条仍然是把手');

/* 复位：外部内容撤掉、位置还给上面 */
WB.applyExternal(null);
WB.state.problemAt.x = keepAt.x;
WB.state.problemAt.y = keepAt.y;
WB.redraw();

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
/* 笔 / 荧光笔 / 橡皮现在都把系统光标藏起来、改画圆圈，所以这里不再是十字（空值）而是 none。
   题面上照样能落笔 —— 只有把手那一小条是拖动区。 */
assert(canvasEl.style.cursor === 'none',
  '压到正文上 → 笔类工具仍是"只留圆圈"（实际 ' + canvasEl.style.cursor + '）');

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

/* ============================================================
   11. 板面主题：一整套配色 + 换板按序号平移
   ============================================================ */
var T11 = WB.themes();
assert(Object.keys(T11).length === 3, '三套板面（实际 ' + Object.keys(T11).length + ' 套）');
var need11 = ['board', 'grid', 'ink', 'inkSoft', 'tag', 'tagHot', 'tint', 'highlightAlpha', 'colors', 'label'];
var miss11 = [];
for (var tk11 in T11) {
  if (!T11.hasOwnProperty(tk11)) continue;
  for (var ni11 = 0; ni11 < need11.length; ni11++) {
    if (T11[tk11][need11[ni11]] === undefined) miss11.push(tk11 + '.' + need11[ni11]);
  }
  if (!T11[tk11].colors || T11[tk11].colors.length !== 7) miss11.push(tk11 + '.colors 不是 7 支（六支原色 + 中国红）');
}
assert(miss11.length === 0, '每套主题字段齐全（缺的是 ' + JSON.stringify(miss11) + '）');

/* 中国红：用户点名要的（"画笔色盘和主体色盘都加上大红叫做中国红"）。
   浅色板用中系正红 #e60012；黑板上换它的亮色版 —— #e60012 压纯黑只有 3.4:1，在黑板上太沉。 */
function redOf11(tk, label) {
  return (T11[tk].colors || []).filter(function (c) { return c.label === label; })[0];
}
['white', 'mid'].forEach(function (tk) {
  var r = redOf11(tk, '中国红');
  assert(!!r && r.value === '#e60012', tk + ' 板上有中国红 #e60012（实际 ' + (r && r.value) + '）');
});
var redDark11 = redOf11('dark', '中国红');
assert(!!redDark11 && redDark11.value === '#ff4d4f', '黑板上是亮版中国红 #ff4d4f（实际 ' + (redDark11 && redDark11.value) + '）');
assert(T11.white.colors[0].value === '#1f2937', '加了中国红也没动第一支（默认笔还是墨黑）');

/* 深色板的字必须比板面亮，否则字会消失 —— 这条是"换板不是刷背景"的底线 */
function lum11(hex) {
  var h = String(hex).replace('#', '');
  var r = parseInt(h.substr(0, 2), 16), g = parseInt(h.substr(2, 2), 16), b = parseInt(h.substr(4, 2), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}
assert(lum11(T11.dark.ink) > lum11(T11.dark.board) + 0.4,
  '黑板：题面字比板面亮得多（字 ' + lum11(T11.dark.ink).toFixed(2) + ' vs 板 ' + lum11(T11.dark.board).toFixed(2) + '）');
assert(lum11(T11.white.ink) < lum11(T11.white.board) - 0.4,
  '白板：题面字比板面暗得多');

/* 黑板就是**纯黑 + 纯白**（用户原话："暗色系怎么感觉是蓝色；搞成黑色，黑白是纯粹的颜色"）。
   原来板面是 #0f172a 一族的深蓝黑，网格与悬停底也是蓝灰 —— 整块看过去是"蓝板"不是黑板。
   这里把"纯"钉住：板面与粉笔是纯黑白，网格 / 悬停底 / 题面那三档浓淡都不许带色相。 */
eq2(T11.dark.board, '#000000', '黑板的板面是纯黑');
eq2(T11.dark.ink, '#ffffff', '黑板的粉笔是纯白');
eq2(T11.dark.colors[0].value, '#ffffff', '黑板默认那支笔也是纯白（原来 #f8fafc 带两点蓝）');

/* R=G=B 才算"无彩" */
function grey11(v) {
  var s = String(v);
  var m = /^rgba?\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(s);
  if (m) return m[1] === m[2] && m[2] === m[3];
  var h = /^#([0-9a-fA-F]{6})$/.exec(s);
  if (!h) return false;
  var p = h[1].toLowerCase();
  return p.substr(0, 2) === p.substr(2, 2) && p.substr(2, 2) === p.substr(4, 2);
}
['board', 'grid', 'inkSoft', 'tag', 'tagHot', 'tint'].forEach(function (k) {
  assert(grey11(T11.dark[k]), '黑板的 ' + k + ' 不带色相（实际 ' + T11.dark[k] + '）');
});

/* 对照：白板 / 中板不动 —— 这一版只改暗色 */
eq2(T11.white.board, '#ffffff', '白板还是纯白（没被顺手改掉）');
eq2(T11.mid.board, '#eceff3', '中板还是原来那个中灰（这一版只动暗色）');

/* 当前笔色按序号平移：从白板第 2 支（朱红）换到黑板第 2 支（珊瑚） */
WB.setTheme('white');
WB.setColor(WB.COLORS[1].value);
var red11 = WB.COLORS[1].value;
WB.setTheme('dark');
assert(WB.theme().key === 'dark', '换到黑板生效');
assert(WB.state.color === WB.themes().dark.colors[1].value,
  '换板后当前笔色按序号平移（' + red11 + ' → ' + WB.state.color + '）');

/* 板上已有的笔迹也按序号平移，但**点坐标一个都不许动** */
WB.clearAll();
WB.setTheme('white');
var st11 = { color: red11, width: 3, points: [{ x: 10, y: 20, p: 0.5 }, { x: 60, y: 80, p: 0.5 }] };
WB.state.strokes.push(st11);
var pts11 = JSON.stringify(st11.points);
WB.setTheme('dark');
assert(st11.color === WB.themes().dark.colors[1].value,
  '板上已有的笔迹也按序号平移（' + red11 + ' → ' + st11.color + '）');
assert(JSON.stringify(st11.points) === pts11, '换板只动颜色，点坐标一个都没动');
assert(st11.width === 3, '换板不动笔粗');

/* 不在任何一套配色里的颜色（比如从别的页面带进来的），换板时不动 */
WB.setTheme('white');
st11.color = '#123456';
WB.setTheme('dark');
assert(st11.color === '#123456', '调色板之外的颜色换板时保持不变');

/* 非法主题名回落，不抛错 */
assert(WB.setTheme('不存在的板') === false, '非法主题名被拒绝');
assert(WB.theme().key === 'dark', '被拒绝后主题不变');

/* 换板后板面色真的被铺进了画布 —— 这是导出能带背景色的前提 */
WB.setTheme('white');
__ctxCalls.clear = 0;
WB.redraw();
assert(__ctxCalls.clear >= 1, '每次重绘都铺一层板面色（不再靠 CSS 白底）');

/* ============================================================
   12. 右侧竖工具条 / 分析答案面板（两个 tab）/ 保存菜单 / 面板自己拖
   ------------------------------------------------------------
   用户这一版的要求（原话）：
     · 「上传我的题……这个按钮要放在底部。它是一个独立的功能」
     · 「相当于放了一个新的工具栏，放在右边……图标都竖着放」
     · 「第一个功能叫分析……第三个叫转译，第四个叫保存」
     · 「那这样的话，我们的右边就是三个标签。就三个按钮了」—— 答案并进分析里当 tab
     · 「这个分析是可以拖动的」—— 面板不再挂在题目上
     · 「这样我们的题目。周围干干净净的」
   所以这一节守六件事：
     1) 竖工具条三个按钮：有题才亮、按下态跟着面板走、板上没题时灰掉；
     2) 分析面板：一个框、两个 tab（分析 / 答案），只读；
     3) 答案那一页：结果 + 分步 + AI 注释，注释开关两态；
     4) 面板自己拖：位置是自己的（屏幕像素），题目挪了它不动；
     5) 保存菜单：存题 / 导出两条，都真的做事；
     6) 「上传我的题」在底部工具条上，点了给一句实话（不是一个没反应的假按钮）。
   ============================================================ */

/* 先把 toast 收集起来：点了要给反馈，反馈得能验 */
__capture.toasts = [];
window.MathSite = { icons: function () {}, toast: function (m) { __capture.toasts.push(String(m)); } };

var sideIds12 = ['wb-act-analysis', 'wb-act-transcribe', 'wb-act-save'];
var panel12 = elById('wb-panel');
var saveMenu12 = elById('wb-save');
var paneThink12 = elById('wb-pane-think');
var paneAnswer12 = elById('wb-pane-answer');

/* ---- 板上没题：三个按钮灰掉（没东西可分析，也没东西可存） ---- */
WB.clearAll();
WB.applyProblem(null);
WB.redraw();
eq2(sideIds12.every(function (id) { return elById(id).disabled === true; }), true,
  '板上没题时，竖工具条那三个按钮都灰掉');
eq2(panel12.hidden, true, '没点过分析，面板不出现');

/* ---- 有题：按钮亮起来 ---- */
WB.applyProblem('7a-01');
WB.state.problemAt.x = 16;
WB.state.problemAt.y = 16;
WB.redraw();
eq2(sideIds12.every(function (id) { return elById(id).disabled === false; }), true,
  '题面上板后，三个按钮都能按');
eq2(elById('wb-act-analysis').getAttribute('aria-pressed'), 'false', '没点过时，分析按钮不是激活态');

/* ---- 点「分析」：一个框、两个 tab ---- */
WB.toggleAnalysis();
eq2(WB.analysisOpen(), true, '点「分析」→ 面板展开');
eq2(panel12.hidden, false, '面板真的露出来了');
eq2(elById('wb-act-analysis').getAttribute('aria-pressed'), 'true', '竖条上的分析按钮跟着亮');

var n12 = WB.thinkSteps().length;
eq2(WB.tab(), 'think', '默认停在「分析」那一页');
eq2(paneThink12.hidden, false, '「分析」页是显示的');
eq2(paneAnswer12.hidden, true, '「答案」页先藏着（它是 tab 的另一半）');
eq2(elById('wb-tab-think').getAttribute('aria-selected'), 'true', '分析那个 tab 标着"选中"');
eq2(elById('wb-tab-answer').getAttribute('aria-selected'), 'false', '答案那个 tab 标着"没选中"');
assert(n12 >= 1 && n12 <= 8, '思路的步数在 1~8（实际 ' + n12 + '）');
eq2(elById('wb-think-count').textContent, n12 + ' 步', 'tab 上写着"几步"—— 有四步就写四步');

var thinkHtml12 = elById('wb-think-list').innerHTML;
eq2(thinkHtml12.split('class="wb-tile"').length - 1, n12, '框里的条目数 = 步数');
assert(thinkHtml12.indexOf('>1<') >= 0 && thinkHtml12.indexOf('>' + n12 + '<') >= 0,
  '编号从 1 连到 ' + n12 + '（一二三四……就是这么排的）');

/* 只读：用户原话"它的目的就是看嘛，就看看思路就行了" */
assert(thinkHtml12.indexOf('contenteditable') < 0, '分析页里没有任何可写格子');
eq2(panel12.getAttribute('contenteditable'), null, '面板整体也是只读的');

/* 设计 §2 #6：分析里不许出现答案 */
var ans12 = WB.answerData();
assert(!!ans12 && !!ans12.result && WB.thinkSteps().join(' ').indexOf(ans12.result) < 0,
  '思路里不出现答案 ' + (ans12 && ans12.result) + '（这条是「分析」的底线）');

/* ---- 切到「答案」那一页 ---- */
WB.setTab('answer');
eq2(WB.tab(), 'answer', '点「答案」那个 tab → 切过去了');
eq2(paneAnswer12.hidden, false, '答案页露出来');
eq2(paneThink12.hidden, true, '分析页收起来');
eq2(elById('wb-tab-answer').getAttribute('aria-selected'), 'true', 'tab 的选中态跟着切');
eq2(elById('wb-answer-result').textContent, ans12.result, '答案页第一行就是标准答案 ' + ans12.result);

var ansHtml12 = elById('wb-answer-steps').innerHTML;
eq2(ansHtml12.split('class="wb-tile"').length - 1, ans12.steps.length,
  '答案的分步条目数与数据一致（' + ans12.steps.length + ' 步）');
assert(ansHtml12.indexOf('wb-tile__cmt') >= 0, '每一步后面挂着 AI 注释');
assert(ansHtml12.indexOf(ans12.steps[0].note.slice(0, 4)) >= 0,
  '注释内容真的写进了界面（不是空壳）：' + ans12.steps[0].note.slice(0, 4) + '……');
assert(ansHtml12.indexOf('wb-tile__cmt" hidden') < 0, '注释默认显示着');
eq2(elById('wb-act-notes').hidden, false, '有注释才有注释开关');
eq2(elById('wb-act-notes').getAttribute('aria-pressed'), 'true', '开关自身也标着"注释正显示"');

WB.toggleNotes();
eq2(WB.notesOn(), false, '点一下 → 注释收起');
assert(elById('wb-answer-steps').innerHTML.indexOf('wb-tile__cmt" hidden') >= 0,
  '界面上的注释真的藏起来了（不是只改了个内存变量）');
eq2(elById('wb-act-notes').textContent, '显示注释', '开关的字跟着变成"显示注释"');
WB.toggleNotes();
eq2(WB.notesOn(), true, '再点一下 → 注释回来');

/* 切回分析页：还是那一份内容（切 tab 只是显隐，不重建 DOM） */
WB.setTab('think');
eq2(paneThink12.hidden, false, '切回分析页');
eq2(elById('wb-think-list').innerHTML, thinkHtml12, '切回来还是那一份思路（切 tab 不重建）');

/* ---- 面板自己拖：位置是自己的，题目挪了它不动 ---- */
var head12 = elById('wb-panel-head');
var winL12 = parseFloat(panel12.style.left);
var winT12 = parseFloat(panel12.style.top);
head12._h.pointerdown(pe(300, 200));
head12._h.pointermove(pe(360, 260));
head12._h.pointerup(pe(360, 260));
eq2(Math.round(parseFloat(panel12.style.left) - winL12), 60, '拖面板标题栏 → 面板横移 60px');
eq2(Math.round(parseFloat(panel12.style.top) - winT12), 60, '面板纵向也跟着走 60px');
assert(!!WB.state.winAt.panel && Math.round(WB.state.winAt.panel.x - winL12) === 60,
  '面板的位置真的记下来了（state.winAt.panel）');

/* ---- 浮窗宽度只有一个数（用户问："面板宽度是不是应该一致"） ----
   真机上量得到 offsetWidth，桩里量不到 —— 走的是 defaultWinAt 里那个兜底宽度。
   兜底要是给两个窗口两个数（原来分析面板 260 / 转译 320），
   并排一开就是一个宽一个窄。x = 画布宽 - 让位 - 宽度，宽度相同 x 才相同。 */
eq2(WB.defaultWinAt('panel').x, WB.defaultWinAt('ink').x,
  '两个浮窗的兜底宽度是同一个数（并排一开才一样宽）');

/* 关键：面板**不跟题目走**（"这个分析是可以拖动的""题目周围干干净净"） */
var px12 = WB.state.problemAt.x;
var panelL12 = panel12.style.left;
var panelT12 = panel12.style.top;
WB.state.problemAt.x = px12 + 200;
WB.redraw();
eq2(panel12.style.left, panelL12, '题面右移 200px，面板原地不动（它有自己的位置）');
eq2(panel12.style.top, panelT12, '竖直方向也不动');
WB.state.problemAt.x = px12;
WB.redraw();

/* 位置是**屏幕像素**：板面缩放不改变它 */
var zoomL12 = panel12.style.left;
WB.state.view.scale = 0.5;
WB.redraw();
eq2(panel12.style.left, zoomL12, '缩放板面 → 面板位置不变（它不是画在板上的东西）');
WB.state.view.scale = 1;
WB.redraw();

/* ---- 收起：面板关掉，按钮跟着灭 ---- */
WB.closeAnalysis();
eq2(WB.analysisOpen(), false, '点收起 → 面板关掉');
eq2(panel12.hidden, true, '面板藏起来');
eq2(elById('wb-act-analysis').getAttribute('aria-pressed'), 'false', '竖条上的按钮灭掉');
WB.openAnalysis();
eq2(panel12.hidden, false, '再点开 → 面板回来');

/* 题面收起时，面板不该留在板上当幽灵 */
WB.setShowProblem(false);
WB.redraw();
eq2(panel12.hidden, true, '题面收起 → 面板一起收起');
WB.setShowProblem(true);
WB.redraw();
eq2(panel12.hidden, false, '题面回来 → 面板回来');

/* ---- 标题栏里的控件不能被标题栏的拖动吃掉 ----
   用户反馈："点击关闭都没有效果"。根在这里：✕ 和 tab 都长在标题栏里面，
   而标题栏是拖动抓手 —— pointerdown 里 setPointerCapture(+preventDefault) 之后，
   浏览器会把后面那个 click 改派给捕获元素，✕ / tab 自己的 click 根本不响。
   题库面板当初就专门躲开了 .wb-bank__close，新的两块面板当时漏了这一步。
   桩里没有祖先链，所以用一个"会说自己是 button"的 target 来演真实按钮。 */
var btnTarget12 = { closest: function (s) { return s.indexOf('button') >= 0 ? {} : null; } };
var dragX12 = WB.state.winAt.panel.x;
head12._h.pointerdown(pe(300, 200, { id: 12, target: btnTarget12 }));
head12._h.pointermove(pe(360, 260, { id: 12 }));
head12._h.pointerup(pe(360, 260, { id: 12 }));
eq2(Math.round(WB.state.winAt.panel.x), Math.round(dragX12),
  '按在 ✕ / tab 上不会把面板拖走（标题栏不许吃掉控件的点击）');
eq2(head12.classList.contains('is-dragging'), false, '按在 ✕ 上也不会进入"正在拖"的样子');
/* 反过来：按在标题栏空白处照样能拖（别为了躲按钮把拖动整个关掉） */
head12._h.pointerdown(pe(300, 200, { id: 13, target: null }));
head12._h.pointermove(pe(340, 200, { id: 13 }));
head12._h.pointerup(pe(340, 200, { id: 13 }));
eq2(Math.round(WB.state.winAt.panel.x - dragX12), 40, '按在标题栏空白处照样能拖（40px）');

/* ✕ 自己的 click 要能关掉面板 */
WB.openAnalysis();
eq2(WB.analysisOpen(), true, '前提：面板开着');
elById('wb-panel-close')._h.click(pe(300, 200, { target: btnTarget12 }));
eq2(WB.analysisOpen(), false, '点面板的 ✕ → 面板关掉');
eq2(panel12.hidden, true, '点面板的 ✕ → 面板真的藏起来');

/* 转译窗口的 ✕ 同理（它也是长在标题栏里的） */
WB.toggleTranscribe();
eq2(WB.state.ink.open, true, '前提：转译窗口开着');
elById('wb-ink-close')._h.click(pe(300, 200, { target: btnTarget12 }));
eq2(WB.state.ink.open, false, '点转译窗口的 ✕ → 它自己关掉');
eq2(elById('wb-ink-text').hidden, true, '转译窗口也真的藏起来');
WB.openAnalysis();
WB.redraw();

/* ---- 保存菜单：存题 / 导出两条 ---- */
eq2(saveMenu12.hidden, true, '没点保存时，菜单不出现');
WB.toggleSaveMenu();
eq2(WB.saveMenuOpen(), true, '点「保存」→ 菜单弹出来');
eq2(saveMenu12.hidden, false, '菜单真的露出来了');
eq2(elById('wb-act-save').getAttribute('aria-pressed'), 'true', '竖条上的保存按钮跟着亮');
assert(!!elById('wb-save-mine') && !!elById('wb-save-file'), '菜单里两条都在（存题 / 导出）');

/* 存题：真的落盘，而且能数出来 */
var mineBefore12 = WB.mineList().length;
var rec12 = WB.saveToMine();
assert(!!rec12 && !!rec12.text, '存题返回了一条记录（题面文字在里面）');
eq2(WB.mineList().length, mineBefore12 + 1,
  '「我的题」里多了一条（' + mineBefore12 + ' → ' + WB.mineList().length + '）');
assert(!!(rec12.strokes && rec12.think && rec12.answer),
  '这条记录里有笔迹、有分析、有答案（不是只存了个标题）');
var storedMine12 = JSON.parse(window.localStorage.getItem(WB.mineKey()) || '{}');
assert(!!storedMine12[rec12.id], '真的进了 localStorage（不是只停在内存里）');

/* 板上没题时存不了 —— 返回 null，界面给一句实话，不假装存成功 */
WB.applyProblem(null);
WB.redraw();
eq2(WB.saveToMine(), null, '板上没题 → 存题返回 null（不假装存成功）');
WB.applyProblem('7a-01');
WB.redraw();

/* 导出：文字那一列该有分析 + 答案（导的是"题目 + 你写的 + 生成的文字"） */
var blocks12 = WB.exportTextBlock();
assert(blocks12.length >= 2, '导出的文字列里有分析 + 答案（实际 ' + blocks12.length + ' 块）');
eq2(blocks12[0].title, '分析', '第一块是分析');
eq2(blocks12[0].lines.length, n12, '分析那一块的条数对得上');
eq2(blocks12[1].title, '标准答案', '第二块是标准答案');
assert(blocks12[1].lines.join(' ').indexOf(ans12.result) >= 0, '答案写在导出内容里');

/* 导出分辨率：不能拿屏幕上那一帧去抠 —— 那一帧是按**当前缩放**画的（用户缩到 69%，
   内容就只有 0.69 倍的像素），抠出来必糊。用户反馈："导出成功；分辨率有点低"。
   导出期间应当：内容重新铺满画布 + 像素密度顶上去；完事把用户那一帧一字不差地还原。 */
window.devicePixelRatio = 1;          /* 设成 1 倍屏，好分辨"提升"是我们自己做的还是环境给的 */
WB.state.view.scale = 0.69;           /* 用户就是 69% —— 正是糊掉的那个场景 */
WB.redraw();
var seen12 = null;
var ret12 = WB.withExportBoard(function (box) {
  seen12 = {
    scale: WB.state.view.scale,
    exportDpr: WB.state.exportDpr,
    w: box.w,
    h: box.h,
    canvasW: canvasEl.width
  };
  return '导出这一趟的产物';
});
eq2(ret12, '导出这一趟的产物', '重画块把回调的返回值带出来（导出才拿得到图）');
assert(!!seen12 && seen12.exportDpr >= 2,
  '导出期间像素密度顶到 2 倍以上（实际 ' + (seen12 && seen12.exportDpr) + '）—— 不再是屏幕上那 1 倍');
assert(!!seen12 && seen12.scale > 0.69,
  '导出期间板面重新铺满（缩放 ' + (seen12 && Math.round(seen12.scale * 100) / 100) + ' > 用户的 0.69）');
eq2(seen12 && seen12.canvasW, Math.round(1200 * seen12.exportDpr),
  '画布的像素底子也跟着换成高密度（' + (seen12 && seen12.canvasW) + ' = 1200 × ' + (seen12 && seen12.exportDpr) + '）');
assert(!!seen12 && seen12.w > 0 && seen12.h > 0,
  '抠图那一段的矩形是算出来的（' + (seen12 && Math.round(seen12.w)) + '×' + (seen12 && Math.round(seen12.h)) + '）');
eq2(WB.state.view.scale, 0.69, '完事把用户的缩放还回去（0.69）');
eq2(WB.state.exportDpr, null, '临时的像素密度也清掉（不然屏幕会一直按高密度画）');
eq2(canvasEl.width, 1200, '画布的像素底子也还原（1200）');
WB.state.view.scale = 1;
WB.redraw();

/* 在板上落笔就把菜单收起来（跟系统的下拉一个脾气） */
eq2(WB.saveMenuOpen(), true, '前提：菜单还开着');
canvasEl._h.pointerdown(pe(700, 600));
eq2(WB.saveMenuOpen(), false, '在板上落一笔 → 保存菜单自己收起来');

/* ---- 「上传我的题」：在底部那条工具条上，点了给一句实话 ---- */
__capture.toasts.length = 0;
WB.askUpload();
eq2(__capture.toasts.length, 1, '点「上传我的题」→ 给出一句话（不是一个没反应的假按钮）');
assert(__capture.toasts[0].indexOf('拍照上传还在做') >= 0,
  '这句话是实话：拍照上传还在做（实际 "' + __capture.toasts[0] + '"）');
assert(__capture.toasts[0].indexOf('题库') >= 0, '还给了现在就能走的一条路（去题库挑题）');

/* ============================================================
   13. 橡皮：圆圈擦到哪里，哪里才没（不是碰到就整笔删掉）
   ============================================================ */
/* 一条横线，圆心正落在它的中点上：应断成两截，而且两头各自留一段 */
var seg13 = { color: '#111', width: 2, points: [{ x: 0, y: 100, p: 0.5 }, { x: 200, y: 100, p: 0.5 }] };
var cut13 = WB.polylinesAfterErase(seg13, 100, 100, 20);
assert(cut13 && cut13.length === 2,
  '横线被圆圈咬住中间 → 断成两截（实际 ' + (cut13 ? cut13.length : 'null') + ' 截）');
assert(cut13[0][cut13[0].length - 1].x <= 81 && cut13[0][cut13[0].length - 1].x >= 79,
  '左截的断口落在圆的左边界上（实际 x=' + (cut13 ? cut13[0][cut13[0].length - 1].x.toFixed(1) : '') + '）');
assert(cut13[1][0].x >= 119 && cut13[1][0].x <= 121,
  '右截的断口落在圆的右边界上（实际 x=' + (cut13 ? cut13[1][0].x.toFixed(1) : '') + '）');
assert(cut13[0].length === 2 && cut13[1].length === 2, '每一截只有两个端点（几何切断，不是按点删）');

/* 圆心远离这条线：一个点都不该动 —— 返回 null 表示"没碰到"，不是"擦光了" */
assert(WB.polylinesAfterErase(seg13, 100, 400, 20) === null, '圆没碰到 → 返回 null（原样不动）');

/* 圆正好压在端点上：只吃掉那一头，剩下一条完整的 */
var cut13b = WB.polylinesAfterErase(seg13, 0, 100, 20);
assert(cut13b && cut13b.length === 1 && cut13b[0][0].x >= 19 && cut13b[0][0].x <= 21,
  '圆咬住左端点 → 只剩一条，断口在 x≈20（实际 ' + (cut13b && cut13b[0][0].x.toFixed(1)) + '）');

/* 整条都在圆里：什么都不剩 */
assert(WB.polylinesAfterErase(seg13, 100, 100, 300).length === 0, '整条都在圆里 → 什么都不剩');

/* 矩形只被咬了左下角：另外三条边应当**整条留下** */
var rect13 = { type: 'rect', color: '#111', width: 2, points: [{ x: 0, y: 0 }, { x: 100, y: 60 }] };
var rectCut13 = WB.polylinesAfterErase(rect13, 0, 60, 12);
assert(rectCut13 && rectCut13.length >= 3,
  '矩形只被咬掉左下角，其余三条边还在（实际 ' + (rectCut13 ? rectCut13.length : 'null') + ' 条）');
assert(WB.polylinesAfterErase(rect13, 50, 30, 8) === null, '圆落在矩形**内部**（没碰到边框）→ 不动它');

/* 箭头：杆被咬中间，两支头还在（所以箭头不会因为擦一下就没头） */
var arr13 = { type: 'arrow', color: '#111', width: 3, points: [{ x: 0, y: 0 }, { x: 200, y: 0 }] };
var arrCut13 = WB.polylinesAfterErase(arr13, 100, 0, 20);
assert(arrCut13 && arrCut13.length === 4,
  '箭头杆断成两截 + 两支头仍在（实际 ' + (arrCut13 ? arrCut13.length : 'null') + ' 段）');

/* 真擦：板上那一条被咬过之后，笔数变多（一截一条），并且原对象没被改 */
WB.clearAll();
var orig13 = { color: '#111', width: 2, points: [{ x: 0, y: 100, p: 0.5 }, { x: 200, y: 100, p: 0.5 }] };
var origPts13 = JSON.stringify(orig13.points);
WB.state.strokes.push(orig13);
var changed13 = WB.eraseRegionAt(100, 100, 20);
assert(changed13 === 1, '擦到 1 笔（实际 ' + changed13 + '）');
assert(WB.state.strokes.length === 2, '板上变成两截（实际 ' + WB.state.strokes.length + ' 笔）');
assert(JSON.stringify(orig13.points) === origPts13,
  '原来那一笔**一个点都没被改**（撤销靠的就是它完好）');
assert(WB.state.strokes[0].points[0].x === 0 && WB.state.strokes[1].points[1].x === 200,
  '两截合起来仍覆盖原来的两端');

/* 撤销：一次擦除整拖撤销，回到未擦之前 */
WB.state.actions.length = 0;
WB.state.redo.length = 0;
WB.state.strokes.length = 0;
WB.state.strokes.push(orig13);
var before13 = WB.state.strokes.slice();
WB.eraseRegionAt(100, 100, 20);
WB.commitAction({ type: 'region', label: '擦除', before: before13, after: WB.state.strokes.slice() });
assert(WB.state.strokes.length === 2, '前提：擦完是两截');
WB.undo();
assert(WB.state.strokes.length === 1 && WB.state.strokes[0] === orig13,
  '撤销回到原来那一整条（实际 ' + WB.state.strokes.length + ' 笔）');
WB.redo();
assert(WB.state.strokes.length === 2, '重做又变回两截（实际 ' + WB.state.strokes.length + ' 笔）');
WB.state.actions.length = 0;
WB.state.redo.length = 0;

/* 笔尖 / 橡皮的圆圈：跟着鼠标、按工具藏起系统光标、半径算得对 */
WB.setTool('eraser');
assert(WB.state.tool === 'eraser', '切到橡皮工具');
canvasEl._h.pointermove(pe(300, 200));
assert(WB.state.tipAt && Math.abs(WB.state.tipAt.x - 300) < 1 && Math.abs(WB.state.tipAt.y - 200) < 1,
  '圆圈跟着鼠标走（实际 ' + (WB.state.tipAt ? WB.state.tipAt.x + ',' + WB.state.tipAt.y : 'null') + '）');
assert(canvasEl.style.cursor === 'none',
  '橡皮工具时把系统光标藏起来，只留那个圈（实际 ' + canvasEl.style.cursor + '）');
__ctxCalls.arcs.length = 0;
WB.redraw();
assert(__ctxCalls.arcs.length === 1, '画了一个圈（实际 ' + __ctxCalls.arcs.length + ' 个）');
var ringE13 = __ctxCalls.arcs.length ? __ctxCalls.arcs[0] : null;
assert(ringE13 && Math.abs(ringE13.r - WB.state.eraser) < 0.01,
  '橡皮圈的半径就是橡皮大小（' + (ringE13 ? ringE13.r : '没画圈') + ' vs ' + WB.state.eraser + '）—— 屏幕像素，不跟缩放');
assert(ringE13 && Math.abs(ringE13.x - 300) < 1 && Math.abs(ringE13.y - 200) < 1,
  '圈画在鼠标位置');

/* 画笔也一样：圆圈代替十字（原来 #wb-canvas 上是 cursor:crosshair） */
WB.setTool('pen');
assert(canvasEl.style.cursor === 'none',
  '画笔工具也藏起系统光标（实际 ' + canvasEl.style.cursor + '）');
WB.setWidth(6);
WB.state.view.scale = 2;
__ctxCalls.arcs.length = 0;
WB.redraw();
var ringP13 = __ctxCalls.arcs.length ? __ctxCalls.arcs[0] : null;
assert(ringP13 && Math.abs(ringP13.r - 6) < 0.01,
  '粗笔在 2 倍缩放下圈半径 = 6×2/2 = 6（实际 ' + (ringP13 ? ringP13.r : '没画圈') + '）');
WB.setWidth(2.2);
__ctxCalls.arcs.length = 0;
WB.redraw();
var ringT13 = __ctxCalls.arcs.length ? __ctxCalls.arcs[0] : null;
assert(ringT13 && Math.abs(ringT13.r - 3) < 0.01,
  '细笔的真实笔尖只有 2.2×2/2 = 2.2px 半径，会看不见，落到 3px 的下限（实际 ' + (ringT13 ? ringT13.r : '没画圈') + '）');
assert(canvasEl.style.cursor === 'none', '细笔时仍然不显示十字');

/* 图形工具保持十字：画框要的是准，不是笔粗 —— 所以不画圈、光标交回 CSS 的 crosshair */
WB.setTool('rect');
assert(canvasEl.style.cursor === '', '图形工具交回 CSS 光标（空值 → #wb-canvas 的 crosshair）');
WB.state.view.scale = 1;
__ctxCalls.arcs.length = 0;
WB.redraw();
assert(__ctxCalls.arcs.length === 0, '图形工具不画笔尖圈（实际 ' + __ctxCalls.arcs.length + ' 个）');

/* 鼠标离开画布，圈收掉 */
WB.setTool('pen');
canvasEl._h.pointerleave();
assert(WB.state.tipAt === null, '鼠标离开画布，笔尖圈收掉');

WB.clearAll();
WB.setTheme('white');
WB.redraw();

/* ============================================================
   14. 网格三档：小 20 / 中 40 / 大 80
   ------------------------------------------------------------
   三档只换"基数"，drawGrid() 里那两条随缩放自动加密 / 减疏的修正一字不改。
   断言分两路，缺一不可：
     a) 量**画出来的线**的间距（不是量状态里的数）—— 否则把 gridSize 存下来、
        drawGrid() 里继续写死 40，一样能过。
     b) 把缩放从 0.15 拉到 8，三档的实际间距始终落在 14～96 像素内。
   ============================================================ */
var GS = WB.config.GRID_SIZES;
assert(GS && GS.length === 3, '网格梯子有三档（实际 ' + (GS ? GS.length : '没有') + ' 档）');
assert(GS && GS.map(function (g) { return g.value; }).join(',') === '20,40,80',
  '三档是 20 / 40 / 80（实际 ' + (GS ? GS.map(function (g) { return g.value; }).join(' / ') : '') + '）');
assert(WB.state.gridSize === 40, '默认中档 40（实际 ' + WB.state.gridSize + '）');

/* 量竖直网格线的间距：清空笔迹、收起题面，板上就只剩网格线了。
   桩记录的是 moveTo / lineTo 的**原始参数**，也就是世界坐标 ——
   真正的画布上世界坐标要经过 setTransform 的 scale 才是屏幕像素，
   所以这里必须自己乘一次 scale，否则量到的是世界单位（缩放一变就对不上）。 */
function gridStepPx() {
  __ctxCalls.segs.length = 0;
  WB.redraw();
  var scale = WB.state.view.scale;
  var xs = [];
  __ctxCalls.segs.forEach(function (s) {
    if (s.x0 === s.x1 && xs.indexOf(s.x0) < 0) xs.push(s.x0);
  });
  xs.sort(function (a, b) { return a - b; });
  return xs.length > 1 ? (xs[1] - xs[0]) * scale : 0;
}

WB.clearAll();
WB.setShowProblem(false);
WB.setGrid(true);
WB.state.view.scale = 1;

WB.setGridSize(20);
var stepSmall = gridStepPx();
assert(Math.abs(stepSmall - 20) < 0.001,
  '一百%下小档画出来的格子间距 = 20px（实际 ' + stepSmall + '）—— 量的是画出来的线，不是状态里的数');
WB.setGridSize(40);
var stepMid = gridStepPx();
assert(Math.abs(stepMid - 40) < 0.001, '中档 = 40px（实际 ' + stepMid + '）—— 与改动前的观感一致');
WB.setGridSize(80);
var stepBig = gridStepPx();
assert(Math.abs(stepBig - 80) < 0.001, '大档 = 80px（实际 ' + stepBig + '）');
assert(stepSmall < stepMid && stepMid < stepBig, '疏密方向对：小档格子最小、大档最大');

/* 疏密保证：三档 × 整条缩放范围 */
var clampBad = [];
[20, 40, 80].forEach(function (size) {
  [0.15, 0.25, 0.5, 1, 2, 4, 8].forEach(function (k) {
    WB.state.view.scale = k;
    WB.setGridSize(size);
    var d = gridStepPx();
    if (!(d >= 14 - 0.01 && d <= 96 + 0.01)) clampBad.push(size + '@' + k + 'x=' + Math.round(d * 100) / 100);
  });
});
assert(clampBad.length === 0,
  '缩放 0.15～8 之间三档的格子间距始终在 14～96px 内（越界的：' + (clampBad.join(' ') || '没有') + '）');
WB.state.view.scale = 1;

/* 决定 #4：选疏密顺手把网格打开；但点颜色 / 笔粗不该把网格带开 */
WB.setGrid(false);
WB.setGridSize(80);
assert(WB.state.grid === true, '网格关着时选一档 → 顺手把网格打开（实际 ' + WB.state.grid + '）');
WB.setGrid(false);
WB.setColor(WB.COLORS[0].value);
assert(WB.state.grid === false, '选颜色不会把网格带开（只有选疏密才联动）');
WB.setWidth(WB.WIDTHS[0].value);
assert(WB.state.grid === false, '选笔粗也不会把网格带开');

/* 拾取器内容：三档都在，且预览方块是"数值小的更密" */
var gridHtml = elById('wb-grids').innerHTML;
assert(gridHtml.indexOf('data-wb-grid="20"') >= 0 && gridHtml.indexOf('data-wb-grid="40"') >= 0 &&
  gridHtml.indexOf('data-wb-grid="80"') >= 0, '设置里的网格拾取器生成了三档');
assert(gridHtml.indexOf('wb-grid__chip') >= 0, '每档带一个疏密预览方块（不用点开就知道哪档更密）');

/* 落盘与恢复：坏值一律不生效，恢复之后疏密必然落在梯子里 */
WB.setGridSize(20);
var storedG = JSON.parse(window.localStorage.getItem('wkmath.whiteboard.v1'));
assert(storedG.gridSize === 20, '疏密写进本地存储（实际 ' + (storedG ? storedG.gridSize : '没写') + '）');
WB.state.gridSize = 40;
WB.restore();
assert(WB.state.gridSize === 20, '刷新后恢复存过的疏密（实际 ' + WB.state.gridSize + '）');
/* restore 在启动时跑，那一刻 state.gridSize 就是默认的 40。
   存了个不在梯子里的值（55）时不能被采纳 —— 否则 drawGrid 会拿到 55 这个基数，
   一百%下画出来的格子是 55px，跑到梯子外面去了。 */
window.localStorage.setItem('wkmath.whiteboard.v1',
  JSON.stringify({ gridSize: 55, grid: true, strokes: [] }));
WB.state.gridSize = 40;
WB.restore();
assert(WB.state.gridSize === 40,
  '存了个不在梯子里的疏密（55）→ 不采纳，保持默认中档 40（实际 ' + WB.state.gridSize + '）');
WB.state.gridSize = 40;
WB.restore();
assert([20, 40, 80].indexOf(WB.state.gridSize) >= 0, '恢复之后疏密一定落在梯子里');
assert(WB.setGridSize(55) === false, '不在梯子里的值传进来，直接不认（返回 false）');

/* 收尾：把板面恢复到默认，免得影响后面的检查 */
WB.setShowProblem(true);
WB.setGridSize(40);
WB.setGrid(true);
WB.redraw();

/* ============================================================
   15. 手写转文字：只认题面外的笔迹 → 落到题目下方 → 每步带点评
   ------------------------------------------------------------
   本版不接真 AI（预置数据），所以最要紧的两条不是"识别准不准"，而是：
     a) **没写东西就不装** —— 不许凭空变出一段用户没写过的字；
     b) 面板贴在题目下方、按题目 id 各存各的，不串台。
   ============================================================ */
var INK = window.WK_INK_TEXT;
/* 本节统一用 eq2 的契约（实际, 期望, 说明），起个别名免得每行都写 eq2 */
var eq = eq2;
assert(!!INK, '转文字的预置模块已加载');
assert(INK && INK.TONES.length === 3, '语气标只有三种取值（成立 / 可以更严谨 / 这一步有问题）');

/* ---- 范围判定：题面框外的才算"你写的" ---- */
var box0 = { x: 100, y: 100, w: 200, h: 80 };
function st(pts) { return { color: '#000', width: 3, points: pts.map(function (p) { return { x: p[0], y: p[1] }; }) }; }
var inside = st([[120, 120], [140, 130], [160, 140]]);
var outside = st([[400, 400], [430, 420], [460, 440]]);
var half = st([[120, 120], [400, 400]]);        // 正好一半在里面
var mostlyOut = st([[120, 120], [400, 400], [430, 420]]);   // 1/3 在里面
eq(INK.outsideStrokes([inside], box0).length, 0, '整条都在题面框里 → 不算（那是圈已知条件）');
eq(INK.outsideStrokes([outside], box0).length, 1, '整条都在框外 → 算');
eq(INK.outsideStrokes([half], box0).length, 0, '正好一半在框里的不算（严格过半才收，宁可少收）');
eq(INK.outsideStrokes([mostlyOut], box0).length, 1, '过半在框外 → 算');
eq(INK.outsideStrokes([inside, outside, mostlyOut], box0).length, 2, '混在一起也能挑对（3 条里收 2 条）');
eq(INK.outsideStrokes([], box0).length, 0, '没笔迹就是空的（不炸）');
eq(INK.outsideStrokes([outside], { x: 0, y: 0, w: 0, h: 0 }).length, 0, '题面框无效时一律不收（别把满板都当思路）');

/* ---- 没写东西就"不装" ---- */
WB.clearAll();
WB.applyProblem('7a-01');
WB.setShowProblem(true);
WB.state.view.scale = 1;
WB.redraw();

var inkPanel = elById('wb-ink-text');
var inkBtn = elById('wb-act-transcribe');
eq(inkPanel.hidden, true, '默认收着');

WB.toggleTranscribe();
eq(WB.state.ink.open, true, '点「转文字」→ 打开面板');
eq(inkPanel.hidden, false, '面板露出来了');
eq(WB.inkOutside().length, 0, '此刻题面外一笔都没有');
eq(WB.inkSteps().length, 0, '**不给内容** —— 不许凭空变出一段用户没写过的字');
assert(inkPanel.innerHTML === undefined || elById('wb-ink-note').textContent.indexOf('还没有笔迹') >= 0,
  '只给一句实话（实际 ' + elById('wb-ink-note').textContent + '）');
eq(elById('wb-ink-badge').hidden, true, '没有内容时不挂「演示」标（空面板不装样子）');
eq(elById('wb-ink-acts').hidden, true, '没有内容时不显示"重新识别 / 移除"（点了也没用）');

/* ---- 题面外写了东西 → 转出分步文字 + 每步点评 ---- */
WB.clearAll();
WB.applyProblem('7a-01');
/* 题面框的位置按算出来的走，不写死坐标 —— 题面宽度是随题目长度变的，
   写死一组数看着"在里面"，其实早跑到框外去了（第一版就这么错了一回）。 */
var pb15 = WB.problemLayout();
draw([[pb15.x + 12, pb15.y + 12], [pb15.x + 40, pb15.y + 24], [pb15.x + 60, pb15.y + 30]]);  // 框里：圈注
draw([[pb15.x, pb15.y + pb15.h + 120], [pb15.x + 60, pb15.y + pb15.h + 160],
      [pb15.x + 120, pb15.y + pb15.h + 140]]);                                               // 框外：思路
eq(WB.inkOutside().length, 1, '题面里的那条不算，题面外的才算（框内 1 条 + 框外 1 条）');
WB.toggleTranscribe();                                // 先收起
WB.toggleTranscribe();                                // 再打开 → 这次有内容
var steps15 = WB.inkSteps();
assert(steps15.length >= 2, '转出了分步骤的文字（实际 ' + steps15.length + ' 步）');
assert(steps15.every(function (s) { return s.text && s.tone && s.comment; }),
  '每一步都有文字、语气标、点评（缺一不可 —— 只转文字不点评就少了一半）');
assert(steps15.every(function (s) { return INK.TONES.indexOf(s.tone) >= 0; }), '语气标的取值都在三种里');
eq(elById('wb-ink-badge').hidden, false, '有内容时挂上「演示」标（预置数据不是真识别，必须说清）');
assert(elById('wb-ink-note').textContent.indexOf('演示') >= 0,
  '面板里写明这是本机演示数据（实际 ' + elById('wb-ink-note').textContent + '）');
eq(elById('wb-ink-acts').hidden, false, '有内容时才显示那两个动作按钮');
var listHtml = elById('wb-ink-steps').innerHTML;
assert(listHtml.indexOf('can\'t') < 0 && listHtml.indexOf('第 1 步') >= 0, '第 1 步的编号进了内容');
assert(listHtml.indexOf('contenteditable="true"') >= 0, '文字那一格可编辑（识别一定会出错，必须能改）');
assert(listHtml.indexOf('data-step="0"') >= 0, '每一格带自己的序号（改哪一步要能对上）');
assert(listHtml.indexOf('wb-tile__tone') >= 0 && listHtml.indexOf('成立') >= 0, '点评前面挂着语气标');

/* ---- 位置是它自己的一份：题目挪了它不动（用户原话"题目周围干干净净"） ---- */
WB.setShowProblem(true);
WB.redraw();
var inkL15 = inkPanel.style.left;
var inkT15 = inkPanel.style.top;
WB.state.problemAt.x = WB.state.problemAt.x + 120;
WB.redraw();
eq(inkPanel.style.left, inkL15, '题面右移 → 转译窗口原地不动（它有自己的位置，不挂在题目上）');
eq(inkPanel.style.top, inkT15, '竖直方向也不动');
WB.state.problemAt.x = WB.state.problemAt.x - 120;

/* 拖它自己的标题栏 → 只它自己动 */
var inkHead15 = elById('wb-ink-head');
var inkShot = parseFloat(inkPanel.style.left);
inkHead15._h.pointerdown(pe(300, 200));
inkHead15._h.pointermove(pe(340, 200));
inkHead15._h.pointerup(pe(340, 200));
eq(Math.round(parseFloat(inkPanel.style.left) - inkShot), 40, '拖转译窗口的标题栏 → 它自己横移 40px');

WB.setShowProblem(false);
WB.redraw();
eq(inkPanel.hidden, true, '题面收起 → 面板一起收起，不留在板上当幽灵');
WB.setShowProblem(true);
WB.redraw();
eq(inkPanel.hidden, false, '题面回来 → 面板也回来');

/* ---- 编辑：改完不能被打断，也不能丢 ---- */
WB.state.ink.steps[0].text = '我改了第一步';
var fakeCell = mkEl('div');
fakeCell.setAttribute('data-step', '0');
fakeCell.textContent = '我改了第一步';
elById('wb-ink-steps')._h.input({ target: fakeCell });
var storedInk = JSON.parse(window.localStorage.getItem(WB.inkKey()));
eq(storedInk['7a-01'].steps[0].text, '我改了第一步', '改完立刻落盘');
WB.redraw();
assert(elById('wb-ink-steps').innerHTML.indexOf('contenteditable') >= 0 &&
  WB.inkSteps()[0].text === '我改了第一步',
  '重绘之后编辑内容还在（面板不重建 DOM，光标才不会被输入打断）');

/* ---- 按题目 id 各存各的，不串台 ---- */
WB.toggleTranscribe();                                // 收起
WB.applyProblem('7a-02');
eq(WB.state.ink.open, false, '收起状态下换题，面板不会自己弹出来');
WB.clearAll();
draw([[60, 300], [120, 340]]);
WB.toggleTranscribe();
assert(WB.inkSteps().length >= 1 && WB.inkSteps()[0].text !== '我改了第一步',
  '换到另一题 → 面板里是这一题的内容（不是上一题那段）');
var stored2 = JSON.parse(window.localStorage.getItem(WB.inkKey()));
assert(stored2['7a-01'] && stored2['7a-02'], '两题各存一份（实际存了 ' + Object.keys(stored2).join('、') + '）');
eq(stored2['7a-01'].steps[0].text, '我改了第一步', '第一题那份没被第二题覆盖');

/* 换回收起的总览（外部点名）时面板也该跟着收 */
WB.toggleTranscribe();
WB.applyExternal({ text: '外部点名的一道题', tag: '', extra: '' });
eq(WB.state.ink.open, false, '换到外部题面时面板仍是收起的');

/* ---- 重新识别 / 移除 ---- */
WB.clearAll();
WB.applyProblem('7a-03');
var pb15b = WB.problemLayout();
draw([[pb15b.x, pb15b.y + pb15b.h + 120], [pb15b.x + 60, pb15b.y + pb15b.h + 150]]);
WB.toggleTranscribe();
/* 走**真实路径**改一个字：contenteditable 上打字 → input 事件 → 落盘。
   直接改内存数组不是用户可以走到的路径，拿它当测试会得到一个假结论。 */
var editCell = mkEl('div');
editCell.setAttribute('data-step', '0');
editCell.textContent = '我改的第一步';
elById('wb-ink-steps')._h.input({ target: editCell });
WB.toggleTranscribe();                                // 收起
WB.toggleTranscribe();                                // 重开
eq(WB.inkSteps()[0].text, '我改的第一步',
  '重新打开读的是存过的记录 —— 用户改过的内容不会被预置数据冲掉');
WB.transcribe();
assert(WB.inkSteps()[0].text !== '我改的第一步',
  '点「重新识别」→ 重新跑一遍，覆盖掉（实际 "' + WB.inkSteps()[0].text + '"）');
WB.inkDrop('7a-03');
eq(WB.inkRecord('7a-03'), null, '移除之后这一题的记录没了');
eq(WB.inkOutside().length, 1, '但笔迹还在（移除的是文字，不动画布）');

/* ---- 坏数据不崩 ---- */
window.localStorage.setItem(WB.inkKey(), '{不是 JSON');
eq(WB.inkRecord('7a-01'), null, '存的不是 JSON → 当没转过（不崩）');
window.localStorage.setItem(WB.inkKey(), JSON.stringify({ '7a-01': { steps: [{ text: 'x', tone: '乱写', comment: '' }] } }));
var rec15 = WB.inkRecord('7a-01');
eq(rec15 && rec15[0].tone, 'ok', '认不出的语气标回落成立（否则界面上是个没颜色的怪标）');
window.localStorage.setItem(WB.inkKey(), JSON.stringify({ '7a-01': { steps: [] } }));
eq(WB.inkRecord('7a-01'), null, '空步骤等于没转过');

/* ---- 「清空画布」只清笔迹，不动已经转出来的文字 ---- */
window.localStorage.setItem(WB.inkKey(), JSON.stringify({}));
WB.clearAll();
WB.applyProblem('7a-13');
draw([[60, 300], [120, 340]]);
WB.toggleTranscribe();
var inkCount15 = WB.inkSteps().length;
WB.clearAll();
eq(WB.state.strokes.length, 0, '清空画布：笔迹没了');
eq(WB.inkSteps().length, inkCount15, '但转出来的文字还留着（那是你存下来的东西，要删用面板上的「移除」）');


/* ============================================================
   16. 板面主题与「阅读与显示」的配色是同一个真值
   ------------------------------------------------------------
   两个开关各写各的状态迟早会打架（在板里选黑板、设置页却还写着亮色）。
   所以只留一份：在板里切 = 整站跟着切；设置里切 = 板面跟着换。
   ============================================================ */
WB.setTheme('dark');
eq(window.localStorage.getItem('wkmath.display.theme'), 'dark', '在白板里切「黑板」＝整站配色切到暗色');
eq(__displayState.theme, 'dark', '写进的是那一份真值，不是白板自己另存一份');
eq(__displayState.fs, 'std', '切板面不碰字号（白板管不着字号）');
eq(WB.theme().key, 'dark', '板面确实是黑板');
WB.setTheme('white');
eq(window.localStorage.getItem('wkmath.display.theme'), 'light', '切回「白板」＝整站配色回到亮色');

/* 设置页那边改了配色（真实页面里 display.js 会派一个 wk:display）→ 板面当场跟着换 */
window.WK_DISPLAY.set({ theme: 'mid' });
eq(WB.theme().key, 'mid', '设置里选「中色」→ 板面当场换成中板');
eq(WB.state.strokes.length, 0, '换板面只是换配色，不该产生笔迹');

/* ---- 收尾 ---- */
WB.clearAll();
WB.applyProblem(null);
WB.state.ink.open = false;
WB.state.ink.steps = [];
window.localStorage.removeItem(WB.inkKey());
WB.redraw();

out(__fail ? 'RESULT: 有失败项' : 'RESULT: 全部通过');
