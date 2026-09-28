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

out(__fail ? 'RESULT: 有失败项' : 'RESULT: 全部通过');
