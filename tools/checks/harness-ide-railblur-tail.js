/* ============================================================
   侧栏「用鼠标点完就收回去」自检（ide-shell.js 0.4）
   侧栏靠 :focus-within 保持展开，点过的按钮一直占着焦点会收不回去
   ============================================================ */
function assert(ok, label) {
  print((ok ? 'PASS  ' : 'FAIL  ') + label);
  if (!ok) __fail = true;
}
var __fail = false;

assert(typeof railStub.handlers.click === 'function', '侧栏接管了点击');

function clickItem(el, detail) {
  railStub.handlers.click({
    detail: detail === undefined ? 1 : detail,
    target: { closest: function () { return el; } }
  });
}

/* 1. 鼠标点击（detail >= 1）：点完主动失焦 → 侧栏随即收回 */
clickItem(railSelfLink);
assert(railSelfLink.blurred === true, '鼠标点完侧栏：主动失焦（侧栏收回原状）');

railOtherLink.blurred = false;
clickItem(railOtherLink);
assert(railOtherLink.blurred === true, '点别的条目同样收回');

/* 2. 键盘触发（detail === 0）：保留焦点，不破坏键盘操作 */
railQueryLink.blurred = false;
clickItem(railQueryLink, 0);
assert(railQueryLink.blurred === false, '键盘回车 / 空格触发时保留焦点');

/* 3. 点的不是侧栏条目：不动它 */
var outside = { blurred: false, closest: function () { return null; } };
clickItem(outside);
assert(outside.blurred === false, '点到侧栏空白处不会误伤别的元素');

print(__fail ? 'RESULT: 有失败项' : 'RESULT: 全部通过');
