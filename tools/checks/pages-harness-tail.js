/* ============================================================
   章节树自检（pages.js）
   要求：进页面章节目录是开的；点章节后该章的节列表是开的（不会被点关）
   ============================================================ */
var __fails = 0;
function check(ok, label) {
  out((ok ? 'PASS  ' : 'FAIL  ') + label);
  if (!ok) __fails++;
}
function click(el) {
  if (!el.handlers.click) return;      // 没绑点击的行，点了自然什么也不发生
  el.handlers.click({ preventDefault: function () {}, target: el });
}

/* 1. 初始态 */
check(typeof chA.handlers.click === 'function', '带节列表的章绑定了点击');
check(typeof chC.handlers.click !== 'function', '没有子列表的章不绑定多余点击');
check(subA.getAttribute('data-subtree') === 'expanded', '初始：当前章的节列表是展开的');
check(chA.getAttribute('aria-expanded') === 'true', '初始：当前章 aria-expanded=true');
check(subB.getAttribute('data-subtree') === 'collapsed', '初始：其它章的节列表是收起的');
check(chB.getAttribute('aria-expanded') === 'false', '初始：其它章 aria-expanded=false');

/* 2. 点章节：该章列表要开 */
click(chB);
check(subB.getAttribute('data-subtree') === 'expanded', '点击章节后：该章的节列表是开着的');
check(chB.getAttribute('aria-expanded') === 'true', '所点章节标注为展开');
check(subA.getAttribute('data-subtree') === 'collapsed', '同册其它章自动收起，列表始终清爽');
check(chA.getAttribute('aria-expanded') === 'false', '被收起的章标注为收起');

/* 3. 再点同一章：不能被点关 */
click(chB);
check(subB.getAttribute('data-subtree') === 'expanded', '再点同一章不会被点关（默认保持开）');
check(subA.getAttribute('data-subtree') === 'collapsed', '其它章依旧是收起的');

/* 4. 没有子列表的章：点了不影响别的章 */
click(chC);
check(subA.getAttribute('data-subtree') === 'collapsed' && subB.getAttribute('data-subtree') === 'expanded',
  '点没有子列表的章，其它章状态不受影响');

/* 5. 册的展开 / 收起照旧可用 */
check(chapterList.getAttribute('data-subtree') === 'expanded', '初始：整册章列表是展开的');
check(volumeHead.getAttribute('aria-expanded') === 'true', '册标题 aria-expanded=true');
click(volumeHead);
check(chapterList.getAttribute('data-subtree') === 'collapsed', '点册标题：整册章列表收起');
check(volumeHead.getAttribute('aria-expanded') === 'false', '册标题 aria-expanded 同步为收起');
click(volumeHead);
check(chapterList.getAttribute('data-subtree') === 'expanded', '再点册标题：整册章列表又展开');

out(__fails ? 'RESULT: 有失败项' : 'RESULT: 全部通过');
