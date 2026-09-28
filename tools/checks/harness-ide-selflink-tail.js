/* ============================================================
   侧栏「当前页入口不再重载」自检（ide-shell.js）
   重载整个文档 = 必然退出浏览器全屏，所以点已经打开的那一项要拦掉
   ============================================================ */
function assert(ok, label) {
  print((ok ? 'PASS  ' : 'FAIL  ') + label);
  if (!ok) __fail = true;
}
var __fail = false;

assert(typeof railSelfLink.handlers.click === 'function', '指向当前页的入口被接管');
assert(railOtherLink.handlers.click === undefined, '指向别页的入口不受影响，照常跳转');
assert(railQueryLink.handlers.click === undefined, '带参数的同名入口照常跳转（不许误拦）');

var prevented = false;
railSelfLink.handlers.click({ preventDefault: function () { prevented = true; } });
assert(prevented, '点当前页入口不再整页重载（重载必然掉全屏）');
assert(__capture.scrollCalls.length === 0, '已经贴顶时不做多余滚动');

window.scrollY = 900;
railSelfLink.handlers.click({ preventDefault: function () {} });
assert(__capture.scrollCalls.length === 1, '往下滚过时给一次「回到顶部」的回应');
assert(__capture.scrollCalls[0] && __capture.scrollCalls[0].top === 0, '回应的确是回到顶部');
window.scrollY = 0;

print(__fail ? 'RESULT: 有失败项' : 'RESULT: 全部通过');
