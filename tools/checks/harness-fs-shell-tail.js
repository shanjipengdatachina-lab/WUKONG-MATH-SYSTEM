/* ============================================================
   全屏覆盖区自检（ide-shell.js 0.3）
   目标：全屏里切栏目不再掉全屏 —— 顶层文档不跳转，目标页装进覆盖区的 iframe
   同一份断言跑两种身份：
     · 普通页（顶层）：负责建覆盖区、同步侧栏、退出全屏时收场
     · 覆盖区里的页面：只标记 data-embed（隐藏自己的侧栏），不再套一层
   ============================================================ */
function assert(ok, label) {
  print((ok ? 'PASS  ' : 'FAIL  ') + label);
  if (!ok) __fail = true;
}
var __fail = false;

var embed = (typeof __SHELL_EMBED !== 'undefined' && __SHELL_EMBED);

function findCreated(cls, tag) {
  for (var i = 0; i < __capture.created.length; i++) {
    var el = __capture.created[i];
    if (cls && el.className === cls) return el;
    if (tag && el.tagName === tag) return el;
  }
  return null;
}

function runTop() {
  var shellClick = __capture.docHandlers.click;
  var popHandler = __capture.winHandlers.popstate;
  var fsHandler = __capture.docHandlers.fullscreenchange;

  assert(typeof shellClick === 'function', '接管了站内链接的点击');
  assert(typeof popHandler === 'function', '接管了前进 / 后退');
  assert(typeof fsHandler === 'function', '接管了退出全屏');

  function clickLink(link) {
    var prevented = false;
    shellClick({
      button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false,
      defaultPrevented: false,
      target: { closest: function () { return link; } },
      preventDefault: function () { prevented = true; }
    });
    return prevented;
  }

  /* 1. 不在全屏、也没进覆盖区：完全不插手，照常跳转 */
  assert(clickLink(railOtherLink) === false, '不在全屏时不插手，照常跳转');
  assert(__capture.created.length === 0, '没有多建任何覆盖区');

  /* 2. 进全屏后点站内链接：拦住顶层跳转，改用覆盖区 */
  document.fullscreenElement = document.documentElement;
  assert(clickLink(railOtherLink) === true, '全屏下点站内链接：拦住顶层跳转');
  var box = findCreated('fs-shell');
  var frame = findCreated(null, 'IFRAME');
  assert(!!box && !!frame, '建出了覆盖区与其中的 iframe');
  assert(__capture.bodyChildren.indexOf(box) >= 0, '覆盖区挂到了页面上');
  assert(frame.getAttribute('src') === 'practice.html', '覆盖区里装的是目标页面');
  assert(__capture.pushed === 'practice.html', '地址栏同步指向目标页');
  assert(toTopStub.hidden === true, '顶层自己的回顶按钮让位给覆盖区里的');

  /* 3. 覆盖区里的页面加载完：侧栏高亮、标签页标题跟着走 */
  frame.contentWindow = { location: { pathname: '/practice.html' } };
  frame.contentDocument = { title: '考点速练 · 悟空数学' };
  frame.handlers.load();
  assert(railOtherLink.getAttribute('aria-current') === 'page', '侧栏高亮切到覆盖区里的那一页');
  assert(railSelfLink.getAttribute('aria-current') === null, '原来那一项的高亮被清掉');
  assert(document.title === '考点速练 · 悟空数学', '标签页标题跟着覆盖区里的页面（连同品牌后缀一起带过来）');

  /* 4. 点已经打开的那一页：原地不动，不重复加载 */
  assert(clickLink(railOtherLink) === true, '点当前页同样拦住顶层跳转');
  assert(frame.getAttribute('src') === 'practice.html', '覆盖区不会重复加载同一页');

  /* 5. 再切一页：只换覆盖区里的地址 */
  assert(clickLink(railSelfLink) === true, '再切一页：照旧拦住顶层跳转');
  assert(frame.getAttribute('src') === 'reader.html', '覆盖区换成新页面');

  /* 6. 前进 / 后退 */
  frame.contentWindow.location.pathname = '/reader.html';
  frame.handlers.load();
  window.location.pathname = '/graph.html';
  popHandler();
  assert(frame.getAttribute('src') === 'graph.html', '后退时覆盖区跟着回退');
  frame.contentWindow.location.pathname = '/graph.html';
  frame.handlers.load();
  window.location.pathname = '/graph.html';
  assert(railSelfLink.getAttribute('aria-current') === null, '侧栏高亮跟着回退清掉');
  assert(railQueryLink.getAttribute('aria-current') === null, '没有高亮也不误标');

  /* 7. 退出全屏：收回覆盖区，用正常方式加载当前页 */
  document.fullscreenElement = null;
  fsHandler();
  assert(__capture.replaced === 'graph.html', '退出全屏后按覆盖区里那一页正常加载');
}

if (embed) {
  assert(document.documentElement.getAttribute('data-embed') === '',
    '覆盖区里的页面：标了 data-embed（隐藏自己的侧栏）');
  assert(typeof __capture.docHandlers.click === 'undefined', '覆盖区里的页面不再套一层覆盖区');
  assert(__capture.created.length === 0, '覆盖区里的页面不再建覆盖区');
} else {
  runTop();
}

print(__fail ? 'RESULT: 有失败项' : 'RESULT: 全部通过');
