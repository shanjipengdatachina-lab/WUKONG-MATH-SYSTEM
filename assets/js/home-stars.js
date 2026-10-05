/* 首页标题背后那片「银河系」—— 干净的点，慢慢长出来、慢慢转。
   用户 2026-10-02 第一轮原话："简单的、纯粹的点……不是带光晕的点。然后慢慢形成这个星云，
   就是类似一个银河系，但是是干净的点。真的慢慢在旋转，有种很静谧、很神秘、很安静的那种感觉。
   就是单纯的点。"
   同一轮看过成品后又提："这四条臂也没有弧度，这就不像个银河系……银河系是持续旋转的……
   尽量做得有点动效，可以上下左右旋转……弄得像银河系一点。"

   这一版怎么才"像银河系"（四条臂**看得出弯**、转起来**一直是星系**）：
     · **对数螺旋**：θ = 臂的初相 + K·ln(r/r0)，K 拉到 2.6 —— 四条臂从里到外各绕 1 圈上下，
       是**真的弧线**。上一版 K 只有 0.95（他原来那份 Universal.html 也是 0.95），
       只绕 0.4 圈，四条臂在屏幕上摊成了四道直抹 —— 这就是"没有弧度"的根子。
     · **刚体自转**：整盘用**同一个**角速度转（不是"内快外慢"那套）。差速转下去，
       里圈会慢慢撵上外圈，几十秒就把旋臂绞成一团、星系散架；刚体转**臂形永远不坏**，
       页面开一整天还是这个星系。
     · **四层结构**：核棒（银河系是"棒旋"星系，核球再拉长成一根短棒）→ 核球（球状 · 偏暖 · 密）
       → 盘与旋臂（薄 · 偏冷 · 亮）→ 外圈薄晕（很淡）；盘里另留一层**很淡的臂间盘**，
       不然四条臂各飘各的、像四根带子而不像一个星系。
     · **干净**：一个点就是一记 arc + fill —— 不叠外发光、不用相加混合、不画径向光晕。
       核球之所以亮，是成百个小点**叠**出来的，不是画了一团光。
     · **能动**：相机左右慢慢飘 + 上下轻轻起伏；在空白处**按住拖**还能自己转上下左右
       （照他原来那份 Universal.html 的手感：左键拖动 = 转视角）。
     · **会长**：起始是散开的一团点，各自错开时间慢慢落到旋臂上。

   画布仍是**背景层**（CSS 里 pointer-events:none），标题与正文压在上面；
   拖动之所以还能用，是因为事件挂在外层 section 上（`mount()` 收到的是画布的父节点）——
   整块 hero 都能按住拖，拖动期间由 CSS 把"选字"关掉。
   对外两个口子：`WK_HOME_STARS.mount(el)`，另外自动挂到 `[data-home-stars]` 上。 */
(function () {
  'use strict';

  var MAX_R = 400;          /* 盘的半径（世界单位） */
  var ARMS = 4;             /* 旋臂数 */
  var ARM_K = 2.6;          /* 对数螺旋的缠绕度：越大越弯（上一版 0.95，四臂摊平了） */
  var ARM_R0 = 30;          /* 螺旋起算半径 */
  var CORE = 880;           /* 核球：星系的心，少了整团就散成一片浮云 */
  var BARN = 260;           /* 核棒：银河系是"棒旋"，核球再拉长成一根短棒 */
  var BAR_LEN = 62;         /* 核棒半长（世界单位）—— 跟核球半径 56 一个量级，不喧宾夺主 */
  var ARMN = 3100;          /* 旋臂上的点（密到这个量级，四条臂才连成"道"，不是一串珠） */
  var DISKN = 1050;         /* 臂间盘：很淡，只为了让盘面连成一片 */
  var HALO = 320;           /* 外圈薄晕：别让边上像被一刀切干净 */
  var FOV = 900;
  var CAM = 940;
  var FORM_MS = 3800;       /* 单颗粒子从"散点"落到旋臂上花多久 */
  var FORM_SPREAD = 6200;   /* 各颗粒子错开多久才出发 —— 这一项才有"慢慢形成" */
  var SPIN = 0.00034;       /* 角速度：整盘一个速度，一圈 5 分钟上下（详见文件头"刚体自转"） */
  var TAU = Math.PI * 2;

  var instances = [];

  function gauss() {
    var u = 0;
    var v = 0;
    while (u === 0) { u = Math.random(); }
    while (v === 0) { v = Math.random(); }
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v);
  }
  function clamp01(v) { return v < 0 ? 0 : (v > 1 ? 1 : v); }
  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
  function nowMs() {
    return (window.performance && window.performance.now)
      ? window.performance.now() : Date.now();
  }

  /** 造一颗粒子：一半是"它最后该在哪儿"（r / theta / y），
   *  一半是"它从哪儿飘来"（ax / ay / az 那团散云）。
   *  `warm` 0 = 冷（蓝白，年轻的星）→ 1 = 暖（米黄，老的星 / 核球）。 */
  function build() {
    var list = [];

    function add(r, theta, y, sizeMul, alphaMul, warm) {
      var sr = MAX_R * (0.5 + Math.random() * 1.15);      /* 散云：比星系大、还转着圈撒 */
      var st = Math.random() * TAU;
      var jit = (Math.random() - 0.5) * 14;
      list.push({
        r: r, theta: theta, y: y,
        speed: SPIN,
        ax: sr * Math.cos(st), ay: gauss() * 34, az: sr * Math.sin(st),
        cr: Math.round(178 + 74 * warm + jit),
        cg: Math.round(196 + 52 * warm + jit),
        cb: Math.round(255 - 52 * warm + jit * 0.4),
        /* 亮度按幂律分：绝大多数是暗的小点，少数是亮星 —— "撒了一层"而不是"糊了一片" */
        size: (0.42 + Math.pow(Math.random(), 2.2) * 1.7) * sizeMul,
        alpha: (0.18 + Math.pow(Math.random(), 1.6) * 0.52) * alphaMul,
        tw: Math.random() * TAU,                       /* 明灭的相位 */
        tws: 0.00035 + Math.random() * 0.0008,         /* 明灭的角速度（很轻，不是闪） */
        delay: Math.random() * FORM_SPREAD
      });
    }

    var i;

    /* ① 核球：球状（不是薄盘）、中心最密、偏暖 —— 星系得有心 */
    for (i = 0; i < CORE; i += 1) {
      var rb = Math.pow(Math.random(), 2.0) * MAX_R * 0.14;
      /* 一成的核星再亮一档、再大一圈 —— 星系的心得有"最亮的那一点"。
         倍率**不上 2**：核球在屏幕正中，两行字就压在上面，叠到爆白那两行就糊了。 */
      var hot = Math.random() < 0.1;
      add(rb, Math.random() * TAU, gauss() * (rb * 0.55 + 3),
        hot ? 1.7 : 1.2, hot ? 1.8 : 1.3, 0.62 + 0.3 * Math.random());
    }

    /* ② 核棒：银河系是个"棒旋"星系 —— 核球再拉长成一根短棒（暖色，比盘厚一点）。
       少了这一根，中间就只是一个圆球；有了它，四条臂才像从棒的两头挂出去。
       采样走"两个随机数相加"（三角形分布），两头稀、当中密，棒才有头有尾不是一根等粗的棍。 */
    for (i = 0; i < BARN; i += 1) {
      var bu = Math.random() + Math.random() - 1;
      var br = bu * BAR_LEN;
      add(Math.abs(br) < 2 ? 2 : Math.abs(br),
        (TAU / 8) + (br < 0 ? Math.PI : 0),      /* 棒摆在 45°，跟四条臂的初相错开 */
        gauss() * 4.4, 1.15, 1.25, 0.7 + 0.25 * Math.random());
    }

    /* ③ 旋臂：对数螺旋，四条各绕 1 圈上下 —— 有弧度才是星系 */
    for (i = 0; i < ARMN; i += 1) {
      var arm = i % ARMS;
      /* 指数 0.5 = 按**面积**均匀撒 → 每条臂**单位弧长上的点数一样多**（外圈弧长是内圈的好几倍，
         指数一大外圈就稀成一串珠子）。 */
      var t = Math.sqrt(Math.random());
      var ra = ARM_R0 + t * (MAX_R - ARM_R0);
      ra += gauss() * (24 * (1 - 0.4 * t));             /* 臂自身的径向厚度 */
      if (ra < 14) { ra = 14; }
      var sig = 0.15 - 0.06 * t;                        /* 角度散布：收得紧，臂才像"一道" */
      var th = (arm * TAU) / ARMS + ARM_K * Math.log(ra / ARM_R0) + gauss() * sig;
      var warm = 1 - clamp01(ra / MAX_R);               /* 里暖外冷 */
      if (Math.random() < 0.07) { warm = 0.95; }        /* 臂上随手撒几颗暖星（红巨星） */
      add(ra, th, gauss() * 4.6, 1, 1.2, warm);
    }

    /* ④ 臂间盘：均匀铺、更薄更淡 —— 让四条臂之间连着，而不是四根带子各飘各的 */
    for (i = 0; i < DISKN; i += 1) {
      var rd = ARM_R0 + Math.pow(Math.random(), 0.5) * (MAX_R - ARM_R0);
      add(rd, Math.random() * TAU, gauss() * 5.2, 0.92, 0.5, 1 - clamp01(rd / MAX_R));
    }

    /* ⑤ 外圈薄晕：很淡，只是别让边上像被一刀切干净 */
    for (i = 0; i < HALO; i += 1) {
      var rh = Math.pow(Math.random(), 0.62) * MAX_R * 1.18;
      add(rh, Math.random() * TAU, gauss() * (rh * 0.42 + 4), 0.9, 0.45, 0.25);
    }

    return list;
  }

  function mount(container) {
    if (!container) { return null; }
    for (var k = 0; k < instances.length; k += 1) {
      if (instances[k].container === container) { return instances[k]; }
    }
    var canvas = container.querySelector('canvas[data-home-stars]');
    if (!canvas) { return null; }
    var ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) { return null; }

    var DPR = Math.min(window.devicePixelRatio || 1, 2);
    var W = 0;
    var H = 0;
    var dots = build();

    /* 相机：`yaw / pitch` 是用户拖出来的偏移量，`autoYawV` 是自己慢慢飘的量，
       两路相加才是这一帧真正的机位（这样用户撒手之后，自动那一路照旧走）。 */
    var yaw = 0.42;
    var pitch = -1.02;
    var autoYawV = 0;
    var PITCH_MIN = -1.5;     /* 再大就翻到盘下面去了 */
    var PITCH_MAX = -0.06;    /* 再小就贴成一条线（正对着盘侧） */
    var drag = { on: false, x: 0, y: 0 };

    var startAt = 0;
    var pauseAt = 0;         /* 暂停过多久，要把形成进度补回来 */
    var done = false;

    var reduceMotion = window.matchMedia
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false;

    var st = {
      container: container, canvas: canvas,
      paused: false, frames: 0, count: dots.length,
      reduceMotion: reduceMotion,
      get formed() { return done; },
      get yaw() { return yaw + autoYawV; },
      get pitch() { return pitch; },
      get rotY() { return yaw + autoYawV; }
    };

    function resize() {
      var rect = container.getBoundingClientRect();
      W = Math.max(1, Math.round(rect.width));
      H = Math.max(1, Math.round(rect.height));
      canvas.width = Math.floor(W * DPR);
      canvas.height = Math.floor(H * DPR);
      canvas.style.width = W + 'px';
      canvas.style.height = H + 'px';
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      if (reduceMotion) { draw(0, 0); }     /* 静态档：一帧画到"已经成形" */
    }

    var raf = 0;
    var last = 0;

    function loop(now) {
      raf = 0;
      if (st.paused) { return; }
      if (!last) { last = now; }
      var dt = (now - last) / 16.667;
      last = now;
      if (dt > 3) { dt = 3; }
      draw(now, dt);
      schedule();
    }

    function schedule() {
      if (raf || st.paused || st.reduceMotion) { return; }
      raf = window.requestAnimationFrame(loop);
    }

    /**
     * 画一帧。
     * @param {number} now 毫秒时间戳（形成进度按它算）
     * @param {number} dt  归一化到 60fps 的步长（自转按它算）
     */
    function draw(now, dt) {
      st.frames += 1;
      if (!startAt) { startAt = now; }

      var elapsed = now - startAt;
      var cx = W / 2;
      var cy = H / 2;
      var camY = yaw + autoYawV;                             /* 左右 */
      var camX = pitch + Math.sin(now * 0.00013) * 0.10;     /* 上下：极缓的起伏（约 48 秒一个来回） */
      var cosY = Math.cos(camY);
      var sinY = Math.sin(camY);
      var cosX = Math.cos(camX);
      var sinX = Math.sin(camX);

      /* 让星系大致铺满短边（窗口小的时候整个缩小，窗口大的时候也不至于顶出画外） */
      var zoom = Math.min(W / 1150, H / 940);
      if (zoom > 1.45) { zoom = 1.45; }
      if (zoom < 0.5) { zoom = 0.5; }
      var fov = FOV * zoom;

      ctx.fillStyle = '#000105';
      ctx.fillRect(0, 0, W, H);

      var allDone = true;

      for (var i = 0; i < dots.length; i += 1) {
        var p = dots[i];
        p.theta += p.speed * dt;

        /* 形成进度：各自错开出发，所以"慢慢"成形；静态档直接给 1 */
        var prog = reduceMotion ? 1 : clamp01((elapsed - p.delay) / FORM_MS);
        if (prog < 1) { allDone = false; }
        var e = easeOutCubic(prog);

        /* 它最终该在的世界坐标（跟着自转走） */
        var tx = p.r * Math.cos(p.theta);
        var tz = p.r * Math.sin(p.theta);

        /* 从"散云"一路落到它该在的位置 */
        var wx = p.ax + (tx - p.ax) * e;
        var wy = p.ay + (p.y - p.ay) * e;
        var wz = p.az + (tz - p.az) * e;

        var x1 = wx * cosY - wz * sinY;            /* 绕 Y 轴（左右） */
        var z1 = wx * sinY + wz * cosY;
        var y2 = wy * cosX - z1 * sinX;            /* 绕 X 轴（上下） */
        var z2 = wy * sinX + z1 * cosX;

        var depth = z2 + CAM;
        if (depth < 80) { continue; }
        var scale = fov / depth;
        var sx = cx + x1 * scale;
        var sy = cy + y2 * scale;
        if (sx < -40 || sx > W + 40 || sy < -40 || sy > H + 40) { continue; }

        /* 一个点就是一记 arc + fill：**没有外发光、没有 shadowBlur、没有相加混合** */
        var a = p.alpha * Math.max(0.22, Math.min(1, 760 / depth)) * (0.25 + 0.75 * e);
        a *= 0.86 + 0.14 * Math.sin(now * p.tws + p.tw);      /* 极轻的明灭，不是闪 */
        if (a < 0.015) { continue; }
        var rr = p.size * (0.6 + 0.4 * scale);
        if (rr < 0.26) { continue; }

        ctx.beginPath();
        ctx.arc(sx, sy, rr, 0, TAU);
        ctx.fillStyle = 'rgba(' + p.cr + ',' + p.cg + ',' + p.cb + ',' + a.toFixed(3) + ')';
        ctx.fill();
      }

      done = allDone;
      autoYawV += 0.00006 * dt;      /* 相机自己再极慢地飘一点，画面不至于像静止的图 */
    }

    /* ---- 拖一下就能转视角（照 Universal.html 那份的手感：按住左键左右上下拖）----
       画布是 pointer-events:none 的背景层，事件落在外面这层 section 上。
       整块 hero **都**接管（标题那颗按钮、显出来的三段话，一样按住就能转）——
       用户 2026-10-02："有文字出来的时候，它也是可以跟着鼠标互动……还是得拖动的时候才可以动"。
       跟"点一下"不打架：拖动会抑制 click，所以"点一下 = 显/收三段话、拖一下 = 转星系"两回事。
       拖动期间由 `.home-hero[data-stars-drag="on"]` 那条规则把**选字**关掉
       （"拖动的时候不要把这个文字选中"）；`hover` 一律不管，只有真的按住拖才动。 */
    function onDown(e) {
      if (e.button && e.button !== 0) { return; }
      var t = e.target;
      if (t && t.closest && t.closest('a')) { return; }
      drag.on = true;
      drag.x = e.clientX;
      drag.y = e.clientY;
      container.setAttribute('data-stars-drag', 'on');
    }
    function onMove(e) {
      if (!drag.on) { return; }
      yaw += (e.clientX - drag.x) * 0.0045;
      pitch += (e.clientY - drag.y) * 0.0038;
      if (pitch < PITCH_MIN) { pitch = PITCH_MIN; }
      if (pitch > PITCH_MAX) { pitch = PITCH_MAX; }
      drag.x = e.clientX;
      drag.y = e.clientY;
      if (st.paused || st.reduceMotion) { draw(nowMs(), 0); }   /* 停着的时候也得跟着手动 */
    }
    function onUp() {
      if (!drag.on) { return; }
      drag.on = false;
      container.removeAttribute('data-stars-drag');
    }
    container.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);

    /* ---- 该停就停：滚出画面 / 切走标签页 ---- */
    function setPaused(off) {
      st.paused = !!off;
      if (raf) { window.cancelAnimationFrame(raf); raf = 0; }
      if (st.paused) { pauseAt = Date.now(); return; }
      /* 暂停期间形成进度照走（不然回来会"接着长"，看着像卡了一下） */
      if (pauseAt) { startAt += Date.now() - pauseAt; pauseAt = 0; }
      last = 0;
      schedule();
    }

    if (window.IntersectionObserver) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { setPaused(!en.isIntersecting); });
      }, { rootMargin: '120px 0px' });
      io.observe(container);
    }
    document.addEventListener('visibilitychange', function () {
      setPaused(document.hidden);
    });

    var rt = 0;
    window.addEventListener('resize', function () {
      window.clearTimeout(rt);
      rt = window.setTimeout(resize, 150);
    });

    resize();
    if (!reduceMotion) { schedule(); }
    instances.push(st);
    return st;
  }

  function autoMount() {
    var nodes = document.querySelectorAll('canvas[data-home-stars]');
    for (var i = 0; i < nodes.length; i += 1) {
      mount(nodes[i].parentNode || nodes[i]);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoMount);
  } else {
    autoMount();
  }

  window.WK_HOME_STARS = {
    mount: mount,
    all: function () { return instances; }
  };
}());
