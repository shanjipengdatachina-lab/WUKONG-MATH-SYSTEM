/* ============================================================
   论坛轮播自检 —— 断言
   ============================================================ */
var WK = window.WK_CAROUSEL;
var DATA = window.WK_BANNERS;

assert(!!WK, '轮播组件已加载并暴露测试接口');
assert(!!DATA && DATA.length === 3, '内容文件里有 3 条（实际 ' + (DATA ? DATA.length : '没有') + ' 条）');

/* ---------- 1. 内容本身的形状 ---------- */
var shapeBad = [];
DATA.forEach(function (b) {
  ['id', 'kind', 'title', 'image', 'alt', 'href', 'cta'].forEach(function (k) {
    if (!b[k]) shapeBad.push(b.id + ' 缺 ' + k);
  });
  if (String(b.image).indexOf('assets/img/') !== 0) shapeBad.push(b.id + ' 的图片不在 assets/img 下');
  if (String(b.href).indexOf('.html') < 0) shapeBad.push(b.id + ' 的 href 不是站内页面');
});
assert(shapeBad.length === 0, '每条都填齐了 id / 类型 / 标题 / 图 / 图说 / 链接 / 按钮字（缺的：' + (shapeBad.join('；') || '没有') + '）');
assert(DATA.every(function (b) { return b.from === undefined && b.until === undefined; }),
  '三条都没有写上线下线时间 —— 不会哪天悄悄消失（这两栏留给以后后台）');

/* ---------- 2. 上线下线：纯函数 ---------- */
var now = Date.parse('2026-09-28T12:00:00');
var mix = [
  { id: 'a', title: 'A', image: 'x', from: '2026-09-01', until: '2026-10-01' },   // 在窗口内
  { id: 'b', title: 'B', image: 'x', from: '2026-11-01' },                        // 还没开始
  { id: 'c', title: 'C', image: 'x', until: '2026-08-01' },                       // 已结束
  { id: 'd', title: 'D', image: 'x' },                                            // 常驻
  { id: 'e', title: 'E', image: 'x', from: '不是日期' },                           // 坏日期 → 当没填
  { id: 'f', image: 'x' },                                                        // 缺标题
  { id: 'g', title: 'G' }                                                         // 缺图
];
var kept = WK.activeBanners(mix, now).map(function (b) { return b.id; }).join(',');
assert(kept === 'a,d,e', '按上线下线过一遍：在窗口内 / 常驻 / 坏日期当没填 留下，未开始与已结束滤掉（实际 ' + kept + '）');
assert(WK.activeBanners([], now).length === 0, '空列表就是空的（不炸）');

/* ---------- 3. 自动挂载：页面上有 #forum-banner 就自己搭起来 ---------- */
var api = WK.instance();
assert(!!api, '页面上有挂载点 → 组件自己挂上了（不用页面另外写一行初始化）');
assert(api && api.count === 3, '挂上的是内容文件里那 3 条（实际 ' + (api ? api.count : 'null') + '）');
assert(bannerRoot.hidden === false, '有内容时整块是展开的');
assert(api.shell.getAttribute('role') === 'region' &&
  api.shell.getAttribute('aria-roledescription') === '轮播', '整块是"轮播"区域，读屏能听懂这是什么');
assert(api.slides.length === 3 && api.track.children.length === 3, '轨道里就是 3 张幻灯片');

/* ---------- 4. 默认停在第一张 ---------- */
assert(api.index() === 0, '默认展示第一张');
assert(api.track.style.transform === 'translateX(0%)', '位移是 -0%（实际 ' + api.track.style.transform + '）');
assert(api.dots.length === 3, '3 张配 3 个圆点');
assert(api.dots[0].getAttribute('aria-current') === 'true' &&
  api.dots[1].getAttribute('aria-current') === 'false', '当前那张的圆点对读屏可见');
/* 看不见的那两张：读屏不念、Tab 不进 */
assert(api.slides[1].getAttribute('aria-hidden') === 'true' && api.slides[1].getAttribute('tabindex') === '-1',
  '第二张 aria-hidden 且 Tab 不进（否则 Tab 会跑到看不见的图上）');
assert(api.slides[0].getAttribute('aria-hidden') === 'false' && api.slides[0].getAttribute('tabindex') === null,
  '当前那张没被藏起来');

/* 图片：首张立刻出来，其余懒加载；都有死宽高（不产生布局跳动） */
var img0 = api.slides[0].querySelector('img');
var img1 = api.slides[1].querySelector('img');
assert(img0.getAttribute('loading') === null && img1.getAttribute('loading') === 'lazy',
  '首张不懒加载、后面两张懒加载');
assert(img0.getAttribute('width') === '1280' && img0.getAttribute('height') === '400',
  '图片给了死宽高（加载完成前就把位置留好）');
assert(img0.getAttribute('alt') === DATA[0].alt, '图说来自内容文件（底图不带字，所以这句是读屏唯一的信息）');

/* 图挂了要退回渐变色底，且不留裂图标 */
img1.fire('error');
assert(String(api.slides[1].className).indexOf('is-broken') >= 0, '图片加载失败 → 加 is-broken，退回渐变色底');
assert(img1.getAttribute('alt') === '', '加载失败后清掉图说，不让浏览器画出裂图标与文字');

/* ---------- 5. 自动播：间隔就是 8 秒 ---------- */
resetClock();
api.destroy();
bannerRoot.innerHTML = '';
var auto = WK.mount(bannerRoot, DATA, {});
assert(liveTimers() === 1, '挂上之后有一个定时器在跑（实际 ' + liveTimers() + ' 个）');
assert(liveIntervalMs() === 8000, '间隔就是 8000ms（实际 ' + liveIntervalMs() + '）');
assert(WK.INTERVAL === 8000, '常数也对得上');
tick();
assert(auto.index() === 1, '拨一次表 → 翻到第二张（实际第 ' + (auto.index() + 1) + ' 张）');
assert(auto.track.style.transform === 'translateX(-100%)', '位移跟着走（实际 ' + auto.track.style.transform + '）');
tick(); tick();
assert(auto.index() === 0, '转一圈回到第一张（3 张：1→2→3→1，实际第 ' + (auto.index() + 1) + ' 张）');

/* 手动翻页到边界要绕回去，不能停住 */
auto.goTo(2);
auto.next();
assert(auto.index() === 0, '最后一张再往后 → 绕回第一张');
auto.prev();
assert(auto.index() === 2, '第一张再往前 → 绕到最后一张');

/* ---------- 6. 悬停 / 焦点暂停，移开继续 ---------- */
resetClock();
api.destroy();
var hov = WK.mount(bannerRoot, DATA, {});
assert(liveTimers() === 1, '默认在自动播');
hov.shell.fire('mouseenter');
assert(liveTimers() === 0, '鼠标压上去 → 停（不然人正看着它却翻走了）');
hov.shell.fire('mouseleave');
assert(liveTimers() === 1, '鼠标移开 → 继续');
hov.shell.fire('focusin');
assert(liveTimers() === 0, '键盘焦点进来也停（键盘用户同样要有这个权利）');
hov.shell.fire('focusout');
assert(liveTimers() === 1, '焦点离开 → 继续');

/* ---------- 7. 暂停 / 继续按钮 ---------- */
var playBtn = hov.playBtn;
assert(!!playBtn, '有超过一张时才有暂停按钮');
assert(playBtn.getAttribute('aria-pressed') === 'false' && playBtn.textContent === '暂停',
  '正在自动播时按钮显示"暂停"');
playBtn.fire('click');
assert(hov.playing() === false && liveTimers() === 0, '点一下 → 停了，定时器也清掉');
assert(playBtn.getAttribute('aria-pressed') === 'true' && playBtn.textContent === '继续',
  '按钮翻成"继续"（状态对读屏也可见）');
tick();
assert(hov.index() === 0, '停住之后拨表也不动');
playBtn.fire('click');
assert(hov.playing() === true && liveTimers() === 1, '再点一下 → 继续播');

/* 手动翻页后重新计时：定时器先清后建，且没有变成"停播" */
var clearedBefore = __clock.cleared;
auto = hov;
auto.dots[2].fire('click');
assert(auto.index() === 2, '点第 3 个圆点 → 跳到第 3 张');
assert(__clock.cleared > clearedBefore && liveTimers() === 1,
  '手动翻页会重新计时（旧定时器清掉、新定时器建起来），而不是把自动播关掉');
assert(auto.playing() === true, '手动翻页不会把自动播永久关掉');
assert(auto.shell.getAttribute('aria-live') === 'polite',
  '手动翻过之后才允许读屏播报（自动播时一直播报是打扰）');

/* ---------- 8. 左右箭头 ---------- */
auto.prevBtn.fire('click');
assert(auto.index() === 1, '点"上一张" → 回到第 2 张');
auto.nextBtn.fire('click');
assert(auto.index() === 2, '点"下一张" → 第 3 张');

/* ---------- 9. 手指滑动：超过阈值才翻 ---------- */
auto.goTo(0);
auto.shell.fire('pointerdown', { clientX: 300 });
auto.shell.fire('pointerup', { clientX: 240 });
assert(auto.index() === 1, '向左滑 60px → 下一张（实际第 ' + (auto.index() + 1) + ' 张）');
auto.shell.fire('pointerdown', { clientX: 240 });
auto.shell.fire('pointerup', { clientX: 300 });
assert(auto.index() === 0, '向右滑 60px → 上一张');
auto.shell.fire('pointerdown', { clientX: 240 });
auto.shell.fire('pointerup', { clientX: 230 });
assert(auto.index() === 0, '只滑 10px（手抖）→ 不翻页');
assert(WK.SWIPE_MIN === 40, '阈值就是 40px');

/* ---------- 10. 「减少动态效果」→ 完全不自动播 ---------- */
resetClock();
auto.destroy();
__MATCH['(prefers-reduced-motion: reduce)'] = true;
var still = WK.mount(bannerRoot, DATA, {});
assert(still.still === true, '认得出系统设了"减少动态效果"');
assert(liveTimers() === 0, '完全不自动播（一个定时器都不建）');
assert(String(still.track.className).indexOf('is-still') >= 0, '轨道带上 is-still，过渡也关掉');
assert(still.playBtn === null, '不放"暂停"按钮 —— 放一个按下去什么都不会发生的按钮更糟');
assert(still.dots.length === 3 && still.prevBtn !== null, '但手动翻页照旧可用');
still.next(true);
assert(still.index() === 1, '手动照样能翻（减少动效不是禁用交互）');
__MATCH['(prefers-reduced-motion: reduce)'] = false;

/* ---------- 11. 只有一张 / 一张都没有 ---------- */
resetClock();
still.destroy();
var one = WK.mount(mkEl('div'), [DATA[0]], {});
assert(one.count === 1 && one.dots.length === 0, '只有一张 → 不画圆点');
assert(one.prevBtn === null && one.nextBtn === null, '只有一张 → 不画左右箭头（点了也没反应的东西不要摆出来）');
assert(one.playBtn === null, '只有一张 → 也没有暂停按钮');
assert(liveTimers() === 0, '只有一张 → 不自动播');

var emptyRoot = mkEl('div');
var none = WK.mount(emptyRoot, [], {});
assert(none === null, '一张都没有 → 不返回实例');
assert(emptyRoot.hidden === true, '一张都没有 → 整块收起，不留一条空白');
assert(window.WK_BANNERS.length === 3, '内容文件本身没被改动');

/* ---------- 12. 定时器不泄漏 ---------- */
resetClock();
var leak = WK.mount(mkEl('div'), DATA, {});
assert(liveTimers() === 1, '挂上有一个定时器');
leak.destroy();
assert(liveTimers() === 0, 'destroy() 清掉定时器（不清的话重建一次就多一个，翻页会越翻越快）');
var again = WK.mount(mkEl('div'), DATA, {});
assert(liveTimers() === 1, '再挂一个，仍然只有一个定时器');
again.destroy();
assert(liveTimers() === 0, '再销毁，又是 0 个');

out(__fail ? 'RESULT: 有失败项' : 'RESULT: 全部通过');
