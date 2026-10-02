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

/* 鼠标分工是用户 2026-09-30 定的：**滚轮 = 放大缩小 / 右键拖动 = 平移时间轴 / 左键待定**。
   三条各自单独钉住 —— 谁把滚轮改回"带 ⌘ 才缩放"、把右键漏掉，这里就红。 */
TK.fit();
var wx = 400;
var w0 = (wx - TK.view.x) / TK.view.scale;
fire(canvasEl, 'wheel', pe(wx, 300, { deltaY: -240 }));
assert(TK.view.scale > FIT && Math.abs((wx - TK.view.x) / TK.view.scale - w0) < 1e-9,
  '滚轮 = 放大（不用按 ⌘/Ctrl），锚点是指针：指针底下那一格滚前滚后不动');
fire(canvasEl, 'wheel', pe(wx, 300, { deltaY: 240 }));
assert(Math.abs(TK.view.scale - FIT) < 1e-6, '往回滚就缩回去（滚轮的上下 = 放大 / 缩小）');
fire(canvasEl, 'wheel', pe(wx, 300, { ctrl: true, deltaY: -240 }));
assert(TK.view.scale > FIT, '按着 ⌘/Ctrl 滚同样缩放（触控板捏合一直走这一条，老习惯不落空）');
TK.fit();

/* 右键拖动 = 平移数轴 */
var rx0 = TK.view.x;
fire(canvasEl, 'pointerdown', pe(600, 300, { button: 2 }));
fire(canvasEl, 'pointermove', pe(470, 300, { button: 2 }));
fire(canvasEl, 'pointerup', pe(470, 300, { button: 2 }));
assert(Math.abs(TK.view.x - (rx0 - 130)) < 1e-9,
  '右键拖动 = 平移数轴（位移与手指一致：Δx ' + (TK.view.x - rx0) + '）');
fire(canvasEl, 'pointerdown', pe(600, 300, { button: 2 }));
fire(canvasEl, 'pointerup', pe(600, 300, { button: 2 }));
assert(TK.cardIndex() === -1, '右键点一下不弹卡片（右键只管拖动，弹卡片是左键的事）');

/* 观察点只由"点"决定，拖视野 **不许** 顺手把它挪走
   （用户 2026-09-30："我右键拖动的时候，我已经选中的那观察点不应该移动，
     不应该跟随我的这个鼠标移动"）。先点一格钉住它，再拖一小段，看它还在不在原处。 */
TK.fit();
fire(canvasEl, 'pointerdown', pe(500, 300, { button: 0 }));
fire(canvasEl, 'pointerup', pe(500, 300, { button: 0 }));
var pinned = TK.cardIndex();
assert(pinned >= 0, '先左键点一格，把观察点钉住（钉在第 ' + pinned + ' 格）');
fire(canvasEl, 'pointerdown', pe(620, 300, { button: 2 }));
fire(canvasEl, 'pointermove', pe(430, 300, { button: 2 }));
fire(canvasEl, 'pointermove', pe(300, 300, { button: 2 }));
fire(canvasEl, 'pointerup', pe(300, 300, { button: 2 }));
assert(TK.cardIndex() === pinned,
  '拖视野这么久，观察点一动不动（还是第 ' + TK.cardIndex() + ' 格，没有被拖到视野正中）');
TK.closeCard();
TK.fit();

/* 左键：眼下仍保留"点一下看这一格的卡片"（用户说"一会儿再设置"，所以先维持现状） */
fire(canvasEl, 'pointerdown', pe(600, 300, { button: 0 }));
fire(canvasEl, 'pointerup', pe(600, 300, { button: 0 }));
assert(TK.cardIndex() >= 0, '左键点一下 = 弹这一格的卡片（左键的其它用法待用户定）');
TK.closeCard();
TK.fit();

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
for (var i = 0; i < LEARN.length; i += 1) {
  if (LEARN[i] && (LEARN[i].marks.length || LEARN[i].blocked)) { mk = i; break; }
}
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
 * 3b. 划过的那一格与光标（用户 2026-09-30）
 * ------------------------------------------------------------ */
out('---- 划过与光标 ----');

/* 划过时**竖线 + 亮起来的点**必须成对出现，而且都指着指针那一格：
   这是"名字指着谁"的答案 —— 没有它们，名字变了学生也不知道说的是哪一格。
   注意基线：不划过时也有系统色竖线 —— "当前学习"那颗节点自己有一条引线（markNode），
   所以不能"找到就算数"，要拿"划过前后多出来的那一根"。
   门槛取 20 而不是 40：用户 2026-09-30 让划过那根线**短下来**（只到轴上方 26px、轴下 7px 穿过零轴），
   在适配档下量出来约 31 个世界单位 —— 门槛压在 20 才抓得到它，同时仍容不下任何一段刻度短划。 */
function primaryV(minLen) {
  var min = minLen === undefined ? 20 : minLen;
  return AX.strokes.filter(function (s) {
    if (s.style !== TOK['--math-primary']) { return false; }
    return (s.path || []).some(function (o) {
      return o.x0 !== undefined && o.x0 === o.x1 && Math.abs(o.y1 - o.y0) > min;
    });
  });
}
function vSeg(s) {
  var p = (s && s.path) || [];
  for (var i = 0; i < p.length; i += 1) {
    if (p[i].x0 !== undefined && p[i].x0 === p[i].x1) { return p[i]; }
  }
  return null;
}
function hoverDot() {
  /* 那颗被擦亮的点：系统色的圆弧填充，取最后一笔（划过的标记画在最上面） */
  var hits = AX.fills.filter(function (f) {
    return f.style === TOK['--math-primary'] &&
      (f.path || []).some(function (o) { return o.r !== undefined; });
  });
  if (!hits.length) { return null; }
  var arc = hits[hits.length - 1].path.filter(function (o) { return o.r !== undefined; })[0];
  return arc || null;
}

TK.fit();
ctxReset(AX); TK.redraw();
var baseV = primaryV().length;          /* 不划过时的基线：只有"当前学习"那条引线 */
var xA = 420;
fire(canvasEl, 'pointermove', pe(xA, 300));
ctxReset(AX); TK.redraw();
var linesA = primaryV();
assert(linesA.length === baseV + 1,
  '划过时多出一根系统色竖线（' + baseV + ' → ' + linesA.length + '，多的那根就是划过标记）');
var segA = vSeg(linesA[linesA.length - 1]);
var dotA = hoverDot();
/* 屏幕 → 世界的换算要连 view.x 一起算：指针在屏幕 420，世界坐标是 (420 − view.x) ÷ scale */
function worldOf(sx) { return (sx - TK.view.x) / TK.view.scale; }
assert(segA && Math.abs(segA.x0 - worldOf(xA)) < 1,
  '竖线落在指针所在的那一格（世界 x ' + (segA && segA.x0.toFixed(1)) + ' vs 指针 ' +
  worldOf(xA).toFixed(1) + '）');
assert(!!dotA && Math.abs(dotA.x - segA.x0) < 1e-9,
  '亮起来的那颗点与竖线同在一格（名字指的是谁，这两样一起指）');
assert(!!dotA && dotA.r * TK.view.scale > TK.dotR,
  '那颗点确实更大更亮（屏幕半径 ' + (dotA ? (dotA.r * TK.view.scale).toFixed(1) : '?') +
  ' > 普通一颗 ' + TK.dotR + '）');
assert(Math.abs((segA.x0 - Math.floor(segA.x0)) - 0.5) < 1e-9,
  '而且落在格中心（i + 0.5），不是格边线上');
/* 线要"短、精致、上下都穿轴"（用户 2026-09-30："这根线太长了，光往上太长了……
   不光往上，还可以往下降，但是短一点，感觉精致一点"）：
   穿过 y=0 那条轴，且比"当前学习"那条引线短得多。 */
assert(segA.y0 < 0 && segA.y1 > 0,
  '划过那根竖线穿过零轴（上端 ' + segA.y0.toFixed(1) + ' < 0 < 下端 ' + segA.y1.toFixed(1) + '）');
var baseLine = vSeg(primaryV(40)[0]);
assert(!baseLine || (segA.y1 - segA.y0) < (baseLine.y1 - baseLine.y0) * 0.5,
  '而且明显比"当前学习"那条引线短（划过 ' + (segA.y1 - segA.y0).toFixed(1) + ' vs 引线 ' +
  (baseLine ? (baseLine.y1 - baseLine.y0).toFixed(1) : '?') + '）');

/* 换一格划 → 竖线跟着走到那一格 */
var xB = 700;
fire(canvasEl, 'pointermove', pe(xB, 300));
ctxReset(AX); TK.redraw();
var segB = vSeg(primaryV().pop());
assert(segB && Math.abs(segB.x0 - worldOf(xB)) < 1, '换个位置划，竖线跟着到对应的格（不再赖着不动）');
/* 划出画布 → 收回（回到基线，不留残影） */
fire(canvasEl, 'pointerleave', pe(xB, 300));
ctxReset(AX); TK.redraw();
assert(primaryV().length === baseV, '鼠标离开画布，那根竖线收回（剩回基线的 ' + baseV + ' 条）');

/* 光标三态：默认小圆圈（CSS 给，不是小手）、滚轮方向换双箭头、拖动时"移动" */
fire(canvasEl, 'wheel', pe(500, 300, { deltaY: -120 }));
assert(canvasEl.classList.contains('is-zoom-in'),
  '往上滚（放大）→ 光标换成"往外张"的双箭头（class is-zoom-in）');
fire(canvasEl, 'wheel', pe(500, 300, { deltaY: 120 }));
assert(canvasEl.classList.contains('is-zoom-out') && !canvasEl.classList.contains('is-zoom-in'),
  '往下滚（缩小）→ 换成"往中间收"的双箭头（class is-zoom-out）');
TK.fit();
fire(canvasEl, 'pointerdown', pe(500, 300, { button: 2 }));
assert(canvasEl.classList.contains('is-panning'), '按下拖动 → 光标是"移动"四向箭头（class is-panning）');
fire(canvasEl, 'pointerup', pe(500, 300, { button: 2 }));
assert(!canvasEl.classList.contains('is-panning'), '松手 → 光标交回默认那个小圆圈（不是小手）');
assert(!canvasEl.classList.contains('is-zoom-in') && !canvasEl.classList.contains('is-zoom-out'),
  '松开后缩放那双箭头也收回');
TK.fit();

/* ------------------------------------------------------------ *
 * 3d. 数轴整体大小（用户 2026-09-30）
 *   "数轴它可以放大，但是数轴本身它大不了……他一直在中间，然后那字都还比较小……
 *    加个按钮，哪怕加个那种滑块的按钮，就可以放大缩小数轴本身。"
 *   —— 与底部那三颗「缩小 / 100% / 放大」是**两件事**：
 *      那三颗走 view.scale（横向一屏看多少格），这条走 state.axis（轴本身的大小）。
 *      最要紧的一条断言就是"改这条**不许动** view.scale"。
 * ------------------------------------------------------------ */
out('---- 数轴整体大小 ----');
TK.setAxis(1);
TK.fit();
ctxReset(AX); TK.redraw();
var maxArc1 = Math.max.apply(null, AX.arcs.map(function (a) { return a.r; }));
var yAt1 = TK.view.y;
assert(TK.axisScale() === 1, '默认是标准大小（100%）');

var scaleBefore = TK.view.scale;
TK.setAxis(2);
ctxReset(AX); TK.redraw();
var maxArc2 = Math.max.apply(null, AX.arcs.map(function (a) { return a.r; }));
assert(TK.axisScale() === 2, 'setAxis(2) → 数轴整体放大到 2 倍');
assert(TK.view.scale === scaleBefore,
  '放大的不是横向缩放（view.scale 一动不动：' + scaleBefore.toFixed(6) + '）—— 那是底部三颗的事');
assert(Math.abs(maxArc2 / maxArc1 - 2) < 0.02,
  '轴上的圆点跟着大了一倍（世界半径 ' + maxArc1.toFixed(2) + ' → ' + maxArc2.toFixed(2) + '）');
assert(TK.view.y !== yAt1, '竖向重排了（轴上下要留的地方跟着变大：y ' +
  yAt1.toFixed(1) + ' → ' + TK.view.y.toFixed(1) + '）');
assert(elFor('[data-tk-axis-zoom]').value === '200' &&
  elFor('[data-tk-axis-zoom-value]').textContent === '200%',
  '弹层里那根滑块与读数跟着一起变（200% —— 不然拖完不知道自己在哪一档）');

TK.setAxis(99);
assert(TK.axisScale() === 2, '往上封顶 2 倍（再大轴就被挤出屏幕了）');
TK.setAxis(0.1);
assert(TK.axisScale() === 0.7, '往下兜底 0.7 倍');
TK.setAxis(1);
TK.fit();
assert(Math.abs(TK.view.scale - FIT) < 1e-9 && TK.axisScale() === 1,
  '收回标准大小（1 倍），横向缩放不受影响');

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

/* 标记这一维：一格可以挂好几个标（多选）—— **沾上一个就算命中**，不是只比第一个 */
var hitMark = matchCount(function (r) { return TK.marksOf(r).indexOf('key') >= 0; });
TK.setFilter([], [], ['key'], []);
assert(TK.filtered() === N - hitMark, '标记这一维：只看标了"重点"的（筛掉 ' + TK.filtered() + ' 格）');
var multi = matchCount(function (r) { return TK.marksOf(r).length > 1; });
assert(multi > 0, '演示数据里真的有"一格挂好几个标记"的（' + multi + ' 格，不是只会挂一个）');
var hitAny = matchCount(function (r) {
  var m = TK.marksOf(r); return m.indexOf('key') >= 0 || m.indexOf('hard') >= 0;
});
TK.setFilter([], [], ['key', 'hard'], []);
assert(TK.filtered() === N - hitAny,
  '一维里选两个（重点 或 难点）= 沾上哪个都算（筛掉 ' + TK.filtered() + ' 格）');

var hitTerm = matchCount(function (r) { return r.term === '2025-下'; });
TK.setFilter([], [], [], ['2025-下']);
assert(TK.filtered() === N - hitTerm, '时间段这一维：没学过的格子没有日期，选了学期就留不下来');

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
/* 面板开着，那颗按钮就得亮着（用户 2026-09-30："激活筛选面板的时候，筛选按钮还是不显示的状态，
   这不对的"）—— 空筛选也要亮：亮 = "这个面板开着"，不只是"有筛的维度"。 */
assert(elFor('#tk-filter').classList.contains('is-on'),
  '筛选面板开着，那颗「筛选」按钮是亮着的（要点亮的是"面板开着"这件事）');
assert(elFor('#tk-filter').getAttribute('aria-expanded') === 'true',
  '而且 aria-expanded 也报了"展开"（读屏同样看得出）');
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
assert(!elFor('#tk-filter').classList.contains('is-on') && TK.filtered() === 0,
  '收起面板、又没筛任何一维 → 那颗按钮熄掉（不留"亮着但什么都没发生"的假状态）');

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
  if (a1[z].mastery !== a2[z].mastery || a1[z].term !== a2[z].term ||
      a1[z].marks.join() !== a2[z].marks.join() || a1[z].blocked !== a2[z].blocked) { same = false; break; }
}
assert(same, '同一个种子生成的数据一字不差（演示数据可复现，接后端时换掉这一层即可）');
var a3 = window.WK_LEARNING.build(items, { seed: 8, progress: 0.5 });
assert(a3[10].mastery !== a1[10].mastery || a3[50].diff !== a1[50].diff,
  '换一个种子就是另一份（不是无论给什么都返回同一个数）');

/* ------------------------------------------------------------ *
 * 3a-2. 3D 的数据地基（用户 2026-09-30：X = 知识结构、Z = 日历时间）
 *   这一层只**加**东西：现有 build() 一个字段都不碰，
 *   新字段（plannedAt / events / 考试）全走独立散列流。
 * ------------------------------------------------------------ */
out('---- 3D 的数据地基 ----');
var L3 = window.WK_LEARNING;
var recD = L3.build(items, { seed: 7, progress: 0.5 });
assert(!('events' in recD[0]) && !('plannedAt' in recD[0]),
  '现有的 build() 不碰新字段（2D 那条链路一字没动 —— "不影响现在功能"就落在这条上）');
var plan = L3.buildTimeline(items, recD, { seed: 7, progress: 0.5 });
var learnedD = recD.filter(function (r) { return r.learnedAt; }).length;
var evN = recD.filter(function (r) { return r.events && r.events.length; }).length;
assert(learnedD > 0 && evN === learnedD, '每个学过的格子都有一条轨迹（' + evN + '/' + learnedD + '）');
assert(recD.every(function (r) { return r.learnedAt || r.events.length === 0; }),
  '没学过的格子没有轨迹（不编造没发生的事）');
assert(recD.every(function (r) {
  var e = r.events;
  return !e.length || e[e.length - 1].mastery === r.mastery;
}), '每条轨迹最后一条掌握度 == 2D 显示的那个数（两条线是同一条，不许互相打脸）');
assert(recD.every(function (r) {
  for (var k = 1; k < r.events.length; k += 1) { if (r.events[k].at < r.events[k - 1].at) { return false; } }
  return true;
}), '轨迹按时间排好了序（3D 的 Z 轴要按它画）');
var kinds3 = {};
recD.forEach(function (r) { r.events.forEach(function (e) { kinds3[e.kind] = (kinds3[e.kind] || 0) + 1; }); });
assert(kinds3.first === learnedD && kinds3.review > 0 && kinds3.exam > 0 && kinds3.fix > 0,
  '四类事件都有（首学 ' + kinds3.first + ' · 复习 ' + kinds3.review + ' · 考试 ' + kinds3.exam + ' · 纠错 ' + kinds3.fix + '）');
assert(plan.exams.length > 0, '考试实体有了（' + plan.exams.length + ' 次）');
assert(plan.exams.every(function (e) {
  return e.paper.every(function (p) { return p.index >= e.from && p.index < e.to && p.score >= 0 && p.score <= p.full; });
}), '每张卷子自洽（题号落在这册范围里，得分在 0–满分之间）');
assert(plan.exams.every(function (e) {
  for (var k = e.from; k < e.to; k += 1) { if (!recD[k].learnedAt) { return false; } }
  return true;
}), '只考"整册学完"的（学着的那册不考）');
/* 考试范围轮着来（用户 2026-09-30："他每次考试，他考的范围不一样……考的难度也不一样"）：
   一册一考，但三档轮着来 —— 单元测 / 期中 / 期末；3D 那块玻璃板的宽度就是照它画的。 */
assert(plan.exams.every(function (e) {
  return e.scope === 'unit' || e.scope === 'mid' || e.scope === 'final' || e.scope === 'year';
}), '每场考试都带范围档（单元测 / 期中 / 期末 / 学年考）');
assert(plan.exams.some(function (e) { return e.scope === 'final'; }) &&
       plan.exams.some(function (e) { return e.scope !== 'final'; }),
  '范围不是一刀切（既有考整册的期末、也有只考一段的单元测 / 期中）');
var spans3 = plan.exams.map(function (e) { return e.paper.length; });
var spanMin = Math.min.apply(null, spans3);
var spanMax = Math.max.apply(null, spans3);
assert(spanMax > spanMin * 1.5,
  '卷面宽窄拉得开（最短 ' + spanMin + ' 个考点 / 最长 ' + spanMax + ' 个 —— 3D 的板宽才有差别）');
/* 最长的那一种：跨册的"学年考"（用户 2026-09-30："这个长的考试，就涵盖范围长的考试，
   这样我就可以看到长的是什么样子"）—— 它必须比任何一册的都长。 */
var yearEx = plan.exams.filter(function (e) { return e.scope === 'year'; });
var bookMax = Math.max.apply(null, plan.exams.filter(function (e) { return e.scope !== 'year'; })
  .map(function (e) { return e.paper.length; }));
assert(yearEx.length > 0, '有跨册的"学年考"（' + yearEx.length + ' 场）');
assert(yearEx.every(function (e) { return e.paper.length > bookMax; }),
  '学年考确实是最长的（' + Math.min.apply(null, yearEx.map(function (e) { return e.paper.length; })) +
  ' ≥ 单册最长 ' + bookMax + ' 格）');
assert(plan.exams.every(function (e, k) {
  return k === 0 || plan.exams[k - 1].at <= e.at;
}), '考试按时间排好序（编号 E1 就是最早那一场）');
var examSlots = plan.exams.reduce(function (a, e) { return a + e.paper.length; }, 0);
/* 一格可能被考两次（一次期末 + 一次跨册的学年考），所以不能拿"有考试事件的总格数"去比；
   要比的是**每一道题都能在轨迹里找到它那一场**（按 exam id 认）。 */
var examTraceOk = plan.exams.every(function (e) {
  return e.paper.every(function (p) {
    return (recD[p.index].events || []).some(function (ev) {
      return ev.kind === 'exam' && ev.exam === e.id;
    });
  });
});
assert(examTraceOk, '考过的每一格，轨迹里都有一笔"考试"（切片能落在点上，共 ' + examSlots + ' 题）');

/* ------------------------------------------------------------ *
 * 2b. 错因（用户 2026-10-01）—— 三轴归因 + **自洽性**
 *     用户："肯定有个错因，分个七八种吧……那七八种里面，他还要叠加这个知识点……
 *     而且里面这东西是复合叠加的。既然要做就要做得力度深一点。"
 *     这一组里最值钱的是最后两条"自洽性"：判成"这块没学好"的，那块 acc 必须真的低 ——
 *     不然数据一眼就假，报告页也就没法写。
 * ------------------------------------------------------------ */
var CAUSE_LIST = L3.causes || [];
var CAUSE_KEYS = {};
CAUSE_LIST.forEach(function (c) { CAUSE_KEYS[c.key] = c; });
assert(CAUSE_LIST.length === 7,
  '错因词表七种（' + CAUSE_LIST.map(function (c) { return c.name; }).join(' / ') + '）');
var gUnknown = CAUSE_LIST.filter(function (c) { return c.group === 'unknown'; }).length;
var gSlip = CAUSE_LIST.filter(function (c) { return c.group === 'slip'; }).length;
assert(gUnknown >= 3 && gSlip >= 3,
  '"不会 / 失误"两组都成组（不会 ' + gUnknown + ' 种、失误 ' + gSlip + ' 种）—— 这一刀比种类多少更重要');
assert(!CAUSE_LIST.some(function (c) { return /注意力|状态不好|发挥失常/.test(c.name); }),
  '词表里没有"注意力不集中"这类**场级结论**（那是从错因统计出来的，不是某一道题的原因）');
assert(!!L3.causeBys && Object.keys(L3.causeBys).length >= 4,
  '每条错因都带一句"凭什么判成它"（causeBys ' + Object.keys(L3.causeBys || {}).length + ' 条）');

var badItems = [];
plan.exams.forEach(function (e) {
  e.paper.forEach(function (p) { if (p.score * 5 < p.full * 3) { badItems.push(p); } });
});
var causeItems = [];
badItems.forEach(function (p) { causeItems = causeItems.concat(p.causes || []); });
assert(badItems.length > 0 && badItems.every(function (p) { return p.causes && p.causes.length; }),
  '每一道错题都有错因（共 ' + badItems.length + ' 道错题，道道有）');
assert(plan.exams.every(function (e) {
  return e.paper.every(function (p) { return (p.score * 5 < p.full * 3) || p.causes === null; });
}), '对的题没有错因（`causes` 为 null —— 错因只挂在错题上）');
assert(causeItems.every(function (c) { return !!CAUSE_KEYS[c.key]; }),
  '错因的 key 都在词表里（' + Object.keys(CAUSE_KEYS).length + ' 个 key）');
assert(causeItems.every(function (c) {
  return typeof c.k === 'number' && c.k >= 0 && c.k < recD.length;
}), '错因指向的考点都在范围内');
assert(causeItems.every(function (c) {
  var rec = recD[c.k];
  return rec && rec.cards && c.card >= 0 && c.card < rec.cards.length;
}), '错因指的"方面"（哪一块）都在那个考点的卡片里');
assert(causeItems.every(function (c) { return !!L3.causeBys[c.by] && typeof c.acc === 'number'; }),
  '每一条错因都带判据（by + 那个 acc）');
/* **自洽性**：判据与给的原因必须对得上 */
assert(causeItems.every(function (c) { return c.by !== 'block-low' || c.acc < 65; }),
  '判成"这一块本来就没学好"的，那块正确率确实低（全部 < 65%）');
assert(causeItems.every(function (c) {
  return !/^(block-ok|nearly|late|blank)$/.test(c.by) || c.acc >= 55;
}), '判成"这一块学得挺好、却错了"（失误组）的，那块正确率确实不低（全部 ≥ 55%）');
/* **七种错因都得真的用得上** —— 第一版里"粗心漏写""审题不清"两条**永远出不来**
   （失误分支只写了"算错"一条），词表写着七种、实际只出五种。这条专治"死条目"。 */
var hitKeys = {};
causeItems.forEach(function (c) { hitKeys[c.key] = 1; });
var deadCauses = CAUSE_LIST.filter(function (c) { return !hitKeys[c.key]; });
assert(deadCauses.length === 0,
  '七种错因都真的用得上（没有"写了永远出不来"的死条目）' +
  (deadCauses.length ? '，缺：' + deadCauses.map(function (c) { return c.name; }).join('、') : ''));
/* **复合叠加**：真有"一道错题错在两条以上"的 */
var multiCause = badItems.filter(function (p) { return (p.causes || []).length > 1; });
assert(multiCause.length > 0,
  '真的出现了"复合叠加"的错题（' + multiCause.length + ' 道错在两条以上）');
/* **兼考考点**：真有"一道题考几个知识点"的，且兼考的那个就在这一次考试的范围内 */
assert(plan.exams.every(function (e) {
  return e.paper.every(function (p) {
    return (p.also || []).every(function (k) { return k >= e.from && k < e.to && k !== p.index; });
  });
}) && plan.exams.some(function (e) { return e.paper.some(function (p) { return (p.also || []).length; }); }),
  '兼考考点接上了（一题可能考几个知识点，且都在这一场范围内）');
var plannedN = recD.filter(function (r) { return !!r.plannedAt; }).length;
assert(plannedN > 0 && /^20[0-9]{2}-/.test(recD[0].plannedAt),
  'K12 日历接上了（' + plannedN + ' 格有计划日，第一格 ' + recD[0].plannedAt + '）');
assert(recD.some(function (r) { return !r.plannedAt; }), '竞赛那几支没有年级 → 计划日留空，不硬编一个');
var recE = L3.build(items, { seed: 7, progress: 0.5 });
L3.buildTimeline(items, recE, { seed: 7, progress: 0.5 });
assert(recE.every(function (r, k) {
  return r.plannedAt === recD[k].plannedAt && JSON.stringify(r.events) === JSON.stringify(recD[k].events);
}), '同一个种子 → 同一份轨迹与考试表（演示数据仍然可复现）');

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

/* ------------------------------------------------------------ *
 * 3c. 标记的加 / 改 / 撤（用户 2026-09-30 定的四个口径）
 *   在卡片里打 · 可以挂好几个 · "前置未满足"只读 · 再点一次 = 取消
 * ------------------------------------------------------------ */
out('---- 标记的加改撤 ----');
TK.setFilter([], [], [], []);
TK.fit();

/* 哪几类归学员自己定（`own` 字段就是那四个口径的落点） */
var ownList = TK.ownMarks();
assert(ownList.join() === 'key,hard,review',
  '学员能改的是重点 / 难点 / 待复习三类（实际 ' + ownList.join() + '）');
var allMarks = window.WK_LEARNING.marks;
assert(allMarks.length === 4 && allMarks[3].key === 'block' && allMarks[3].own === false,
  '"前置未满足"归**系统**（own:false —— 学员改不了）');

/* 在卡片里走一遍真实的点击路径：卡片 DOM → 按钮 click → 数据 → 再重画卡片 */
function walkAttr(root, attr) {
  var found = [];
  (function go(n) {
    (n.children || []).forEach(function (c) {
      if (c._attrs && c._attrs[attr] !== undefined) { found.push(c); }
      go(c);
    });
  }(root));
  return found;
}
function markChips() { return walkAttr(elFor('[data-tk-card-body]'), 'data-tk-mark'); }
function markChip(key) {
  var list = markChips();
  for (var i = 0; i < list.length; i += 1) {
    if (list[i]._attrs['data-tk-mark'] === key) { return list[i]; }
  }
  return null;
}
function isOn(key) { var c = markChip(key); return !!c && c._attrs['aria-pressed'] === 'true'; }
function kidOf(i) { var s = String(i + 1); while (s.length < 4) { s = '0' + s; } return 'MATH-KP-' + s; }

var target = -1;
for (var t0 = 0; t0 < LEARN.length; t0 += 1) {
  if (LEARN[t0] && LEARN[t0].status !== '未开始') { target = t0; break; }
}
TK.select(target);
var chipEls = markChips();
assert(chipEls.length === 3,
  '卡片里那排"我的标记"恰好三颗（实际 ' + chipEls.length + '）');
assert(chipEls.map(function (c) { return c._attrs['data-tk-mark']; }).join() === 'key,hard,review',
  '三颗的次序与 MARKS 一致（key,hard,review）');
assert(isOn('key') === (LEARN[target].marks.indexOf('key') >= 0),
  '进卡片时按下态与数据一致（这一格原本' + (LEARN[target].marks.indexOf('key') >= 0 ? '有' : '没有') + '重点）');

/* 先清成一张白纸：三颗都点掉 */
['key', 'hard', 'review'].forEach(function (k) { if (isOn(k)) { fire(markChip(k), 'click', {}); } });
assert(LEARN[target].marks.length === 0 && !isOn('key') && !isOn('hard') && !isOn('review'),
  '把亮着的都点一遍 → 三颗全灭、数据里也空了（"撤销"就是再点一下同一颗）');
assert(TK.marksOf(LEARN[target]).length === (LEARN[target].blocked ? 1 : 0),
  '清完之后这一格只剩可能有的那一颗系统标记（自评那几类都摘干净了）');

/* 点一下贴上；再点一下摘掉 */
fire(markChip('key'), 'click', {});
assert(LEARN[target].marks.join() === 'key' && isOn('key'),
  '点一下「重点」→ 贴上了（数据与按钮的亮灭一起变）');
assert(TK.markEdits()[kidOf(target)].join() === 'key',
  '改过的这一格进了本机那份覆盖表（键是知识点编号 ' + kidOf(target) + '）');
assert(!!__store['wkmath.timeline.marks.v1'],
  '而且立刻落了盘（wkmath.timeline.marks.v1 —— 刷新之后还在）');
fire(markChip('key'), 'click', {});
assert(LEARN[target].marks.length === 0 && !isOn('key'),
  '再点一次同一颗 → 摘掉（用户定的"撤销 = 再点一下"，不用另做一个删除键）');

/* 多选：连点两颗，谁也别把谁顶掉 */
fire(markChip('hard'), 'click', {});
fire(markChip('review'), 'click', {});
var pair = LEARN[target].marks;
assert(pair.join() === 'hard,review',
  '可以同时挂好几个标记（点第二颗不会把第一颗顶掉，实际 ' + pair.join('+') + '）');
assert(isOn('hard') && isOn('review') && !isOn('key'),
  '两颗亮着、没点的那颗暗着');
assert(TK.marksOf(LEARN[target]).join() ===
  (LEARN[target].blocked ? 'hard,review,block' : 'hard,review'),
  '画布 / 筛选那边拿到的是"全部标记"（自评的 + 系统那颗，实际 ' +
  TK.marksOf(LEARN[target]).join('+') + '）');

/* 系统那颗：卡片里不出按钮，只出一行说明；硬塞也不生效 */
var blk = -1;
for (var b0 = 0; b0 < LEARN.length; b0 += 1) {
  if (LEARN[b0] && LEARN[b0].blocked) { blk = b0; break; }
}
assert(blk >= 0, '演示数据里有被系统标了"前置未满足"的格子（第 ' + blk + ' 格）');
TK.select(blk);
assert(markChip('block') === null,
  '那一格的卡片里**没有**"前置未满足"这颗按钮（它不归学员改）');
var sysRow = elFor('[data-tk-card-body]').querySelectorAll('.tk-card__mark-sys');
assert(sysRow.length === 1 && sysRow[0].textContent.indexOf('前置未满足') >= 0 &&
  sysRow[0].textContent.indexOf('不能自己改') >= 0,
  '卡片里改用一行说明摆着："前置未满足 · 系统判定，不能自己改"');
assert(TK.marksOf(LEARN[blk]).indexOf('block') >= 0,
  '但它照样算这一格的标记（筛选 / 画布认得它 —— 只是只读）');
TK.tapMark(blk, 'block');
assert(LEARN[blk].marks.indexOf('block') < 0 && LEARN[blk].blocked === true,
  '硬把系统那颗当成自评塞进去也不生效（blocked 只由系统那一条说了算）');

/* 轴上：一格挂两颗就**并排画两个**图标（不是只画第一颗） */
var two = -1;
for (var t1 = 0; t1 < LEARN.length; t1 += 1) {
  if (LEARN[t1] && LEARN[t1].marks.length >= 2) { two = t1; break; }
}
assert(two >= 0, '演示数据里有一格挂着两个自评标记（第 ' + two + ' 格）');
TK.zoomBy(1e9);                       /* 放到最大：一格宽远超一排图标需要的宽度 */
TK.view.x = TK.view.w / 2 - (two + 0.5) * TK.view.scale;
ctxReset(AX); TK.redraw();
var markToks = ['--math-mark-key', '--math-mark-hard', '--math-mark-review', '--math-mark-block']
  .map(function (k) { return TOK[k]; });
var gotMarks = AX.strokes.filter(function (s) { return markToks.indexOf(s.style) >= 0; }).length;
/* 引擎只画"看得见的那几格"（visibleIndexRange，两头各多留一格）—— 照同一条公式算出应该有几笔 */
function shouldDraw(v) {
  var from = Math.max(0, Math.floor(-v.x / v.scale) - 1);
  var to = Math.min(N - 1, Math.ceil((v.w - v.x) / v.scale) + 1);
  var n = 0;
  for (var i = from; i <= to; i += 1) {
    var ks = TK.marksOf(LEARN[i]);
    var need = 10 * ks.length + 3 * (ks.length - 1);
    if (ks.length && v.scale >= need) { n += ks.length; }
  }
  return n;
}
assert(gotMarks === shouldDraw(TK.view) && gotMarks >= 2,
  '轴上的标记图标按"一格挂几个就并排画几个"来（应画 ' + shouldDraw(TK.view) + ' 笔，实际 ' + gotMarks + ' 笔）');
var drawnStyles = {};
AX.strokes.forEach(function (s) { if (markToks.indexOf(s.style) >= 0) { drawnStyles[s.style] = 1; } });
var twoColors = LEARN[two].marks.map(function (k) { return TOK[['--math-mark-key', '--math-mark-hard', '--math-mark-review']
  [['key', 'hard', 'review'].indexOf(k)]]; });
assert(twoColors.every(function (c) { return !!drawnStyles[c]; }),
  '那一格挂的两种标记都真的画出来了（' + LEARN[two].marks.join('+') + ' 两支色都在）');

/* 收尾：收起卡片、清掉筛选、回到适配档，别把状态留给后面的断言 */
TK.closeCard();
TK.setFilter([], [], [], []);
TK.fit();

out('----');
out(__fail ? 'RESULT: 有失败项' : 'RESULT: 全部通过');
