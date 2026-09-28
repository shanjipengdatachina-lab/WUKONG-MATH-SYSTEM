/* ============================================================
   ide-shell.js 自检断言（外壳：左右栏显隐 / 快捷键 / 状态记忆）
   ============================================================ */
function assert(ok, label) {
  print((ok ? 'PASS  ' : 'FAIL  ') + label);
  if (!ok) __fail = true;
}
var __fail = false;
var noop = function () {};

/* 1. 绑定 */
assert(typeof __capture.leftHandler === 'function', '顶栏左栏开关已绑定');
assert(typeof __capture.rightHandler === 'function', '顶栏右栏开关已绑定');
assert(typeof __capture.sideHandler === 'function', '右栏内收起按钮已绑定');
assert(typeof __capture.collapseHandler === 'function', '左栏内收起按钮已绑定');
assert(leftBtn.getAttribute('aria-pressed') === 'true', '初始左栏为显示态');
assert(rightBtn.getAttribute('aria-pressed') === 'true', '初始右栏为显示态');

/* 2. 顶栏开关 */
__capture.leftHandler();
assert(shellStub.getAttribute('data-left') === 'hidden', '点顶栏开关 → 左栏收起成窄条');
assert(leftBtn.getAttribute('aria-pressed') === 'false', '左栏开关状态同步');
assert(collapseBtn.getAttribute('aria-expanded') === 'false', '左栏内按钮同步');
assert(collapseBtn.getAttribute('title') === '展开目录', '左栏内按钮提示语随状态切换');
assert(__capture.store['wkmath.shell.left'] === 'hidden', '左栏状态写入 localStorage');

__capture.leftHandler();
assert(shellStub.getAttribute('data-left') === null, '再点一次恢复左栏');
assert(__capture.store['wkmath.shell.left'] === 'shown', '恢复状态同样落盘');

/* 3. 右栏：面板内按钮 */
__capture.sideHandler();
assert(shellStub.getAttribute('data-right') === 'hidden', '右栏内按钮 → 右栏整体隐藏');
assert(rightBtn.getAttribute('aria-pressed') === 'false', '顶栏右栏开关同步');
assert(__capture.store['wkmath.shell.right'] === 'hidden', '右栏状态写入 localStorage');

/* 4. 左栏内按钮（label 内部，需阻止 label 联动） */
var prevented = false;
var stopped = false;
__capture.collapseHandler({
  preventDefault: function () { prevented = true; },
  stopPropagation: function () { stopped = true; }
});
assert(prevented && stopped, '左栏内按钮阻止了 label 的默认联动');
assert(shellStub.getAttribute('data-left') === 'hidden', '左栏内按钮也能收起左栏');

/* 5. 快捷键：⌘/Ctrl + B 左栏，⌘/Ctrl + ⌥/Alt + B 右栏 */
var kb = __capture.docHandlers.keydown;
assert(typeof kb === 'function', '已绑定键盘快捷键');
kb({ metaKey: true, ctrlKey: false, altKey: false, code: 'KeyB', preventDefault: noop });
assert(shellStub.getAttribute('data-left') === null, '⌘B 恢复左栏');
kb({ metaKey: true, ctrlKey: false, altKey: true, code: 'KeyB', preventDefault: noop });
assert(shellStub.getAttribute('data-right') === null, '⌘⌥B 恢复右栏');
kb({ metaKey: false, ctrlKey: false, altKey: false, code: 'KeyB', preventDefault: noop });
assert(shellStub.getAttribute('data-left') === null, '没有修饰键时不响应');
kb({ metaKey: true, ctrlKey: false, altKey: false, code: 'KeyX', preventDefault: noop });
assert(shellStub.getAttribute('data-left') === null, '非 B 键不响应');

print(__fail ? 'RESULT: 有失败项' : 'RESULT: 全部通过');
