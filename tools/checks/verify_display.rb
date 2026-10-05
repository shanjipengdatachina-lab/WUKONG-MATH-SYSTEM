# encoding: UTF-8
# 阅读与显示设置体检：三包配色齐不齐、字号是不是真的全站可缩放、对比度够不够、开关接没接上
#
# 为什么要有这份体检：
#   · "深色下某个东西还是白的"这种毛病，肉眼要翻完整站才可能发现，而且换个人就漏 —— 逐令牌比对才守得住。
#   · 724 处字号是脚本改的，脚本改完必须能证明"没有漏乘"，不能靠抽查。
#   · "文字太浅看不清"是用户最早提的问题，所以把对比度算出来钉在这里，退回去就报错。
ROOT = (ENV['WKMATH_ROOT'] || File.expand_path('../..', __dir__)).dup.force_encoding('UTF-8')

def read(rel)
  File.read(File.join(ROOT, rel), encoding: 'UTF-8')
end

tokens = read('assets/css/tokens.css')
base   = read('assets/css/base.css')
disp   = read('assets/js/display.js')
wb     = read('assets/js/whiteboard.js')
pages  = Dir[File.join(ROOT, '*.html')].sort
# 独立页面（不挂外壳、不接全站的字号 / 配色启动器）：白板功能规划（规划文档）+
# Universal.html（用户那份粒子沙盒页，首页 hero 星空的原稿）。它自己一套字体与底色，
# 本来就不该被"全站字号可缩放"这条管 —— 下面的页面级循环一律跳过它。
# （verify_rail / verify_brand / verify_fullscreen 里也有各自的同名名单，四处要一起加。）
STANDALONE = %w[白板功能规划.html Universal.html].freeze
pages = pages.reject { |p| STANDALONE.include?(File.basename(p)) }

issues = []

# ---------- 1. 每个页面都要在首屏前挂上启动器 ----------
missing = pages.reject { |p| read(File.basename(p)).include?('assets/js/display.js') }
issues << "有 #{missing.size} 个页面没挂 display.js：#{missing.map { |p| File.basename(p) }.join('、')}" unless missing.empty?
early = pages.reject do |p|
  html = read(File.basename(p))
  i_disp = html.index('assets/js/display.js')
  i_css  = html.index('assets/css/tokens.css')
  i_disp && i_css && i_disp < i_css
end
issues << "有 #{early.size} 个页面把 display.js 放在了样式表之后（首屏会先白后暗）" unless early.empty?
issues << '启动器没在 tokens.css 之前解析（会闪）' if pages.empty?

# ---------- 2. 字号：全站可缩放，且只乘一次 ----------
naked = 0
double = 0
pages.each do |p|
  html = read(File.basename(p))
  naked += html.scan(/font-size:\s*\d*\.?\d+(px|rem)/).size
  naked += html.scan(/font-size:\s*clamp\(/).size
  double += html.scan(/font-size:calc\(var\(--math-text/).size
end
issues << "还有 #{naked} 处 font-size 没乘 --math-fs（选了字号也不会变）" if naked.positive?
issues << "有 #{double} 处双重放大（引用处又乘了一次）" if double.positive?
%w[--math-fs --math-weight-body].each do |t|
  issues << "tokens.css 里缺 #{t}" unless tokens.include?("#{t}:")
end
issues << '两档字号乘数没定义（lg / xl）' unless
  tokens.include?('html[data-wk-fs="lg"]') && tokens.include?('html[data-wk-fs="xl"]')
issues << '正文字重没走令牌（base.css 的 body 没用 --math-weight-body）' unless
  base.include?('font-weight: var(--math-weight-body')

# ---------- 2b. 字体：全站只有一个（本地的阿里巴巴普惠体，不引 CDN） ----------
# 用户 2026-10-02："把字体换成阿里普惠体"。四件事一起钉，少一件都会"看着像换了其实没换"：
#   ① 四个字重各一段 @font-face（全站的字重分布就是 400/500/600/700 这四个）；
#   ② src 一律指**本地**文件 —— 全站"不引 CDN、断网也能开"是同一条口径；
#   ③ 那四个子集文件真的在仓库里，而且**是子集**（~250KB，不是 5MB 整包）——
#      引一个不存在的文件，浏览器会静默回退到系统字体，跟没换一模一样；
#   ④ 四个字体令牌都以普惠体打头，字重映射是 400/500/600/700 ← 55/65/75/85
#      （600 用得最多，映射错了最扎眼）。
FONT_FACES = {
  '400' => 'puhuiti-3-55-regular.woff2',
  '500' => 'puhuiti-3-65-medium.woff2',
  '600' => 'puhuiti-3-75-semibold.woff2',
  '700' => 'puhuiti-3-85-bold.woff2'
}.freeze
faceBlocks = tokens.scan(/@font-face\s*\{[^}]*\}/)
issues << 'tokens.css 里 @font-face 不是四段（四个字重各一段）' unless
  faceBlocks.size == 4
FONT_FACES.each do |w, file|
  issues << "缺 #{w} 那段 @font-face（应写 font-weight:#{w} 并指向 #{file}）" unless
    tokens.include?("font-weight:#{w}") && tokens.include?(file)
  path = File.join(ROOT, 'assets', 'fonts', file)
  issues << "字体文件 assets/fonts/#{file} 不在仓库里（会静默回退到系统字体）" unless File.exist?(path)
  issues << "字体文件 #{file} 太大了（子集化没生效？应 ~250KB、上限 600KB）" if
    File.exist?(path) && File.size(path) > 600 * 1024
end
issues << '字体引了外部地址（全站不引 CDN，字体也得是本地文件）' if
  faceBlocks.any? { |b| b.include?('http') }
%w[sans display mono math].each do |k|
  val = tokens[/--math-font-#{k}\s*:\s*([^;]+);/, 1].to_s
  issues << "--math-font-#{k} 没以阿里巴巴普惠体打头（又换回系统字体了）" unless
    val.include?('"Alibaba PuHuiTi 3"')
  issues << "--math-font-#{k} 里还留着换之前的字体名" if
    val =~ /Inter|JetBrains Mono|Source Han Serif|HarmonyOS Sans/
end
issues << '四个字体令牌没写全（sans / display / mono / math）' unless
  %w[sans display mono math].all? { |k| tokens.include?("--math-font-#{k}:") }

# ---------- 3. 三包配色：逐个颜色令牌比对 ----------
def block_of(css, selector)
  m = css.match(/#{Regexp.escape(selector)}\s*\{(.*?)\n\}/m)
  m ? m[1] : ''
end

def tokens_in(block)
  out = {}
  block.scan(/(--math-[a-z0-9-]+)\s*:\s*([^;]+);/).each { |k, v| out[k] = v.strip }
  out
end

root_tokens = tokens_in(block_of(tokens, ':root'))
# 只比"颜色"令牌：尺寸、圆角、字体栈、间距与主题无关，不该被要求重定义
# 另外：**引用了别的令牌的值不算"写死的颜色"** —— 它跟着被引用的那个走。
# 例如 `--math-primary-soft: color-mix(… var(--math-primary) …, var(--math-background))`：
# 换高亮色换主色、换配色换底色，它自己就跟着变了，不必每个配色再重定义一遍
# （要求它重定义，反而会把混色规则用写死值盖掉）。见 tokens.css「高亮色」一节。
def color_token?(value)
  return false if value.include?('var(--math-')
  value =~ /\A#[0-9a-fA-F]{3,8}\z/ || value =~ /\Argba?\(/ || value =~ /color-mix/ ? true : false
end
color_names = root_tokens.select { |_k, v| color_token?(v) }.keys.sort
issues << '在 tokens.css 里没找到颜色令牌（解析失败）' if color_names.empty?

# 掌握度那七档**豁免**这条规则（用户 2026-09-30，撤掉深色底板之后的版本）：
# 六个彩色档同时压在纯白与纯黑上都 ≥ 3:1，所以三个主题共用同一份值 ——
# 它们不跟主题走，不该被要求在中色 / 暗色包里再写一遍（写了反而是走回头路）。
# 同一天稍后又加了**难度五档的色阶**（--math-lv-1…5，绿→蓝→黄→橙→红，给"难度层"那五个
# 水平面与考点点用）：五色都是从上面那七档里挑的，一样压白压黑都达标，也一样**不跟主题、
# 不跟配色包走** —— 它是一把尺子，换配色包时"难度 4 是橙的"这件事不该变。
THEME_FREE = %w[--math-bar-ok --math-bar-gold --math-bar-first --math-bar-learn
                --math-bar-review --math-bar-weak
                --math-lv-1 --math-lv-2 --math-lv-3 --math-lv-4 --math-lv-5].freeze

{ 'mid' => '中色', 'dark' => '暗色' }.each do |theme, cn|
  block = block_of(tokens, %(html[data-wk-theme="#{theme}"]))
  issues << "tokens.css 里没有 #{cn} 那一包（html[data-wk-theme=\"#{theme}\"]）" if block.empty?
  have = tokens_in(block)
  THEME_FREE.each do |k|
    issues << "#{cn}里重写了 #{k} —— 这一档压白压黑都达标，三包共用一份值（见 tokens.css 的说明）" if
      have.key?(k)
  end
  miss = color_names.reject { |k| have.key?(k) || THEME_FREE.include?(k) }
  issues << "#{cn}缺 #{miss.size} 个颜色令牌：#{miss.join('、')}（深色下会留着亮色，可能白底白字）" unless miss.empty?
  extra = have.keys.reject { |k| root_tokens.key?(k) }
  issues << "#{cn}里出现了 :root 没有的令牌：#{extra.join('、')}（大概是写错了名字）" unless extra.empty?
end

# ---------- 4. 对比度：用户提的"看不清"要有可核对的线 ----------
def rgb_of(hex)
  return nil unless hex =~ /\A#([0-9a-fA-F]{6})\z/
  m = Regexp.last_match(1)
  [m[0, 2].to_i(16), m[2, 2].to_i(16), m[4, 2].to_i(16)]
end

def lum(hex)
  c = rgb_of(hex)
  return nil if c.nil?
  parts = c.map do |v|
    x = v / 255.0
    x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055)**2.4
  end
  parts[0] * 0.2126 + parts[1] * 0.7152 + parts[2] * 0.0722
end

def contrast(a, b)
  la = lum(a)
  lb = lum(b)
  return nil if la.nil? || lb.nil?
  hi, lo = [la, lb].max, [la, lb].min
  (hi + 0.05) / (lo + 0.05)
end

# 亮色就是 :root；中/暗各取自己那一包，缺的键回落到 :root（回落也要算出来，才能暴露"没覆盖"）
PALETTES = { '亮色' => root_tokens.merge({}) }
{ '中色' => 'mid', '暗色' => 'dark' }.each do |cn, theme|
  PALETTES[cn] = root_tokens.merge(tokens_in(block_of(tokens, %(html[data-wk-theme="#{theme}"]))))
end

# 正文/次级正文/说明文字的下限；ink-4 是"最次要信息 + 占位符"，给 3:1
LIMITS = {
  '--math-foreground' => 4.5,
  '--math-ink-2'      => 4.5,
  '--math-ink-3'      => 4.5,
  '--math-ink-4'      => 3.0,
  '--math-primary'    => 3.0
}
PALETTES.each do |cn, pal|
  bg = pal['--math-background']
  LIMITS.each do |tok, min|
    fg = pal[tok]
    r = contrast(fg, bg)
    next if r.nil? # 非十六进制（如 rgba 的半透明色）不参与计算
    issues << format('%s：%s(%s) 压在背景(%s)上只有 %.2f:1，低于 %.1f:1',
                     cn, tok, fg, bg, r, min) if r < min
  end
  # 主色底上的字：按钮那种"亮蓝底压深字 / 深蓝底压白字"
  r = contrast(pal['--math-primary-foreground'], pal['--math-primary'])
  issues << format('%s：主色底上的字(%s on %s)只有 %.2f:1，低于 4.5:1',
                   cn, pal['--math-primary-foreground'], pal['--math-primary'], r) if r && r < 4.5
end

# ---------- 5. 启动器本身：键名、默认值、坏值回落 ----------
%w[wkmath.display.theme wkmath.display.fs].each do |k|
  issues << "display.js 里没有 #{k}" unless disp.include?(k)
end
issues << 'display.js 没有"认不出来的值回落默认"' unless disp.include?("allowed.indexOf(v) >= 0 ? v : dflt")
issues << 'display.js 没有用 THEME_ATTR 写配色（或名字空间写错了）' unless disp.include?("THEME_ATTR = 'data-wk-theme'")
issues << 'display.js 没有用 FS_ATTR 写字号属性' unless disp.include?("FS_ATTR = 'data-wk-fs'")
# 通用的 data-theme 会被环境/扩展抢走（踩过：选了暗色却还是亮色，内存与存储却都是暗的）。
# 我们的读写必须待在自己的名字空间里。
issues << 'display.js 又用回通用的 data-theme 了（会被运行环境抢走）' if disp.include?("setAttribute('data-theme'")
issues << 'display.js 没有广播 wk:display（白板要靠它换板面）' unless disp.include?("'wk:display'")
issues << 'display.js 没有对外接口 window.WK_DISPLAY' unless disp.include?('window.WK_DISPLAY =')

# ---------- 6. 设置页那两行 ----------
set = read('settings.html')
%w[set-fs set-theme].each do |id|
  issues << "设置页缺 ##{id}" unless set.include?("id=\"#{id}\"")
end
%w[std lg xl].each do |v|
  issues << "设置页字号缺「#{v}」这一档" unless set.include?("data-wk-fs=\"#{v}\"")
end
%w[light mid dark].each do |v|
  issues << "设置页配色缺「#{v}」这一档" unless set.include?("data-wk-theme=\"#{v}\"")
end
issues << '设置页的字号/配色按钮没有 aria-pressed（读屏看不出当前是哪档）' unless
  set.scan(/data-wk-fs="\w+" aria-pressed=/).size == 3
issues << '设置页缺「阅读与显示」这一节' unless set.include?('阅读与显示')
issues << '配色按钮缺预览色块（用户看不到那一档长什么样）' unless
  set.scan(/disp-dot disp-dot--(light|mid|dark)"/).size == 3
issues << "高亮色按钮缺色块（应有 7 个，实际 #{set.scan(/disp-dot disp-dot--(green|blue|violet|amber|cyan|rose|red)"/).size} 个）" unless
  set.scan(/disp-dot disp-dot--(green|blue|violet|amber|cyan|rose|red)"/).size == 7

# ---------- 6b. 高亮色：默认 Trae 绿，另外五色可选，每色 × 每配色都要过对比度 ----------
# 用户原话："我的按钮的颜色是淡蓝色带一点紫色，我希望默认是 trae 的绿色；
#           后台设置可以选择高亮颜色；给几个配色。"
ACCENTS = %w[green blue violet amber cyan rose red].freeze
issues << "默认主色不是松绿（应 #0e7a4f，实际 #{root_tokens['--math-primary']}）" unless
  root_tokens['--math-primary'].to_s.downcase == '#0e7a4f'
# Trae 品牌绿本色 #32F08C 只压得住**深底**（压纯黑 14:1，压白只有 1.5:1），
# 所以它出现在暗色那一包里 —— 这不是漏了，是它唯一站得住的地方。
issues << '暗色里没用 Trae 品牌绿本色 #32f08c（默认那套得真的是 Trae 绿）' unless
  tokens_in(block_of(tokens, 'html[data-wk-theme="dark"]'))['--math-primary'].to_s.downcase == '#32f08c'
%w[green blue violet amber cyan rose red].each do |a|
  issues << "tokens.css 里缺高亮色「#{a}」" unless
    a == 'green' || tokens.include?(%(html[data-wk-accent="#{a}"]))
  # 每个色都要有**暗底那一套**：只有一个亮底值的话，暗色下会拿深色主色去压黑底，
  # 对比度看着还够（4:1 左右），但"看着够"不等于"这就是设计好的那一档"。
  issues << "高亮色「#{a}」缺暗底那一套（暗色下会退回深色主色）" unless
    a == 'green' || tokens.include?(%(html[data-wk-theme="dark"][data-wk-accent="#{a}"]))
end

# 逐个高亮色 × 逐个配色算对比度。**每个色都要算三遍**（亮 / 中 / 暗）——
# 暗底那套的主色与亮底那套完全是两回事，只算一遍等于没算。
ACCENT_PALETTES = {}
ACCENTS.each do |a|
  next if a == 'green' # 默认那套就在 :root / 中色 / 暗色三个块里，上面已经算过
  accent_light = tokens_in(block_of(tokens, %(html[data-wk-accent="#{a}"])))
  accent_dark  = tokens_in(block_of(tokens, %(html[data-wk-theme="dark"][data-wk-accent="#{a}"])))
  ACCENT_PALETTES["#{a} · 亮"] = root_tokens.merge(accent_light)
  ACCENT_PALETTES["#{a} · 中"] = root_tokens.merge(tokens_in(block_of(tokens, 'html[data-wk-theme="mid"]'))).merge(accent_light)
  ACCENT_PALETTES["#{a} · 暗"] = root_tokens.merge(tokens_in(block_of(tokens, 'html[data-wk-theme="dark"]'))).merge(accent_dark)
end
ACCENT_PALETTES.each do |cn, pal|
  r = contrast(pal['--math-primary'], pal['--math-background'])
  issues << format('%s：主色(%s)压在底(%s)上只有 %.2f:1，低于 3.0:1',
                   cn, pal['--math-primary'], pal['--math-background'], r) if r && r < 3.0
  r2 = contrast(pal['--math-primary-foreground'], pal['--math-primary'])
  issues << format('%s：主色底上的字(%s on %s)只有 %.2f:1，低于 4.5:1',
                   cn, pal['--math-primary-foreground'], pal['--math-primary'], r2) if r2 && r2 < 4.5
end

# 设置页那一行 + 启动器
issues << '设置页缺「高亮色」那一行（#set-accent）' unless set.include?('id="set-accent"')
ACCENTS.each do |a|
  issues << "设置页缺高亮色选项「#{a}」" unless set.include?(%(data-wk-accent="#{a}"))
end
issues << "设置页的高亮色按钮没有 aria-pressed（读屏看不出当前是哪个色，实际 #{set.scan(/data-wk-accent="\w+" aria-pressed=/).size} 个）" unless
  set.scan(/data-wk-accent="\w+" aria-pressed=/).size == ACCENTS.size
%w[ACCENT_KEY ACCENT_ATTR ACCENTS ACCENT_DEFAULT].each do |needle|
  issues << "display.js 缺 #{needle}（高亮色没接上）" unless disp.include?(needle)
end
issues << 'display.js 的高亮色没用自己的名字空间属性' unless disp.include?("ACCENT_ATTR = 'data-wk-accent'")
# 默认那一档不写属性（与字号"标准档"同一套规矩）：这样"从没设过"与"设成松绿"在 DOM 上一样
issues << '默认高亮色会往 <html> 上写属性（"没设过"与"设成默认"就区分不开了）' unless
  disp.include?('if (state.accent === ACCENT_DEFAULT) el.removeAttribute(ACCENT_ATTR)')
# 三组按钮共用同一套"按下"样式：漏掉一组，那一组点了看不出选中（按钮自己知道，眼睛不知道）。
# 选择器后面必须是 `,` 或 `{` —— `:hover` 那条也以同样的选择器开头，
# 只匹配前缀的话把主规则删掉这条守护照样是绿的（第一版两次都栽在这：先被 `:hover` 骗过，
# 改成连 `{` 又漏了"三条挤在一行、后面跟逗号"的前两组）。
# 四组按钮共用同一套"按下"样式（2026-09-30 加了第四组「掌握度色彩」）。
%w[fs theme accent scheme].each do |g|
  rule = /#set-#{g} \.seg__item\[aria-pressed="true"\][,{]/
  issues << "设置页「#{g}」那一组没有按下样式（选中了也看不出来）" unless set =~ rule
end

# ---------- 6c. 掌握度色彩方案（用户 2026-09-30）----------
# 用户原话："底部设置，你可以多搞几个色彩方案……默认有 6 个色彩方案。点击色彩方案，
#           相当于改了筛选里面那个掌握对应的色彩方案。"
# 它改的是轴上彩条那七个 --math-bar-*；默认那套（松绿）的全站值住在 :root，不写属性。
#
# 2026-09-30 又补了两句，这两句各对应下面一段守线：
#   · "预设方案一定要色相区分非常明显；要不然分不清问题的状态" —— 第一版把一套里的七个色
#     做成了"同一色相的明暗梯度"（靛蓝那套全蓝、紫罗兰那套全紫），七档状态压根分不出来。
#     所以这里逐套逐档量**色相差**（相邻两档要 ≥ 30°）。
#   · "点击其他的色彩方案，第一个方案就变" —— 设置页第一颗预览按钮自带
#     `data-wk-scheme="green"`，而 tokens.css 里当时没有一条规则命中它，
#     于是它一路继承 <html> 上**当前选中的方案**。下面钉住"默认那套也必须有自己的一条"。
#   · 同日最末一轮：用户看完"亮纯色 + 深色底板"那版说"改颜色之后就成黑色背景了，改回去啊"，
#     底板撤掉 —— 于是对比度又回到"同时压在**纯白**（亮色主题）与**纯黑**（暗色主题）上 ≥ 3:1"。
SCHEMES = %w[green blue violet amber cyan a11y].freeze
BAR_TOKENS = %w[--math-bar-ok --math-bar-gold --math-bar-first --math-bar-learn
                --math-bar-review --math-bar-weak --math-bar-idle].freeze
COLOR_BARS = (BAR_TOKENS - ['--math-bar-idle']).freeze   # 未开始那档是灰，不参与色相检查

# 色相 0–360；灰（R=G=B）没有色相，返回 nil
def hue_of(hex)
  c = rgb_of(hex)
  return nil if c.nil?
  r, g, b = c.map { |v| v / 255.0 }
  return nil if (r - g).abs < 0.02 && (g - b).abs < 0.02
  mx = [r, g, b].max
  mn = [r, g, b].min
  d = mx - mn
  h = if mx == r then ((g - b) / d) % 6
      elsif mx == g then ((b - r) / d) + 2
      else ((r - g) / d) + 4
      end
  ((h * 60).round % 360)
end

# 把 `var(--x)` 追到字面量（默认那套的 ok / gold / weak / idle 都是引用，链长 ≤ 2）
def resolve_tok(value, root)
  seen = 0
  while value.to_s =~ /var\(\s*(--[a-z0-9-]+)\s*\)/ && seen < 8
    value = root[Regexp.last_match(1)]
    seen += 1
  end
  value.to_s.strip
end

issues << '设置页缺「掌握度色彩」那一行（#set-scheme）' unless set.include?('id="set-scheme"')
SCHEMES.each do |s|
  issues << "设置页缺色彩方案「#{s}」" unless set.include?(%(data-wk-scheme="#{s}"))
end
issues << "色彩方案按钮没有 aria-pressed（读屏看不出当前是哪套，实际 #{set.scan(/data-wk-scheme="\w+" aria-pressed=/).size} 个）" unless
  set.scan(/data-wk-scheme="\w+" aria-pressed=/).size == SCHEMES.size

# ---------- 6e. 面板透明度（用户 2026-10-01）----------
# "无论是白板还是数轴，都可以在设置里调整透明度……默认设为 90%。"
# 三件事一起盯：① 设置页有这颗滑块；② display.js 把它落成 `--math-panel-a`；
# ③ 三包配色各自有 `--math-panel` / `--math-panel-bg`，且浮窗真的改用它（不是还写 popover）。
issues << '设置页缺「面板透明度」那颗滑块（#set-panel-range）' unless
  set.include?('id="set-panel-range"') && set.include?('id="set-panel-out"')
issues << '面板透明度滑块没给默认值 90 / 范围 40–100' unless
  set =~ /id="set-panel-range"[^>]*min="40"[^>]*max="100"[^>]*value="90"/
issues << 'display.js 没有把面板透明度落成 --math-panel-a（tokens.css 拼不出半透明的底）' unless
  disp.include?("setProperty('--math-panel-a'") && disp.include?('PANEL_DEFAULT = 90')
issues << '面板透明度没有跟着广播/落盘（改完别的页面不知道）' unless
  disp.include?("keys: { theme: THEME_KEY, fs: FS_KEY, accent: ACCENT_KEY, scheme: SCHEME_KEY, panel: PANEL_KEY }") &&
  disp.include?('window.localStorage.setItem(PANEL_KEY, String(next.panel));')
issues << ':root 没有 --math-panel-a 的默认值与两个面板底色令牌' unless
  block_of(tokens, ':root').include?('--math-panel-a: .9;') &&
  block_of(tokens, ':root').include?('--math-panel:') &&
  block_of(tokens, ':root').include?('--math-panel-bg:')
%w[mid dark].each do |th|
  blk = block_of(tokens, %(html[data-wk-theme="#{th}"]))
  issues << "#{th} 那包没重定义面板底色令牌（浮窗在那一包下会退回亮色）" unless
    blk.include?('--math-panel:') && blk.include?('--math-panel-bg:')
end
# 浮窗真的改用面板令牌了（白板的题库 / 分析 / 菜单 / 设置浮窗 + 数轴的分析与考点浮窗）。
{ 'whiteboard.html' => 4, 'timeline-3d.html' => 1 }.each do |file, least|
  n = read(file).scan(/background:\s*var\(--math-panel(?:-bg)?\)/).size
  issues << "#{file} 里只有 #{n} 处浮窗底走 --math-panel（应 ≥ #{least}：白板的题库 / 分析 / 菜单 / 设置浮窗、数轴的两个浮窗）" if n < least
end

# 每一套的选择器：全站那条 `html[…]` + 设置页预览那条 `html […]`（**带空格那个前缀不能省**：
# 不带就只有 (0,1,0) 的特异度，暗色主题下会被 `html[data-wk-theme="dark"]` 压住，
# 于是"暗色下预览出来的是亮色那一套"）。默认那套的预览走 `:root, [data-wk-scheme="green"]`。
(SCHEMES - ['green']).each do |s|
  issues << "tokens.css 缺色彩方案「#{s}」（全站生效的那条 html[…]）" unless
    tokens.include?(%(html[data-wk-scheme="#{s}"]))
end
(SCHEMES - ['green']).each do |s|
  issues << "色彩方案「#{s}」的设置页预览选择器没带 `html ` 前缀（暗色下会被主题包压住，" \
            '预览出来的不是实际生效的那一套）' unless tokens.include?(%(html [data-wk-scheme="#{s}"]))
end

# 默认那套也必须有一条能命中 `[data-wk-scheme="green"]` 的规则 ——
# 没有它，设置页第一颗预览按钮会继承 <html> 上当前的方案（用户报的"点别的方案第一颗跟着变"）。
GREEN_SEL = '[data-wk-scheme="green"]'
green_block = block_of(tokens, GREEN_SEL)
issues << '默认方案（松绿）缺一条命中 [data-wk-scheme="green"] 的规则 —— ' \
          '设置页第一颗预览按钮会继承 <html> 上当前的方案，点别的方案它跟着变' if green_block.empty?
# 而且七个值必须与 :root 里那一份**逐个对上**：同一份值抄在两处，改一处忘另一处，
# 第一颗预览按钮就会与实际生效的颜色对不上。
# （2026-09-30 撤掉深色底板之后这条更简单了：那七档压白压黑都达标、不跟主题走，
#   三包共用一份值，所以这里直接比字面值即可。只有 idle 仍是 var(--math-ink-4)。）
root_bar = {}
BAR_TOKENS.each { |t| root_bar[t] = resolve_tok(root_tokens[t], root_tokens) }
green_pal = tokens_in(green_block)
BAR_TOKENS.each do |t|
  got = resolve_tok(green_pal[t], root_tokens)
  issues << "默认方案的 #{t} 与 :root 里那一份对不上（#{got} vs #{root_bar[t]}）—— " \
            '同一份值抄在两处，改一处忘另一处' unless got == root_bar[t]
end

# 逐套：七个令牌齐全 + 六个彩色档**同时**压白 / 压黑 ≥ 3:1 + 相邻两档色相差 ≥ 30°
SCHEME_VALS = {}
SCHEMES.each do |s|
  sel = s == 'green' ? GREEN_SEL : %(html[data-wk-scheme="#{s}"], html [data-wk-scheme="#{s}"])
  pal = tokens_in(block_of(tokens, sel))
  BAR_TOKENS.each do |t|
    issues << "色彩方案「#{s}」缺 #{t}（缺一个就会退回上一层的色，方案就不成一套）" unless
      pal[t] && !pal[t].to_s.empty?
  end
  vals = COLOR_BARS.map { |t| resolve_tok(pal[t], root_tokens) }
  SCHEME_VALS[s] = vals
  # 两个底都要量：亮色主题的底是纯白、暗色主题的底是纯黑。彩条**没有**深色底板垫
  # （用户 2026-09-30："加了颜色，改颜色之后就成黑色背景了，改回去啊"），
  # 所以"看得清"就得是它自己挣来的 —— 两边都到 3:1 才叫真的看得清。
  COLOR_BARS.zip(vals).each do |t, v|
    [[ '#ffffff', '纯白' ], [ '#000000', '纯黑' ]].each do |bg, cn|
      c = contrast(v, bg)
      issues << format('方案「%s」的 %s(%s) 压在%s上只有 %.2f:1（要 ≥ 3.0）', s, t, v, cn, c) if c && c < 3.0
    end
  end
  hs = vals.map { |v| hue_of(v) }
  hs.each_cons(2).with_index do |(a, b), i|
    next if a.nil? || b.nil?
    d = (a - b).abs
    d = 360 - d if d > 180
    issues << format('方案「%s」里 %s 与 %s 只差 %d° 色相（要 ≥ 30°）—— 七档状态会分不清',
                     s, COLOR_BARS[i], COLOR_BARS[i + 1], d) if d < 30
  end
end

# ③ 套与套之间也得"一眼看得出不一样"（用户 2026-09-30："这颜色是不是一模一样，这六组"）。
#    只靠色相做不到 —— 六套都得铺满色环，必然撞车；所以明度与饱和度也要参与区分（见 tokens.css 的说明）。
#    量法：按槽位比 RGB 欧氏距离，≥60 算"看得出不同"，要求任意两套至少 4 个槽位不同。
#    只查"相邻两档"是不够的：第二版六套各自都合规，但六套互相像，用户照样一眼看不出区别。
WANT_APART = 4
SCHEMES.combination(2) do |a, b|
  diffs = [a, b].map { |s| SCHEME_VALS[s].map { |v| rgb_of(v) } }
  far = 0
  COLOR_BARS.each_index do |i|
    d = Math.sqrt(diffs[0][i].zip(diffs[1][i]).sum { |x, y| (x - y)**2 })
    far += 1 if d >= 60
  end
  issues << "色彩方案「#{a}」与「#{b}」太像（六个槽位里只有 #{far} 个颜色明显不同，要 ≥ #{WANT_APART}）—— " \
            '两组摆在设置页上会"一模一样"' if far < WANT_APART
end

%w[SCHEME_KEY SCHEME_ATTR SCHEMES SCHEME_DEFAULT].each do |needle|
  issues << "display.js 缺 #{needle}（掌握度色彩没接上）" unless disp.include?(needle)
end
issues << 'display.js 的色彩方案没用自己的名字空间属性' unless disp.include?("SCHEME_ATTR = 'data-wk-scheme'")
issues << '默认那套色彩方案会往 <html> 上写属性（"没设过"与"设成默认"就区分不开了）' unless
  disp.include?('if (state.scheme === SCHEME_DEFAULT) el.removeAttribute(SCHEME_ATTR)')

# ---------- 7. 白板与图谱跟随 ----------
%w[DISPLAY_TO_BOARD BOARD_TO_DISPLAY function reconcileTheme function pushThemeToDisplay].each do |needle|
  issues << "whiteboard.js 缺 #{needle}（板面与整站配色没接成同一份真值）" unless wb.include?(needle)
end
issues << 'whiteboard.js 没有监听 wk:display（设置里改了配色，板面不跟着换）' unless wb.include?("addEventListener('wk:display'")
issues << 'whiteboard.js 的 setTheme 没把配色写回设置' unless wb.include?('pushThemeToDisplay(key)')
# 画布/浮层不许再有写死的白底白字（深色下就是一块白斑）。
# 按"规则"而不是按"行"看：多行规则里那一行不一定带着选择器，按行判会漏也会误报。
# 认过的例外只有两处，写在这儿、说清理由 —— 加新的必须同时写理由：
#   · forum.html 的 .bn-*：轮播图控件压在图片与压暗层上，白字白点在任何配色下都对（同播放器控件）
#   · settings.html 的 .disp-dot--light：那是"亮色那一档长什么样"的实物样本，
#     它**必须**是写死的白，跟着当前配色变就没意义了
WHITE_OK = { 'forum.html' => /^\.bn-/, 'settings.html' => /^\.disp-dot--light$/ }.freeze

def white_rules(html)
  out = []
  html.scan(/([^{}]*)\{([^{}]*)\}/).each do |sel, body|
    # 白底白字有两种写法：#fff 和 rgba(255,255,255,…)。
    # 后者踩过一次：悬浮工具条写死 rgba(255,255,255,.86)，深色下成了一大块白板。
    next unless body =~ /(?:background|color):\s*(#fff|rgba\(\s*255\s*,\s*255\s*,\s*255)/i
    out << sel.strip.split(/\s+/).last.to_s
  end
  out
end

pages.each do |p|
  name = File.basename(p)
  found = white_rules(read(name))
  next if found.empty?
  allow = WHITE_OK[name]
  stray = allow ? found.reject { |s| s =~ allow } : found
  issues << "#{name} 里还有写死的 #fff：#{stray.uniq.join('、')}（深色下会突兀）" unless stray.empty?
end

# ---------- 8. 暗色必须是**纯粹的黑白** ----------
# 用户原话："暗色系怎么感觉是蓝色；搞成黑色，黑白是纯粹的颜色"。
# 原来暗色那包是深蓝黑（#0f172a 一族），中性面（底 / 面 / 卡 / 浮层 / 分隔 / 四级灰字 / 悬浮条）
# 全带蓝调 —— 整页看过去就是"发蓝"。这里把"纯"钉成可核对的规矩：中性面一律 R=G=B。
# 只留两处颜色，都是有语义的：--math-primary 那一族（品牌色，可点的东西的语言）
# 与 --math-state-*（成功 / 警告 / 错误）。中性面抽干净之后，页面自然就不发蓝了。
NEUTRAL_TOKENS = %w[
  --math-background --math-foreground --math-surface --math-surface-2
  --math-card --math-card-foreground --math-popover --math-popover-foreground
  --math-muted --math-muted-foreground --math-ink-2 --math-ink-3 --math-ink-4
  --math-border --math-line --math-line-strong --math-input --math-dock
].freeze

def grey?(value)
  v = value.to_s.strip
  if v =~ /\A#([0-9a-fA-F]{6})\z/
    p = Regexp.last_match(1).downcase
    p[0, 2] == p[2, 2] && p[2, 2] == p[4, 2]
  elsif v =~ /\Argba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/
    Regexp.last_match(1).to_i == Regexp.last_match(2).to_i &&
      Regexp.last_match(2).to_i == Regexp.last_match(3).to_i
  else
    false
  end
end

dark_tokens = tokens_in(block_of(tokens, 'html[data-wk-theme="dark"]'))
issues << '暗色那一包里解析不出令牌（守线要跟着改）' if dark_tokens.empty?
NEUTRAL_TOKENS.each do |t|
  issues << "暗色的 #{t} 还带着色相（#{dark_tokens[t]}）—— 中性面必须是无彩的纯灰（R=G=B）" unless
    grey?(dark_tokens[t])
end
issues << "暗色的底不是纯黑（实际 #{dark_tokens['--math-background']}）" unless
  dark_tokens['--math-background'].to_s.downcase == '#000000'
issues << "暗色的字不是纯白（实际 #{dark_tokens['--math-foreground']}）" unless
  dark_tokens['--math-foreground'].to_s.downcase == '#ffffff'
# 主色底上的字也跟着纯化（原来是 #0f172a 那个深蓝黑）
issues << "暗色主色底上的字不是纯黑（实际 #{dark_tokens['--math-primary-foreground']}）" unless
  dark_tokens['--math-primary-foreground'].to_s.downcase == '#000000'
# 设置页那颗"暗色长什么样"的预览块必须跟着变，不然选之前看到的还是蓝的
issues << '设置页的暗色预览块不是纯黑（选之前看到的还是旧的蓝黑）' unless
  set.include?('.disp-dot--dark{background:#000000}')

# 黑板那边同理：板面纯黑、粉笔纯白、网格与悬停底都不许带色相
board = wb[/key: 'dark', label: '黑板',[\s\S]*?\n    \}/].to_s
issues << 'whiteboard.js 里找不到黑板那一套配色（守线要跟着改）' if board.empty?
issues << "黑板板面不是纯黑（实际 #{board[/board: '([^']+)'/, 1]}）" unless board.include?("board: '#000000'")
issues << "黑板粉笔不是纯白（实际 #{board[/ink: '([^']+)'/, 1]}）" unless board.include?("ink: '#ffffff'")
%w[grid tint].each do |k|
  v = board[/#{k}: '([^']+)'/, 1].to_s
  issues << "黑板的 #{k} 还带着色相（#{v}）—— 黑板上的底纹与悬停底必须是无彩的白" unless
    v =~ /\Argba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/ &&
    Regexp.last_match(1).to_i == 255 && Regexp.last_match(2).to_i == 255 && Regexp.last_match(3).to_i == 255
end
issues << '黑板那三档浓淡（inkSoft / tag / tagHot）还带着色相' unless
  board.scan(/rgba\(255,255,255,/).size + board.scan(/rgba\(255, 255, 255,/).size >= 3
issues << "黑板默认那支笔不是纯白（实际 #{wb[/\{ value: '(#f8fafc|#[0-9a-f]{6})', label: '雪白'/, 1]}）" unless
  wb.include?("{ value: '#ffffff', label: '雪白' }")

# ---------- 9. 难度五档的色阶：同时压得住白和黑 ----------
# （放在最后：这一段要用 rgb_of / resolve_tok，那两个 helper 定义在上面）
# 它是"一把尺子"（基础绿 → 概念蓝 → 应用黄 → 变化橙 → 综合红），
# 谁手改一个偏亮 / 偏暗的值进来，就会有一头看不清 —— 跟七档色同一条约束。
LEVEL_TOKENS = %w[--math-lv-1 --math-lv-2 --math-lv-3 --math-lv-4 --math-lv-5].freeze
LEVEL_TOKENS.each do |t|
  raw = resolve_tok(root_tokens[t], root_tokens)
  l = raw.nil? ? nil : (lum(raw) || nil)
  if l.nil?
    issues << "难度档 #{t} 不是个纯色（读到的是 #{raw.inspect}）"
  else
    on_white = 1.05 / (l + 0.05)
    on_black = (l + 0.05) / 0.05
    if on_white < 3 || on_black < 3
      issues << "难度档 #{t}（#{raw}）压不住底：白 #{on_white.round(2)}:1 · 黑 #{on_black.round(2)}:1（都要 ≥ 3:1）"
    end
  end
end

# ---------- 10. 滚轮条要跟着主题走 ----------
# 用户 2026-09-30 圈了张截图："这些竖条颜色不对" —— 暗色是纯黑底 + 纯白字，
# 浏览器默认那套滚轮条却是浅色的，纯黑页面边上横着一根亮条。
issues << '滚轮条没跟主题走（暗色下会横一根浅色条）' unless
  tokens.include?('scrollbar-color: var(--math-ink-4) transparent;') &&
  tokens.include?('::-webkit-scrollbar-thumb') &&
  tokens.include?('background-color: var(--math-ink-4);') &&
  tokens.include?('background-color: var(--math-ink-3);')

puts "页面：#{pages.size} 个（另 #{STANDALONE.size} 个独立页不接启动器），全部挂了启动器；字号可缩放 #{pages.size} 页"
puts "配色令牌：:root 里 #{color_names.size} 个颜色令牌，中色 / 暗色逐一对齐"
puts '对比度：亮 / 中 / 暗三套的正文、次级、说明、次要、主色均已计算'
puts '字体：四个字重各一段 @font-face，全指向本地子集（assets/fonts/*.woff2，共 4 个文件）；四个字体令牌都以阿里巴巴普惠体打头'
unless issues.empty?
  puts
  issues.each { |i| puts "  ✗ #{i}" }
  exit 1
end
puts '阅读与显示体检全部通过 ✓'
