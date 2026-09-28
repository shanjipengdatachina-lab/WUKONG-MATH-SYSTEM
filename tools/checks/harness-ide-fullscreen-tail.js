/* ============================================================
   侧栏「全屏」按钮自检（ide-shell.js）
   要求：点一下整页全屏，再点退出；Esc 退出后按钮状态也要跟上
   ============================================================ */
function assert(ok, label) {
  print((ok ? 'PASS  ' : 'FAIL  ') + label);
  if (!ok) __fail = true;
}
var __fail = false;

/* 1. 绑定与初始态 */
assert(typeof fsBtn.handlers.click === 'function', '侧栏全屏按钮绑定了点击');
assert(fsBtn.hidden === false, '浏览器支持时按钮正常显示');
assert(fsBtn.getAttribute('aria-pressed') === 'false', '初始不是全屏');
assert(fsLabel.textContent === '全屏', '初始文案是「全屏」');
assert(fsBtn.getAttribute('title') === '全屏模式（Esc 退出）', '初始提示语正确');

/* 2. 点一下 → 整页全屏 */
fsBtn.handlers.click();
assert(document.fullscreenElement === document.documentElement, '请求的是整页全屏');
assert(fsBtn.getAttribute('aria-pressed') === 'true', '按钮同步为全屏态');
assert(fsLabel.textContent === '退出全屏', '文案改为「退出全屏」');
assert(fsBtn.getAttribute('title') === '退出全屏（Esc）', '提示语改为退出');

/* 3. 再点一下 → 退出 */
fsBtn.handlers.click();
assert(!document.fullscreenElement, '再点一次退出全屏');
assert(fsBtn.getAttribute('aria-pressed') === 'false', '退出后按钮状态复位');
assert(fsLabel.textContent === '全屏', '文案复位为「全屏」');

/* 4. Esc 退出（浏览器直接改状态）→ fullscreenchange 要跟上 */
var change = __capture.docHandlers.fullscreenchange;
assert(typeof change === 'function', '监听了 fullscreenchange');
document.documentElement.requestFullscreen();
change();
assert(fsBtn.getAttribute('aria-pressed') === 'true', '按 F11/Esc 进入全屏后按钮同步');
document.exitFullscreen();
change();
assert(fsBtn.getAttribute('aria-pressed') === 'false', 'Esc 退出后按钮同步复位');
assert(fsLabel.textContent === '全屏', 'Esc 退出后文案同步复位');

/* 5. 与左右栏互不干扰 */
assert(shellStub.getAttribute('data-left') === null, '全屏不影响左栏状态');
assert(shellStub.getAttribute('data-right') === null, '全屏不影响右栏状态');

print(__fail ? 'RESULT: 有失败项' : 'RESULT: 全部通过');
