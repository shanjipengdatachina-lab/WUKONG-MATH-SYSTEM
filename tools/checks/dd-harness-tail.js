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

out(__fail ? 'RESULT: 有失败项' : 'RESULT: 全部通过');
