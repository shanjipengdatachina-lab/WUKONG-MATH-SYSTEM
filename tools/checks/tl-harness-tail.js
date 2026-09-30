/* ============================================================
   时间轴引擎自检 —— 断言
   ------------------------------------------------------------
   这套断言凭什么值钱，两句话：
     · 轴、刻度、彩条、缩略条全画在 canvas 上、DOM 里几乎是空壳 —— 静态体检只能 grep 字符串，
       这里用桩把每一笔记下来量**几何**（网格几条线、滑块百分之几、彩条用没用状态色）；
     · 视图模型（缩放 / 平移 / 适配）与白板同源，是这一页最贵的一段逻辑 ——
       "锚点缩放真的没动"这种事实肉眼看不出，只能算。
   ============================================================ */
var TK = window.WK_TIMELINE;
var AX = ctx;                 /* 数轴那块画布 */
var MINI = miniCtx;           /* 缩略条那块画布 */
var N = TK.axis.items.length;
var SEGS = TK.axis.segs;
var LEARN = TK.learn;

assert(!!TK && !!TK.view && N > 0, '引擎已初始化并暴露测试接口（WK_TIMELINE）');
assert(canvasEl.width === 2400 && canvasEl.height === 1400,
  '画布按设备像素比放大（1200×700 @dpr2 —— 不放大就是糊的）');

/* ------------------------------------------------------------ *
 * 1. 刻度：六级、来自图谱、首尾相接
 * ------------------------------------------------------------ */
out('---- 刻度 ----');
assert(N === 769, '一条完整的数轴一共 769 格（实际 ' + N + '）');
assert(SEGS.length === 6, '六级刻度（分段 / 年级 / 册·板块 / 章 / 节 / 知识点）');
var counts = SEGS.map(function (l) { return l.length; });
assert(counts.join(',') === '4,11,27,185,520,278', '各级条数 4 / 11 / 27 / 185 / 520 / 278（实际 ' + counts.join('/') + '）');

/* 段是**左闭右开**（start..end-1）：四个学段正好把 769 格分成四份 */
var stages = SEGS[0].map(function (s) { return s.stage + ':' + s.start + '-' + s.end; }).join(' ');
assert(stages === 'primary:0-380 junior:380-662 senior:662-739 olympiad:739-769',
  '四个学段首尾相接、正好盖住整条轴（实际 ' + stages + '）');

/* 严丝合缝的那三级：学段 / 册·板块 / 章 中间不许有缝、也不许叠 */
function holes(list) {
  var n = 0;
  for (var i = 0; i + 1 < list.length; i += 1) { if (list[i].end !== list[i + 1].start) { n += 1; } }
  if (list.length && list[0].start !== 0) { n += 1; }
  if (list.length && list[list.length - 1].end !== N) { n += 1; }
  return n;
}
assert(holes(SEGS[0]) === 0 && holes(SEGS[2]) === 0 && holes(SEGS[3]) === 0,
  '学段 / 册·板块 / 章 三级严丝合缝（无缝隙也不重叠）');
/* 年级这一级是**推出来的**：竞赛那四支没有年级（gradeOf 返回空），所以只有 11 条 */
assert(SEGS[1].length === 11 && SEGS[1][SEGS[1].length - 1].end === 739,
  '年级只有 11 条、到高中为止 —— 竞赛没有年级，不该硬塞一个');
/* 知识点这一级只出现在**有细分**的格子里（图谱里点=knowledge point 的那些），所以是稀疏的 */
assert(SEGS[5][0].start >= 380 && SEGS[5][SEGS[5].length - 1].end <= 662,
  '知识点这一级只落在初中那一段的细分格上（不是每节都有）');
var chainLens = TK.axis.items.map(function (it) { return it.chain.length; });
var chainOk = TK.axis.items.every(function (it) {
  if (!it.name || !it.chain.length || it.chain[0].depth !== 0) { return false; }
  for (var i = 1; i < it.chain.length; i += 1) {
    if (it.chain[i].depth <= it.chain[i - 1].depth) { return false; }
  }
  return true;
});
assert(chainOk, '每一格都带着自己的路径：由粗到细、起点一定是学段（实测 ' +
  Math.min.apply(null, chainLens) + '–' + Math.max.apply(null, chainLens) + ' 段 —— 竞赛那几支没有年级，所以到不了 6 段）');
assert(TK.axis.items[0].x === 0.5 && TK.axis.items[768].x === 768.5,
  '格的中心落在 i+0.5（轴的坐标口径：一格占 1 个世界单位）');

/* ------------------------------------------------------------ *
 * 2. 视图模型：适配 / 缩放（锚点不动）/ 平移
 * ------------------------------------------------------------ */
out('---- 视图模型 ----');
var FIT = TK.view.fit;
assert(Math.abs(TK.view.scale - FIT) < 1e-9 && Math.abs(FIT - 1.368940) < 1e-5,
  '一进页面就是"适配"档（scale === fit，读数 100%）：' + FIT.toFixed(6));

TK.zoomBy(2);
assert(Math.abs(TK.view.scale - FIT * 2) < 1e-9, '放大一档 = 缩放翻倍');
assert(TK.view.fit === FIT, '缩放不动"适配"这个基准（读数才是老实话）');

/* 锚点缩放：屏幕上的那个点，缩放前后**指着同一个世界坐标** ——
   这一条错了就是"一放大就跑到别处去了"，而这在静态体检里完全看不见。 */
var anchorX = 500;
var world0 = (anchorX - TK.view.x) / TK.view.scale;
TK.zoomAt(anchorX, 2.5);
var world1 = (anchorX - TK.view.x) / TK.view.scale;
assert(Math.abs(world1 - world0) < 1e-9, 'zoomAt 是锚点缩放（锚点处的世界坐标不动：' + world0.toFixed(4) + ' → ' + world1.toFixed(4) + '）');
assert(Math.abs(TK.view.scale - FIT * 5) < 1e-9, 'zoomAt 的倍数作用在缩放上（2 × 2.5 = 5 倍）');

TK.zoomBy(1e6);
assert(Math.abs(TK.view.scale - FIT * 220) < 1e-6, '放大封顶 = 适配的 220 倍（再放大也就是一屏几格）');
TK.zoomBy(1e-9);
assert(Math.abs(TK.view.scale - FIT * 0.25) < 1e-6, '缩小封顶 = 适配的 1/4（再缩整条轴就成一根线了）');

TK.fit();
assert(Math.abs(TK.view.scale - FIT) < 1e-9, '「适配」把缩放折回基准值');

/* 平移：拖多少走多少（与白板同一套手感） */
var x0 = TK.view.x;
dragAxis(-120, 0);
assert(Math.abs(TK.view.x - (x0 - 120)) < 1e-9, '拖动 = 平移，位移与手指一致（Δx ' + (TK.view.x - x0) + '）');

/* ⌘/Ctrl + 滚轮 = 缩放，且同样是锚点缩放 */
TK.fit();
var wx = 400;
var w0 = (wx - TK.view.x) / TK.view.scale;
fire(canvasEl, 'wheel', pe(wx, 300, { ctrl: true, deltaY: -240 }));
assert(TK.view.scale > FIT && Math.abs((wx - TK.view.x) / TK.view.scale - w0) < 1e-9,
  '⌘/Ctrl + 滚轮 = 缩放（触控板捏合也走这一条），锚点同样不动');

/* 键盘：←→ 平移、0 适配 */
TK.fit();
var kx = TK.view.x;
fire(document, 'keydown', { key: 'ArrowLeft', preventDefault: function () {} });
assert(Math.abs(TK.view.x - (kx + 80)) < 1e-9, '← 平移一档（80px）');
fire(document, 'keydown', { key: '+' , preventDefault: function () {} });
assert(TK.view.scale > FIT, '+ 放大一档');
fire(document, 'keydown', { key: '0', preventDefault: function () {} });
assert(Math.abs(TK.view.scale - FIT) < 1e-9, '0 回到适配');

/* 阶段切换：不是筛选、是**换视野**（把这一段铺满屏幕） */
var junior = SEGS[0][1];
assert(TK.focusStage('junior') === true, '「阶段」能跳到初中段');
var vFrom = -TK.view.x / TK.view.scale;
var vTo = (TK.view.w - TK.view.x) / TK.view.scale;
assert(vFrom <= junior.start + 2 && vTo >= junior.end - 2,
  '跳到初中 = 把这一段铺满屏幕（视野 [' + vFrom.toFixed(0) + ',' + vTo.toFixed(0) + '] 覆盖 [' + junior.start + ',' + junior.end + ']）');
assert(TK.currentStage() === 'junior', '哪一段"正看着"是由视野算出来的');
TK.focusStage('');
assert(Math.abs(TK.view.scale - FIT) < 1e-9 && TK.currentStage() === '',
  '「全部」= 回适配档，且这时不再声称"正看某一段"（跳动后不会撒谎）');

/* ------------------------------------------------------------ *
 * 3. 画出来的东西（几何）
 * ------------------------------------------------------------ */
out('---- 画布几何 ----');
ctxReset(AX);
TK.redraw();
var t0 = AX.transforms[0];
var t1 = AX.transforms[1];
assert(t0 && t0.a === 2 && t0.d === 2 && t0.e === 0 && t0.f === 0,
  '清屏用的是设备像素变换（先按 dpr 清，不然 Retina 上只擦了左上角）');
assert(t1 && Math.abs(t1.a - 2 * TK.view.scale) < 1e-9 &&
  Math.abs(t1.e - 2 * TK.view.x) < 1e-9 && Math.abs(t1.f - 2 * TK.view.y) < 1e-9,
  '世界坐标 → 屏幕：setTransform(dpr×scale, …, dpr×x, dpr×y)');

assert(AX.dashes.length >= 1 && AX.dashes[0][0] > 0 && AX.dashes[0][1] > AX.dashes[0][0] * 10,
  '轴本身是**点线**（实 0.1 空 4，配圆头线帽 = 一串小圆点）');
var axisSeg = AX.segs.filter(function (s) {
  return s.y0 === 0 && s.y1 === 0 && Math.abs(s.x1 - s.x0) >= N;
});
assert(axisSeg.length === 1,
  '不管缩放到哪一档，画的都是**整条**数轴（一条从 -1 到 N+1 的横线，不随视野裁）');

/* 网格三档：疏密只听设定，条数应当成倍数关系（用户报过"网格大小设定无效"） */
function vlines() { return AX.segs.filter(function (s) { return s.x0 === s.x1 && Math.abs(s.y1 - s.y0) > 100; }).length; }
/* 注意顺序：setXxx 自己会 scheduleRedraw（桩里 rAF 是同步的）——
   先设、再清、最后手动重画，量到的才是**一帧**；先清后设就会把两帧加在一起（第一版量成了 2 倍）。 */
TK.setGrid(true, 20); ctxReset(AX); TK.redraw();
var v20 = vlines();
TK.setGrid(true, 40); ctxReset(AX); TK.redraw();
var v40 = vlines();
TK.setGrid(true, 80); ctxReset(AX); TK.redraw();
var v80 = vlines();
assert(v20 >= 40 && v20 <= 50, '网格 20 档：一屏约 44 条竖线（实际 ' + v20 + '）');
assert(v40 >= 20 && v40 <= 26, '网格 40 档：减半（实际 ' + v40 + '）');
assert(v80 >= 10 && v80 <= 14, '网格 80 档：再减半（实际 ' + v80 + '）');
assert(v20 > v40 && v40 > v80, '三档确实分得开（20 ≠ 40 ≠ 80，不是画了个一样的）');
TK.setGrid(false, 20); ctxReset(AX); TK.redraw();
assert(vlines() < 5, '关掉网格就没有格子了（实际 ' + vlines() + ' 条）');

/* 彩条：颜色 = 学习状态，且**默认不画**（用户："默认时不显示这些彩色的"） */
function barStyles(c) {
  var bars = ['--math-bar-ok', '--math-bar-gold', '--math-bar-first', '--math-bar-learn',
              '--math-bar-review', '--math-bar-weak', '--math-bar-idle'].map(function (k) { return TOK[k]; });
  var hit = {};
  c.fills.forEach(function (f) { if (bars.indexOf(f.style) >= 0) { hit[f.style] = 1; } });
  return Object.keys(hit);
}
TK.setMastery(false); ctxReset(AX); TK.redraw();
var offBars = barStyles(AX);
TK.setMastery(true); ctxReset(AX); TK.redraw();
var onBars = barStyles(AX);
var fillsOn = AX.fills.length;
assert(offBars.length === 0, '掌握度关着：轴上一个状态色都不出现（默认是一根干净的轴，只有刻度与名字）');
assert(onBars.length >= 3, '掌握度开着：彩条按学习状态上色（出现 ' + onBars.length + ' 种状态色）');
assert(fillsOn > N, '每一格都长出了一根条子（' + fillsOn + ' 次填充 ≥ 769 格）');
TK.setMastery(false);

/* 刻度与文字这一层：关掉就只剩轴、点与彩条 */
TK.setLevels(false); ctxReset(AX); TK.redraw();
var textsOff = AX.texts.length;
TK.setLevels(true); ctxReset(AX); TK.redraw();
var textsOn = AX.texts.length;
assert(textsOn >= 10 && textsOn > textsOff * 3,
  '「刻度与文字」整层可关（开 ' + textsOn + ' 段文字 / 关 ' + textsOff + ' 段）');

/* 四类标记的小图标：格子太窄不画，放大到一格 ≥12px 才画 */
var mk = -1;
for (var i = 0; i < LEARN.length; i += 1) { if (LEARN[i] && LEARN[i].mark) { mk = i; break; } }
TK.zoomBy(12);
TK.view.x = TK.view.w / 2 - (mk + 0.5) * TK.view.scale;
ctxReset(AX); TK.redraw();
var markTokens = ['--math-mark-key', '--math-mark-hard', '--math-mark-review', '--math-mark-block']
  .map(function (k) { return TOK[k]; });
var markHit = AX.strokes.filter(function (s) { return markTokens.indexOf(s.style) >= 0; }).length;
assert(markHit > 0, '放大到看得见一格时，被标过的格子上画出标记小图标（' + markHit + ' 笔，取的是 lucide 的路径）');
assert(__paths.length >= 2, '图标不另画一套：从页面那份 lucide 取路径拼成 Path2D（' + __paths.length + ' 条 path）');

/* 颜色纪律：画布上的颜色**一个都不是字面量**（§2.11 ⑨：亮 / 中 / 暗与七个高亮色都要自动生效） */
var tokVals = Object.keys(TOK).map(function (k) { return TOK[k]; });
var bad = [];
AX.fills.concat(AX.strokes).forEach(function (s) {
  if (tokVals.indexOf(s.style) < 0 && bad.indexOf(s.style) < 0) { bad.push(s.style); }
});
assert(bad.length === 0, '画布上的颜色全部来自令牌（没有写死的字面量）' + (bad.length ? '：' + bad.join('、') : ''));

/* ------------------------------------------------------------ *
 * 4. 点击 · 卡片 · 筛选四维
 * ------------------------------------------------------------ */
out('---- 卡片与筛选 ----');
TK.fit();
TK.setLevels(true);
TK.select(100);
assert(TK.cardIndex() === 100, '点一格 → 这一格成为观察节点');
assert(elFor('[data-tk-card]').hidden === false, '卡片弹出来了');
assert(elFor('[data-tk-card-name]').textContent === TK.axis.items[100].name,
  '卡片标题就是这一格的名字（' + elFor('[data-tk-card-name]').textContent + '）');
TK.closeCard();
assert(TK.cardIndex() === -1 && elFor('[data-tk-card]').hidden === true, 'Esc / × 关掉卡片');

function matchCount(pred) {
  var n = 0;
  for (var i = 0; i < LEARN.length; i += 1) { if (LEARN[i] && pred(LEARN[i])) { n += 1; } }
  return n;
}
var learnedN = matchCount(function (r) { return r.status !== '未开始'; });
assert(learnedN === TK.summary.learned,
  '「已学」的格数 = 记录里非"未开始"的格数（' + learnedN + '）');

TK.setFilter([], [], [], []);
assert(TK.filtered() === 0, '四维都不选 = 都不筛（空数组才是那个一眼就懂的默认）');

/* 每一维：筛掉的是"有记录但不命中"的格 —— 数轴本身一格不少（用户口径：数轴永远是一条完整的数轴） */
var hitStatus = matchCount(function (r) { return r.status === '已掌握'; });
TK.setFilter(['已掌握'], [], [], []);
assert(TK.filtered() === N - hitStatus, '掌握度这一维：筛掉 ' + TK.filtered() + ' 格（= 769 - 43 格已掌握）');
assert(TK.axis.items.length === N, '筛选只是**变淡**：轴上的格子一个都没少');

var hitMark = matchCount(function (r) { return r.mark === 'key'; });
TK.setFilter([], [], ['key'], []);
assert(TK.filtered() === N - hitMark, '标记这一维：只看标了"重点"的（筛掉 ' + TK.filtered() + ' 格）');

var hitMonth = matchCount(function (r) { return r.month === '2026-03'; });
TK.setFilter([], [], [], ['2026-03']);
assert(TK.filtered() === N - hitMonth, '时间段这一维：没学过的格子没有日期，选了月份就留不下来');

var hitDiff5 = matchCount(function (r) { return Math.max(1, Math.min(5, Math.round(r.diff))) === 5; });
TK.setFilter([], [5], [], []);
assert(TK.filtered() === N - hitDiff5, '难度这一维按 1–5 分档（筛掉 ' + TK.filtered() + ' 格）');

/* 维与维之间是"与"：多选一维只会更少 */
TK.setFilter(['已掌握'], [5], [], []);
var both = TK.filtered();
assert(both >= N - hitStatus && both >= N - hitDiff5,
  '维与维是"与"（同时给两个条件，筛掉的不少于任一单独条件：' + both + '）');
TK.setFilter(['已掌握', '学习中'], [], [], []);
assert(TK.filtered() === N - matchCount(function (r) { return r.status === '已掌握' || r.status === '学习中'; }),
  '同一维里多选是"或"');
assert(TK.filter().status.join(',') === '已掌握,学习中', 'filter() 把当前四维原样报出来（面板靠它回显）');
TK.setFilter([], [], [], []);

/* ------------------------------------------------------------ *
 * 5. 缩略条（第 9 条）：只在放大后出现，滑块 = 屏幕上的那一段
 * ------------------------------------------------------------ */
out('---- 缩略条 ----');
TK.fit();
assert(TK.mini().shown === false, '适配档（整条轴都在屏幕上）时不出现 —— 它只在"装不下"时才来');
TK.zoomBy(2);
assert(TK.mini().shown === true, '放大之后自动浮出来');
var visFrac = (TK.view.w / TK.view.scale) / N;
var wantW = visFrac * 100;
var gotW = parseFloat(TK.mini().width);
assert(Math.abs(gotW - wantW) < 2,
  '滑块的宽度 = 屏幕上正显示的那一段占整条轴的比例（' + gotW.toFixed(2) + '% ≈ ' + wantW.toFixed(2) + '%）');
TK.jumpMini(0.25);
var mid = (-TK.view.x + TK.view.w / 2) / TK.view.scale;
assert(Math.abs(mid - N * 0.25) < 0.01,
  '点 / 拖缩略条 = 把那一格挪到屏幕正中（视野中点落在 ' + mid.toFixed(2) + '，期望 ' + (N * 0.25).toFixed(2) + '）');
assert(TK.mini().left !== '' && parseFloat(TK.mini().width) > 0, '滑块的位置与宽度是实时写上去的（每帧跟着视野动）');

/* 拖缩略条不许抖（用户 2026-09-30："拖动滑块的时候时间轴抖动"）：
   根因是读数跟杆子抢宽度 —— 读数一变长，`flex:1` 的杆子就变窄，百分比映射跟着漂。
   现在读数换到上面一行、杆子定宽，而且**整段拖动只量一次**杆子的位置与宽度。 */
var trackEl = elFor('[data-tk-mini-track]');
var rectCalls = 0;
var origRect = trackEl.getBoundingClientRect;
trackEl.getBoundingClientRect = function () { rectCalls += 1; return origRect.call(trackEl); };
var widthBefore = TK.mini().width;
var leftBefore = TK.mini().left;
fire(trackEl, 'pointerdown', pe(0, 0, { id: 7 }));
fire(trackEl, 'pointermove', pe(120, 0, { id: 7 }));
fire(trackEl, 'pointermove', pe(240, 0, { id: 7 }));
fire(trackEl, 'pointerup', pe(240, 0, { id: 7 }));
assert(rectCalls === 1, '拖缩略条时杆子只量一次位置与宽度（量两次映射就会漂、时间轴就抖）：实际 ' + rectCalls + ' 次');
assert(TK.mini().width === widthBefore, '拖动只挪位置、不动宽度（缩放没变，框子就不该变：' + TK.mini().width + '）');
assert(TK.mini().left !== leftBefore, '拖动确实把视野挪过去了（框子位置变了：' + leftBefore + ' → ' + TK.mini().left + '）');
TK.fit();
assert(TK.mini().shown === false, '缩回适配档，它自己收起（不挡视线）');

/* ------------------------------------------------------------ *
 * 6. 面板内容 · 数据口径
 * ------------------------------------------------------------ */
out('---- 面板与口径 ----');
TK.setLegend(true);
var legendTxt = allText(elFor('[data-tk-legend-states]')) + '|' + allText(elFor('[data-tk-legend-marks]'));
assert(legendTxt.indexOf('已掌握') >= 0 && legendTxt.indexOf('重点') >= 0 && legendTxt.indexOf('待复习') >= 0,
  '图例条里排着七档状态 + 四类标记（不是面板，就是工具条上方那一行）');
assert(elFor('[data-tk-legend-states]').children.length === 7, '图例的七档状态一条不差（实际 ' + elFor('[data-tk-legend-states]').children.length + '）');
TK.setLegend(false);

/* 筛选卡里的胶囊：七档掌握度 + 5 档难度 + 4 类标记（与图例同一套记号） */
assert(elFor('[data-tk-filter-status]').children.length === 7 &&
  elFor('[data-tk-filter-diff]').children.length === 5 &&
  elFor('[data-tk-filter-mark]').children.length === 4,
  '筛选卡：掌握度 7 档 + 难度 5 档 + 标记 4 类');
assert(countIcons(elFor('[data-tk-filter-mark]')) === 4,
  '标记那一维的四个胶囊各带一个小图标（与图例条、轴上同一套记号）');

assert(elFor('#tk-grids').children.length === 3 && elFor('#tk-bar-levels').children.length === 3,
  '工具条上：网格三档 + 彩色条高度三档');

/* 阶段并进筛选卡（用户 2026-09-30："阶段可以整合到筛选里"）：
   那排胶囊现在住在筛选卡里 —— 点右侧那颗「筛选」把卡片打开它才被建出来；
   点一格是**换视野**（把这一段铺满屏幕），不产生任何筛选。 */
fire(elFor('#tk-filter'), 'click', {});
var stageBox = elFor('[data-tk-stage-chips]');
assert(elFor('[data-tk-filters]').hidden === false, '点右侧那颗「筛选」把筛选卡打开');
assert(stageBox.children.length === 1 + SEGS[0].length,
  '筛选卡最上面那行是"阶段"：全部 + 四个学段（' + stageBox.children.length + ' 个胶囊）');
var beforeStage = TK.view.scale;
/* 按**名字**找那颗胶囊（不按下标猜：下标错了断言就成了摆设） */
var juniorChip = null;
Array.prototype.forEach.call(stageBox.children, function (c) {
  if (c.textContent === SEGS[0][1].name) { juniorChip = c; }
});
assert(!!juniorChip, '那排胶囊上写着学段的名字（' + SEGS[0][1].name + '）');
fire(juniorChip, 'click', {});
assert(TK.currentStage() === SEGS[0][1].stage && TK.view.scale > beforeStage,
  '点「' + SEGS[0][1].name + '」→ 视野换到那一段（缩放读数跟着变，不是筛掉别的段）');
assert(TK.filtered() === 0, '点阶段不产生筛选（筛掉 0 格 —— 阶段换的是视野，与筛选两回事）');
TK.focusStage('');
fire(elFor('[data-tk-filters-close]'), 'click', {});
assert(elFor('[data-tk-filters]').hidden === true, '× 收起筛选卡');

/* 「学习计划设定」还只是个占位按钮（需求待定，§2.11 ⑤）—— 点了要给一句实话 */
fire(elFor('#tk-plan'), 'click', {});
assert(__toasts.length >= 1, '「学习计划设定」点了会给一句明确的回应，不做点了没反应的假按钮');

/* 掌握度 = 五因子加权和（§2.11 ⑫ 的口径：卡片面板里那五个数加起来必须对得上总分） */
var F = window.WK_LEARNING.factors;
var sample = null;
for (var q = 0; q < LEARN.length; q += 1) {
  if (LEARN[q] && LEARN[q].factors && LEARN[q].mastery > 4 && LEARN[q].mastery < 100) { sample = LEARN[q]; break; }
}
var sum = 0;
F.forEach(function (f) { sum += sample.factors[f.key] * f.weight; });
assert(Math.round(sum) === sample.mastery,
  '掌握度确实是五因子加权出来的（' + sample.mastery + ' = ' + Math.round(sum) + '）');

/* 演示数据是**确定性**的：同一个种子给同一份记录（换设备 / 刷新都一样） */
var items = TK.axis.items;
var a1 = window.WK_LEARNING.build(items, { seed: 7, progress: 0.5 });
var a2 = window.WK_LEARNING.build(items, { seed: 7, progress: 0.5 });
var same = true;
for (var z = 0; z < a1.length; z += 1) {
  if (a1[z].mastery !== a2[z].mastery || a1[z].month !== a2[z].month || a1[z].mark !== a2[z].mark) { same = false; break; }
}
assert(same, '同一个种子生成的数据一字不差（演示数据可复现，接后端时换掉这一层即可）');
var a3 = window.WK_LEARNING.build(items, { seed: 8, progress: 0.5 });
assert(a3[10].mastery !== a1[10].mastery || a3[50].diff !== a1[50].diff,
  '换一个种子就是另一份（不是无论给什么都返回同一个数）');

/* 这一轴是谁的：没有会话 = 看演示学生（用户第 11 条） */
assert(TK.viewer().mine === false && TK.viewer().name === '林一鸣',
  '未登录时看的是那个演示学生（' + TK.viewer().name + ' · ' + TK.viewer().grade + '）');

/* 颜色链路：状态 → 令牌 → 画布 */
assert(window.WK_LEARNING.tokenOf('已掌握') === '--math-bar-ok' && TOK['--math-bar-ok'] !== undefined,
  '状态到令牌的映射通着（已掌握 → --math-bar-ok）');
assert(TK.markColor('key') === TOK['--math-mark-key'] && TK.markColor('hard') === TOK['--math-mark-hard'],
  '标记色从令牌读（不是写死的）');
var fourColors = ['key', 'hard', 'review', 'block'].map(function (k) { return TK.markColor(k); });
var uniq = {};
fourColors.forEach(function (c) { uniq[c] = 1; });
assert(Object.keys(uniq).length === 4, '四类标记四个色，互不相同');

out('----');
out(__fail ? 'RESULT: 有失败项' : 'RESULT: 全部通过');
