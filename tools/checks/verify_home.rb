# encoding: UTF-8
# 首页体检（home.html + assets/js/home-stars.js + assets/css/tokens.css）
#
# 首页现在的形态（用户 2026-10-02 这一版）：
#   **一块黑底 + 中间两行字 + 背后一片干净的点（星云）**；
#   那三段宣言**默认收着**，点标题才显出来。
#   用户原话："简单的、纯粹的点……不是带光晕的点。然后慢慢形成这个星云，就是类似一个银河系，
#             但是是干净的点。真的慢慢在旋转，有种很静谧、很神秘、很安静的那种感觉。就是单纯的点。"
#             "你只有点击这个标题，然后它再显现出来。"
#
# 这一页当天改了五轮，每一轮都是"做出来看过就改"，所以守线**大半是反向的**：
#   ① 标题+副题+两个大按钮+数轴+索引那面"目录墙" → 用户："首页除了标题和粒子 其它的都删掉"
#   ② 从他那份 Universal.html 搬来的旋臂星系（引擎 assets/js/home-galaxy.js）→ "不要这个粒子效果了"
#   ③ 黑底+标题+宣言（引擎整份删掉）
#   ④ 标题改全大写、加中文副题、两行等宽、居中 → 段落改左对齐+空两格
#   ⑤ 现在这一版：粒子**重写**回来（干净、慢、会成形），宣言默认收着、点标题才出
# 所以这里逐条钉死"哪一版不许再长回来"，也钉死这一版自己的那几条硬要求：
#   点必须是**干净的**（没有光晕/没有公式星尘）、必须**慢**、必须**从散点长出来**；
#   ② 之后又加了一条：四条臂必须**看得出弧度**（"弄得像银河系一点"）、还得**拖得动**。
ROOT = (ENV['WKMATH_ROOT'] || File.expand_path('../..', __dir__)).dup.force_encoding('UTF-8')

page    = File.read(File.join(ROOT, 'home.html'), encoding: 'UTF-8')
stars   = File.read(File.join(ROOT, 'assets/js/home-stars.js'), encoding: 'UTF-8')
tokens  = File.read(File.join(ROOT, 'assets/css/tokens.css'), encoding: 'UTF-8')
sandbox = File.read(File.join(ROOT, 'Universal.html'), encoding: 'UTF-8')

issues = []

# ---------- 1. 页面：黑底 + 那两行字 + 星云 ----------
issues << '首页少了那一块（section.home-hero / data-home-hero）' unless
  page =~ /<section class="home-hero" data-home-hero/
issues << '首页标题丢了（应 h1#hero-title「WUKONG MATH UNIVERSAL」，全大写）' unless
  page =~ /id="hero-title"[\s\S]{0,200}?WUKONG MATH UNIVERSAL</
issues << '首页的中文副题丢了（应「悟空云界交互空间实验室 · 数学宇宙」）' unless
  page.include?('悟空云界交互空间实验室 · 数学宇宙')
issues << '首页星云的画布丢了（应 <canvas data-home-stars>）' unless
  page =~ /<canvas[^>]*data-home-stars/
issues << '星云画布没有 aria-hidden（它是装饰，不该被读屏念出来）' unless
  page =~ /<canvas[^>]*data-home-stars[^>]*aria-hidden="true"/
issues << '首页没有引星云引擎（assets/js/home-stars.js）' unless
  page.include?('<script src="assets/js/home-stars.js"></script>')
# 画布要在内容容器**之前**（后画的压在上面，顺序反了字会被盖住）
iCv = page.index('data-home-stars')
iIn = page.index('class="home-hero__inner"')
issues << '星云画布没排在 .home-hero__inner 之前（内容会被盖在下面）' unless
  iCv && iIn && iCv < iIn
issues << '星云画布没写 pointer-events:none（它会挡住标题那颗按钮）' unless
  page[/\.home-hero__stars\{[\s\S]{0,420}?\}/].to_s.include?('pointer-events: none;')
issues << '.home-hero 没设黑底（应 background: var(--math-hero-bg)）' unless
  page[/\.home-hero\{[\s\S]{0,320}?\}/].to_s.include?('background: var(--math-hero-bg);')
issues << '.home-hero 没写 min-height:100vh（只剩一块内容，得铺满一屏）' unless
  page[/\.home-hero\{[\s\S]{0,320}?\}/].to_s.include?('min-height: 100vh;')

# ---------- 2. 那三段话：默认收着，点标题才出 ----------
# 标题就是开关 —— 必须是**真按钮**（键盘、读屏、aria-expanded 都靠它）
issues << '标题不是一颗按钮（点它要能显出三段话，键盘也得能用）' unless
  page =~ /<button[^>]*data-hero-title/ && page =~ /aria-expanded="false"/ &&
  page =~ /aria-controls="hero-manifesto"/
# 两行字**都得能点**（用户 2026-10-02："除了点那个 WUKONG MATH UNIVERSAL，下面那个汉语也可以点击"）
issues << '中文副题不能点（英文标题与副题应各是一颗 data-hero-title 按钮）' unless
  page.scan(/<button[^>]*data-hero-title/).size >= 2
issues << '三段话没挂 id="hero-manifesto"（按钮的 aria-controls 要指到它）' unless
  page =~ /class="home-hero__manifesto" id="hero-manifesto"/
# 默认收着：第二行那格是 0fr，点开才 1fr（带高度动画，不是啪一下撑开）
issues << '三段话没有默认收着（应 .home-hero__inner{ grid-template-rows: auto 0fr; }）' unless
  page[/\.home-hero__inner\{[\s\S]{0,520}?\}/].to_s.include?('grid-template-rows: auto 0fr;')
issues << '三段话展开的那条规则丢了（应 .home-hero[data-manifesto="on"] .home-hero__inner）' unless
  page.include?('.home-hero[data-manifesto="on"] .home-hero__inner{')
issues << '点标题那段脚本丢了（该翻 data-manifesto 与 aria-expanded）' unless
  page.include?("hero.setAttribute('data-manifesto', 'on')") &&
  page.include?("toggles[j].setAttribute('aria-expanded', on ? 'true' : 'false')")
# 收着的时候不许还占着那 48px 的行距
issues << '收着时还留着那 48px 行距（应 row-gap 跟着一起动）' unless
  page[/\.home-hero__inner\{[\s\S]{0,520}?\}/].to_s.include?('row-gap: 0;')
issues << '三段话默认不是透明的（应 opacity: 0，展开才 1）' unless
  page[/\.home-hero__manifesto\{[\s\S]{0,420}?\}/].to_s.include?('opacity: 0;') &&
  page.include?('.home-hero[data-manifesto="on"] .home-hero__manifesto{')

# ---------- 3. 那三段话是他给的原文，一个字不许改 ----------
# 三段：开头几个字 + 结尾几个字各钉一次（中间的改动由下面的段数/标签检查兜住）
{
  '第一段' => '数学是一种知识体系，也是一种认识世界的方式。',
  '第二段' => 'WUKONG MATH 的核心判断是：',
  '第三段' => 'WUKONG MATH 将全人类数学知识组织成一个'
}.each do |label, head|
  issues << "宣言#{label}的开头被改了（应「#{head}」）" unless page.include?(head)
end
issues << '宣言第一段的结尾被改了（应「……更不是学习数学的唯一目的。」）' unless
  page.include?('更不是学习数学的唯一目的。</p>')
issues << '宣言第二段的结尾被改了（应「……连续、透明、个性化和可持续。」）' unless
  page.include?('连续、透明、个性化和可持续。</p>')
issues << '宣言第三段的结尾被改了（应「……找到自己的入口和长期路径。」）' unless
  page.include?('找到自己的入口和长期路径。</p>')
issues << '宣言的段数不对（应是三段：数学观 / 核心判断 / 数字宇宙）' unless
  page.scan(/<p>[^<]*<\/p>/).size == 3
issues << '宣言里塞进了标签（应是一段纯文字，不许加 <strong>/<a> 之类改字）' if
  page[/<div class="home-hero__manifesto"[\s\S]*?<\/div>/].to_s =~ /<(strong|em|a|b|i|span)\b/

# ---------- 4. 那三段话的排版：左对齐 + 每段空两格 ----------
issues << '宣言没有左对齐（应 .home-hero__manifesto{ text-align: left; }）' unless
  page[/\.home-hero__manifesto\{[\s\S]{0,420}?\}/].to_s.include?('text-align: left;')
issues << '宣言每段开头没空两格（应 .home-hero__manifesto p{ text-indent: 2em; }）' unless
  page[/\.home-hero__manifesto p\{[\s\S]{0,120}?\}/].to_s.include?('text-indent: 2em;')
issues << '标题与宣言没有横向居中（应 .home-hero__inner{ justify-items: center; }）' unless
  page[/\.home-hero__inner\{[\s\S]{0,520}?\}/].to_s.include?('justify-items: center;')
issues << '整页没居中（应 .home-hero{ place-items: center; }）' unless
  page[/\.home-hero\{[\s\S]{0,320}?\}/].to_s.include?('place-items: center;')
issues << '首页标题没使浅色（应 var(--math-hero-ink)）' unless
  page[/\.home-hero__title\{[\s\S]{0,420}?\}/].to_s.include?('color: var(--math-hero-ink);')
issues << '宣言正文没使浅色（应 var(--math-hero-body)）' unless
  page[/\.home-hero__manifesto\{[\s\S]{0,420}?\}/].to_s.include?('color: var(--math-hero-body);')
# 全站纪律：页面的 <style> 里不写十六进制色（改配色只该改 tokens.css）
issues << '首页样式里出现了十六进制色字面量（配色只该走令牌）' if
  page =~ /#[0-9a-fA-F]{3,8}\b/

# 两行等宽：中文那行得按实测比例缩到跟英文标题一样长
# ⚠️ 这数**跟字体、跟标题那行字面量一起绑死**：2026-10-02 从 Inter 换成阿里巴巴普惠体时
#    它从 0.879 变成 0.863（"Universal → UNIVERSAL" 那次是 0.807 → 0.879）——
#    以后再动字体、或动标题那行字，**都要重新量一遍**。
issues << '副题没按宽度配到跟英文标题一样长（应 calc(0.863 * var(--math-text-h2))）' unless
  page.include?('font-size: calc(0.863 * var(--math-text-h2));')

# ---------- 4. 星云引擎：干净 / 慢 / 会成形（这一版的三条硬要求） ----------
issues << '星云引擎没有对外那个口子（应 WK_HOME_STARS.mount）' unless
  stars.include?('window.WK_HOME_STARS = {')
# ① 干净：一个点只能是一记 arc + fill —— 不许外发光、不许相加混合、不许径向光晕
# （判据都盯着**真的调用/赋值**，不盯注释里的字 —— 文件头上就写着"不许用 shadowBlur"这些，
#   那是讲给人听的）
issues << '星云的点带上光晕了（用户要的是"干净的点、不是带光晕的点"）：不许用 lighter 相加' if
  stars =~ /globalCompositeOperation\s*=\s*['"]lighter['"]/
issues << '星云的点带上光晕了：不许画径向光晕（createRadialGradient）' if
  stars.include?('createRadialGradient(')
issues << '星云的点带上光晕了：不许用 shadowBlur 拖影子' if
  stars =~ /\.?shadowBlur\s*=/
issues << '星云的点带上光晕了：不许用 shadowColor 拖影子' if
  stars =~ /\.?shadowColor\s*=/
# ② 只有点：那一版 24 颗飘着的公式星尘不许回来
issues << '星云里混进了公式星尘（用户："就是单纯的点"）' if
  stars =~ /E = mc|∫|Ω|欧拉|高斯|黎曼/
# ③ 慢：角速度基准要小到"一圈几分钟"那一档
issues << '星云转得太快（"慢慢在旋转"：SPIN 要小到 0.0005 以下）' unless
  stars =~ /var SPIN = 0\.000[0-4]/
# ④ 会长：起始位置 + 逐颗错开的形成进度
issues << '星云不是"从散点慢慢长出来"的（缺起始位置）' unless
  stars.include?('ax: sr * Math.cos(st)')
issues << '星云不是"从散点慢慢长出来"的（缺逐颗错开的形成进度）' unless
  stars.include?('var prog = reduceMotion ? 1 : clamp01((elapsed - p.delay) / FORM_MS);') &&
  stars.include?('delay: Math.random() * FORM_SPREAD')
# ⑤ 像银河系（用户 2026-10-02 看过第一版后："这四条臂也没有弧度，这就不像个银河系……
#    弄得像银河系一点"）—— 三条都盯着"臂形"，因为病根就是臂形：
#    · 缠绕度：K 太小 → 四条臂在屏幕上摊成四道直抹（上一版 0.95 就是这个毛病）
#    · 自转：差速转（内快外慢）→ 里圈几十秒就撵上外圈、旋臂绞成一团 → 星系散架
#    · 撒点：不按半径匀 → 外圈弧长是内圈的好几倍，点数却没多，稀成一串珠子
issues << '四条旋臂又没弧度了（对数螺旋的缠绕度 ARM_K 应 ≥ 2）' unless
  stars =~ /var ARM_K = [2-9]\./
issues << '自转又回到"内快外慢"了（差速转会把旋臂绞散，一会儿就不像星系）' if
  stars =~ /speed:\s*SPIN\s*\/\s*\(/
issues << '旋臂没按半径匀着撒（外圈会稀成一串珠子）：应走 var t = Math.sqrt(Math.random());' unless
  stars.include?('var t = Math.sqrt(Math.random());')
# · 银河系是"棒旋"：核球外面还得有一根短棒，少了它中间就只是一个圆球
issues << '核棒没了（银河系是"棒旋"，核球要再拉长成一根短棒）' unless
  stars.include?('var br = bu * BAR_LEN;')
# ⑥ 能动：在空白处按住拖，可以上下左右转（事件挂在外层 section 上，画布是 pointer-events:none）
issues << '拖不动视角（缺 container 上那一手 pointerdown）' unless
  stars.include?("container.addEventListener('pointerdown', onDown)")
issues << '拖动时没给抓手（应 .home-hero[data-stars-drag="on"]{ cursor: grabbing }）' unless
  page.include?('.home-hero[data-stars-drag="on"]') &&
  page.include?('cursor: grabbing')
# · 整块 hero 都能拖：三段话显出来之后一样能转（用户："有文字出来的时候，它也是可以跟着鼠标互动"）
issues << '拖动被正文挡掉了（不许再把 .home-hero__manifesto 从拖动里摘出去）' if
  stars =~ /closest\('a, \.home-hero__manifesto'\)/
# · 拖动期间不许选中文字（用户："拖动的时候不要把这个文字选中"）
issues << '拖动时还能选中文字（应在拖动期间把 user-select 关掉，含 -webkit- 前缀）' unless
  page[/\.home-hero\[data-stars-drag="on"\] \*\{[\s\S]{0,140}?\}/].to_s.include?('user-select: none') &&
  page.include?('-webkit-user-select: none')
# · 只有真的按住拖才动 —— hover 一根手指都不许动镜头（用户："不是鼠标 hover……还是得拖动的时候才可以动"）
issues << 'hover 就把画面动了（用户要的是"只有拖动时才动"）' if
  stars =~ /addEventListener\('(mouseenter|mouseover|mousemove)'/
# 该停就停 / 尊重减弱动效
issues << '没有 prefers-reduced-motion 这一档（那一档应只画一帧成形的）' unless
  stars.include?("matchMedia('(prefers-reduced-motion: reduce)').matches")
issues << '没有 IntersectionObserver 暂停（滚出画面还在烧 CPU）' unless
  stars.include?('new IntersectionObserver(')
issues << '切走标签页没停（应听 visibilitychange）' unless
  stars.include?("document.addEventListener('visibilitychange'")
issues << 'DPR 没夹住（应 Math.min(window.devicePixelRatio || 1, 2)）' unless
  stars.include?('Math.min(window.devicePixelRatio || 1, 2)')
issues << '画布尺寸没量容器（应 container.getBoundingClientRect()）' unless
  stars.include?('container.getBoundingClientRect()')

# ---------- 5. 更早那两版的残留：一律不许长回来 ----------
issues << '那面"目录墙"又长回来了（.quick-list / .section-index / .section-cta）' if
  page.include?('class="quick-list"') || page.include?('class="section-index"') ||
  page.include?('class="section-cta"')
issues << '那两个大按钮又挂回来了' if page.include?('class="btn btn--primary"')
issues << '上一版那根数轴 / 公式块又挂回来了' if
  page.include?('class="axis-svg"') || page.include?('class="formula-block"')
# 上一版的引擎（从 Universal.html 搬来的那份）已经整份删掉，别再放回来
issues << '上一版的粒子引擎（assets/js/home-galaxy.js）又被放回来了' if
  File.exist?(File.join(ROOT, 'assets/js/home-galaxy.js'))

# ---------- 6. 令牌：三包都要有；那份原稿还留着 ----------
%w[--math-hero-bg --math-hero-ink --math-hero-body].each do |tk|
  n = tokens.scan("#{tk}:").size
  issues << "#{tk} 没有在 tokens.css 的亮 / 中 / 暗三包里各写一份（现在 #{n} 处）" unless n >= 3
end
issues << 'Universal.html（用户那份粒子沙盒原稿）不见了 —— 想回头再做粒子的源头，别删' unless
  sandbox.include?('NUM_ARMS') && sandbox.include?('FORMULAS')
%w[verify_rail.rb verify_brand.rb verify_fullscreen.rb verify_display.rb].each do |f|
  src = File.read(File.join(ROOT, 'tools/checks', f), encoding: 'UTF-8')
  issues << "#{f} 没把 Universal.html 登记成独立页面（体检会把它当站点页报红灯）" unless
    src.include?('Universal.html')
end

puts '首页体检：干净的点/慢/会成形（星云三条）/ 像银河系（臂有弧度 · 核棒 · 刚体自转 · 撒得匀）/ 两行字都能点 / 整体可拖（拖动不选字、hover 不动）/ 三段话点标题才出 / 原文逐段比对 / 令牌与黑底 / 老版本残留'
puts issues.empty? ? '首页体检全部通过 ✓' : issues.map { |i| "  ✗ #{i}" }.join("\n")
exit(issues.empty? ? 0 : 1)

