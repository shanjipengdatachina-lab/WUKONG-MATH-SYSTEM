/* ============================================================
   阅读与显示设置 · 断言
   ============================================================ */

var THEME_KEY = 'wkmath.display.theme';
var FS_KEY = 'wkmath.display.fs';

/* 1. 默认：亮色 + 标准字号，而且**不写盘** */
eq(__store[THEME_KEY], undefined, '没选过就不写盘（"没设过"要能与"设成默认"区分开）');
eq(__html.getAttribute('data-wk-theme'), 'light', '默认配色是亮色，并且当场就落在 <html> 上');
eq(__html.hasAttribute('data-wk-fs'), false, '标准档不挂 data-fs 属性（不留半个状态）');
eq(window.WK_DISPLAY.initial.theme, 'light', '对外能读到初始状态');
eq(window.WK_DISPLAY.initial.fs, 'std', '初始字号是标准');

/* 2. 三档字号：写了属性、也写了盘 */
var afterLg = window.WK_DISPLAY.set({ fs: 'lg' });
eq(__html.getAttribute('data-wk-fs'), 'lg', '选「大」→ <html> 上是 data-wk-fs="lg"');
eq(__store[FS_KEY], 'lg', '选「大」→ 记在本机');
eq(afterLg.fs, 'lg', 'set 返回最新状态（调用方不用自己再读一次）');

window.WK_DISPLAY.set({ fs: 'xl' });
eq(__html.getAttribute('data-wk-fs'), 'xl', '选「特大」→ data-wk-fs="xl"');

window.WK_DISPLAY.set({ fs: 'std' });
eq(__html.hasAttribute('data-wk-fs'), false, '切回「标准」→ 属性被摘掉，不是写成 "std"');

/* 3. 三档配色 */
window.WK_DISPLAY.set({ theme: 'dark' });
eq(__html.getAttribute('data-wk-theme'), 'dark', '选「暗色」→ <html> 上是 data-wk-theme="dark"');
eq(__store[THEME_KEY], 'dark', '选「暗色」→ 记在本机');
window.WK_DISPLAY.set({ theme: 'mid' });
eq(__html.getAttribute('data-wk-theme'), 'mid', '选「中色」→ data-wk-theme="mid"');

/* 4. 只改一项不许把另一项碰掉 */
window.WK_DISPLAY.set({ fs: 'lg' });
eq(window.WK_DISPLAY.get().theme, 'mid', '只改字号，配色保持不变');
eq(__html.getAttribute('data-wk-theme'), 'mid', '而且 <html> 上的配色也没被顺手改掉');

/* 5. 认不出来的值一律忽略 / 回落 */
window.WK_DISPLAY.set({ theme: 'purple' });
eq(window.WK_DISPLAY.get().theme, 'mid', '不认识的取色名被忽略（当次不生效）');
__store[THEME_KEY] = 'purple';
__store[FS_KEY] = 'huge';
var fallen = window.WK_DISPLAY.read();
eq(fallen.theme, 'light', '盘里存了坏配色 → 回落亮色（宁可用默认，也不能白底白字）');
eq(fallen.fs, 'std', '盘里存了坏字号 → 回落标准');
eq(__html.hasAttribute('data-wk-fs'), false, '回落之后属性也是干净的');

/* 6. 每次改动都广播一次（白板靠它换板面） */
var before = __events.length;
window.WK_DISPLAY.set({ theme: 'dark' });
eq(__events.length, before + 1, '改一次广播一次');
var last = __events[__events.length - 1];
eq(last.type, 'wk:display', '广播的事件名是 wk:display');
eq(last.detail.theme, 'dark', '事件里带的是最新配色');
eq(last.detail.fs, 'std', '事件里也带了字号');

/* 7. 设置页那两行按钮：绑上了、按下了、点得动 */
document.handlers.DOMContentLoaded();
eq(fsChips[0]._pressed, 'true', '进页面时「标准」是按下态（与当前字号一致）');
eq(themeChips[2]._pressed, 'true', '进页面时「暗色」是按下态（与当前配色一致）');

fsChips[2].click();
eq(window.WK_DISPLAY.get().fs, 'xl', '点「特大」→ 字号真的切了');
eq(__html.getAttribute('data-wk-fs'), 'xl', '点「特大」→ <html> 上跟着变');
eq(fsChips[2]._pressed, 'true', '点完「特大」自己变成按下态');
eq(fsChips[0]._pressed, 'false', '同时「标准」被松开（同一组里只许亮一个）');

themeChips[1].click();
eq(window.WK_DISPLAY.get().theme, 'mid', '点「中色」→ 配色真的切了');
eq(__html.getAttribute('data-wk-theme'), 'mid', '点「中色」→ <html> 上跟着变');
eq(themeChips[1]._pressed, 'true', '「中色」亮起');
eq(themeChips[2]._pressed, 'false', '「暗色」松开');

/* 8. 高亮色（用户要的"后台设置可以选择高亮颜色；给几个配色"）：
   默认是松绿（Trae 品牌绿那一族）—— 与字号"标准档"同一套规矩，默认不写属性。
   换色要同时做三件事：写 <html>、记本机、广播；坏值一律回落默认。 */
eq(window.WK_DISPLAY.get().accent, 'green', '默认高亮色是松绿');
eq(__html.hasAttribute('data-wk-accent'), false, '默认那一档不写属性（"没设过"与"设成默认"在 DOM 上一样）');
eq(window.WK_DISPLAY.accents.length, 7, '给了七个可选高亮色（六个原色 + 用户要的中国红）');
eq(window.WK_DISPLAY.accents[0], 'green', '第一个就是默认那档');
eq(window.WK_DISPLAY.accentLabel.amber, '琥珀', '每个色都有中文名（按钮上要写）');
eq(window.WK_DISPLAY.accentLabel.red, '中国红', '中国红那一档的中文名就是"中国红"');
eq(window.WK_DISPLAY.accents[6], 'red', '中国红排在最后一个（没插队改顺序）');

var beforeAccent = __events.length;
var afterAccent = window.WK_DISPLAY.set({ accent: 'violet' });
eq(__html.getAttribute('data-wk-accent'), 'violet', '选了紫罗兰 → <html> 上挂着 data-wk-accent="violet"');
eq(__store['wkmath.display.accent'], 'violet', '选了紫罗兰 → 记在本机');
eq(afterAccent.accent, 'violet', 'set 返回最新状态（调用方不用自己再读一次）');
eq(__events.length, beforeAccent + 1, '改一次高亮色广播一次');
eq(__events[__events.length - 1].detail.accent, 'violet', '事件里带的是最新高亮色');

/* 只改一项不许把别的碰掉 —— 三组设置各自独立 */
window.WK_DISPLAY.set({ fs: 'lg' });
eq(window.WK_DISPLAY.get().accent, 'violet', '只改字号，高亮色保持不变');
eq(__html.getAttribute('data-wk-accent'), 'violet', '而且 <html> 上还挂着');

/* 认不出来的值一律忽略 / 回落 */
window.WK_DISPLAY.set({ accent: 'gold' });
eq(window.WK_DISPLAY.get().accent, 'violet', '不认识的高亮色被忽略（当次不生效）');
__store['wkmath.display.accent'] = 'gold';
var fallenAccent = window.WK_DISPLAY.read();
eq(fallenAccent.accent, 'green', '盘里存了坏高亮色 → 回落松绿');
eq(__html.hasAttribute('data-wk-accent'), false, '回落之后属性也是干净的');

/* 设置页那一行：按下态跟着状态走，同一组只亮一个 */
window.WK_DISPLAY.set({ accent: 'green' });
document.handlers.DOMContentLoaded();
eq(accentChips[0]._pressed, 'true', '进页面时「松绿」是按下态（与当前高亮色一致）');
eq(accentChips[3]._pressed, 'false', '其余几个是松开的');
accentChips[3].click();
eq(window.WK_DISPLAY.get().accent, 'amber', '点「琥珀」→ 高亮色真的切了');
eq(__html.getAttribute('data-wk-accent'), 'amber', '点「琥珀」→ <html> 上跟着变');
eq(accentChips[3]._pressed, 'true', '「琥珀」自己亮起');
eq(accentChips[0]._pressed, 'false', '同时「松绿」被松开（同一组里只许亮一个）');
accentChips[0].click();
eq(__html.hasAttribute('data-wk-accent'), false, '点回「松绿」→ 属性被摘掉（不是写成 green）');

/* ------------------------------------------------------------ *
 * 掌握度色彩方案（用户 2026-09-30）
 *   "底部设置你可以多搞几个色彩方案……默认有 6 个色彩方案。点击色彩方案，
 *    相当于改了筛选里面那个掌握对应的色彩方案。"
 *   它改的是轴上彩条那七个 --math-bar-*；默认那套（松绿）与字号 / 高亮色同一套规矩：不写属性。
 * ------------------------------------------------------------ */
out('---- 掌握度色彩方案 ----');
eq(window.WK_DISPLAY.get().scheme, 'green', '默认那套是松绿（与 :root 里那一套是同一个）');
eq(__html.hasAttribute('data-wk-scheme'), false, '默认那套不写属性（"没设过"与"设成默认"在 DOM 上一样）');
eq(window.WK_DISPLAY.schemes.length, 6, '给了六套方案（用户点名"默认有 6 个色彩方案"）');
eq(window.WK_DISPLAY.schemes[0], 'green', '第一个就是默认那档');
eq(window.WK_DISPLAY.schemes[5], 'a11y', '最后一套是"无障碍"（色觉友好 + 转灰度也分得开）');
eq(window.WK_DISPLAY.schemeLabel.a11y, '无障碍', '每套都有中文名（按钮上要写）');
eq(window.WK_DISPLAY.keys.scheme, 'wkmath.display.scheme', '本机存储有自己的名字空间（不撞字号 / 配色 / 高亮色）');

var beforeScheme = __events.length;
var afterScheme = window.WK_DISPLAY.set({ scheme: 'blue' });
eq(__html.getAttribute('data-wk-scheme'), 'blue', '选了靛蓝 → <html> 上挂着 data-wk-scheme="blue"');
eq(__store['wkmath.display.scheme'], 'blue', '选了靛蓝 → 记在本机');
eq(afterScheme.scheme, 'blue', 'set 返回最新状态');
eq(__events.length, beforeScheme + 1, '改一次色彩方案广播一次');
eq(__events[__events.length - 1].detail.scheme, 'blue', '事件里带的是最新色彩方案');

/* 只改色彩方案不许把别的碰掉 —— 四组设置各自独立 */
eq(window.WK_DISPLAY.get().accent, 'green', '只改色彩方案，高亮色保持不变');
eq(window.WK_DISPLAY.get().fs, 'lg', '字号也保持不变');

/* 认不出来的值一律忽略 / 回落 */
window.WK_DISPLAY.set({ scheme: 'rainbow' });
eq(window.WK_DISPLAY.get().scheme, 'blue', '不认识的方案被忽略（当次不生效）');
__store['wkmath.display.scheme'] = 'rainbow';
var fallenScheme = window.WK_DISPLAY.read();
eq(fallenScheme.scheme, 'green', '盘里存了坏方案 → 回落松绿');
eq(__html.hasAttribute('data-wk-scheme'), false, '回落之后属性也是干净的');

/* 设置页那一行：按下态跟着状态走，同一组只亮一个 */
window.WK_DISPLAY.set({ scheme: 'green' });
document.handlers.DOMContentLoaded();
eq(schemeChips[0]._pressed, 'true', '进页面时「松绿」是按下态（与当前色彩方案一致）');
eq(schemeChips[1]._pressed, 'false', '其余几个是松开的');
schemeChips[1].click();
eq(window.WK_DISPLAY.get().scheme, 'blue', '点「靛蓝」→ 方案真的切了');
eq(__html.getAttribute('data-wk-scheme'), 'blue', '点「靛蓝」→ <html> 上跟着变');
eq(schemeChips[1]._pressed, 'true', '「靛蓝」自己亮起');
eq(schemeChips[0]._pressed, 'false', '同时「松绿」被松开（同一组里只许亮一个）');
schemeChips[0].click();
eq(__html.hasAttribute('data-wk-scheme'), false, '点回「松绿」→ 属性被摘掉（不是写成 green）');

/* ------------------------------------------------------------ *
 * 面板透明度（用户 2026-10-01）
 *   "无论是白板还是数轴，都可以在设置里调整透明度。在总设置里设置面板的透明度，
 *    比如默认设为 90%。这样我们就能看到后面的内容，显得不那么实，而显得空灵一点。"
 *   它改的是浮窗的**底**：display.js 只负责把一个 0~1 的数写到 <html> 的
 *   `--math-panel-a` 上，三个配色的 `--math-panel` 各自拼出自己那半透明底。
 * ------------------------------------------------------------ */
out('---- 面板透明度 ----');
eq(window.WK_DISPLAY.get().panel, 90, '默认面板透明度是 90%');
eq(window.WK_DISPLAY.panelDefault, 90, '默认值对外也能读到');
eq(window.WK_DISPLAY.panelMin, 40, '下限 40%（再低字就开始糊了）');
eq(window.WK_DISPLAY.panelMax, 100, '上限 100%');
eq(window.WK_DISPLAY.keys.panel, 'wkmath.display.panel', '本机存储有自己的名字空间（不撞前面四项）');
eq(__html.style.getPropertyValue('--math-panel-a'), '0.9', '默认 90% 也**照写**到 <html> 的 --math-panel-a 上（不然调低再调回来会留下旧值）');

var beforePanel = __events.length;
var afterPanel = window.WK_DISPLAY.set({ panel: 60 });
eq(__html.style.getPropertyValue('--math-panel-a'), '0.6', '拖到 60% → <html> 上换成 0.6');
eq(__store['wkmath.display.panel'], '60', '拖到 60% → 记在本机');
eq(afterPanel.panel, 60, 'set 返回最新状态（调用方不用自己再读一次）');
eq(__events.length, beforePanel + 1, '改一次面板透明度广播一次');
eq(__events[__events.length - 1].detail.panel, 60, '事件里带的是最新面板透明度（别的页面靠它跟上）');

/* 只改这一项不许把别的碰掉 —— 五组设置各自独立 */
eq(window.WK_DISPLAY.get().scheme, 'green', '只改面板透明度，色彩方案保持不变');
eq(window.WK_DISPLAY.get().theme, 'mid', '配色也保持不变');

/* 越界一律夹回区间（拖不出来，但存进去的坏值也不许放行） */
eq(window.WK_DISPLAY.set({ panel: 5 }).panel, 40, '拖到 5% 被夹回下限 40%');
eq(window.WK_DISPLAY.set({ panel: 900 }).panel, 100, '拖到 900% 被夹回上限 100%');
eq(window.WK_DISPLAY.set({ panel: 'abc' }).panel, 90, '说不清的值 → 回默认 90%');
window.WK_DISPLAY.set({ panel: 90 });

__store['wkmath.display.panel'] = '3';      /* 盘里存了个越界值 */
eq(window.WK_DISPLAY.read().panel, 90, '盘里存了越界值 → 回落 90%（不能因为一个坏值把面板弄透明）');

/* 设置页那颗滑块：进页面就对位、拖一下真的生效、旁边的百分数跟着走 */
window.WK_DISPLAY.set({ panel: 90 });
document.handlers.DOMContentLoaded();
eq(panelRange.value, '90', '进页面时滑块停在当前值上（不是写死的 90）');
eq(panelOut.textContent, '90%', '旁边的百分数也先对位');
panelRange.drag(70);
eq(window.WK_DISPLAY.get().panel, 70, '拖一下 → 面板透明度真的跟着变（不必等松手）');
eq(__html.style.getPropertyValue('--math-panel-a'), '0.7', '拖一下 → <html> 上立刻换成 0.7');
eq(panelOut.textContent, '70%', '拖一下 → 旁边的百分数跟着走');

out(__fail ? 'RESULT: 有失败项' : 'RESULT: 全部通过');
