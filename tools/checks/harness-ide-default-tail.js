/* ============================================================
   左栏默认展开（章节页）自检
   同一份断言跑两种场景：
     · 章节页：.reader-shell[data-left-default="open"] + 上次收起过 → 进来就该是展开的
     · 普通页：没有声明 + 上次收起过 → 仍然尊重上次的收起状态
   ============================================================ */
function assert(ok, label) {
  print((ok ? 'PASS  ' : 'FAIL  ') + label);
  if (!ok) __fail = true;
}
var __fail = false;

var alwaysOpen = (typeof __SHELL_LEFT_DEFAULT === 'string' && __SHELL_LEFT_DEFAULT === 'open');

assert(__capture.store['wkmath.shell.left'] === 'hidden', '场景就位：上一次把左栏收起过');

if (alwaysOpen) {
  assert(shellStub.getAttribute('data-left-default') === 'open', '章节页声明了「左栏默认展开」');
  assert(shellStub.getAttribute('data-left') === null, '进章节页：目录默认就是开着的');
  assert(leftBtn.getAttribute('aria-pressed') === 'true', '左栏开关同步为展开态');
  assert(collapseBtn.getAttribute('aria-expanded') === 'true', '左栏内按钮同步为展开');
} else {
  assert(shellStub.getAttribute('data-left-default') === null, '普通页没有这个声明');
  assert(shellStub.getAttribute('data-left') === 'hidden', '普通页仍然尊重上次的收起状态');
  assert(leftBtn.getAttribute('aria-pressed') === 'false', '左栏开关同步为收起态');
}

/* 默认展开 ≠ 锁死：手动切换依然要生效并落盘 */
var startedHidden = (shellStub.getAttribute('data-left') === 'hidden');
var startTitle = collapseBtn.getAttribute('title');

__capture.collapseHandler({ preventDefault: function () {}, stopPropagation: function () {} });
assert(shellStub.getAttribute('data-left') === (startedHidden ? null : 'hidden'), '手动切换依然生效（默认开 ≠ 锁死）');
assert(__capture.store['wkmath.shell.left'] === (startedHidden ? 'shown' : 'hidden'), '切换状态照常落盘');

__capture.collapseHandler({ preventDefault: function () {}, stopPropagation: function () {} });
assert(shellStub.getAttribute('data-left') === (startedHidden ? 'hidden' : null), '再点一次切回原状');
assert(collapseBtn.getAttribute('title') === startTitle, '按钮提示语随状态恢复');

print(__fail ? 'RESULT: 有失败项' : 'RESULT: 全部通过');
