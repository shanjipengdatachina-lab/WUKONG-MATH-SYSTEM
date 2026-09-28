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

{ 'mid' => '中色', 'dark' => '暗色' }.each do |theme, cn|
  block = block_of(tokens, %(html[data-wk-theme="#{theme}"]))
  issues << "tokens.css 里没有 #{cn} 那一包（html[data-wk-theme=\"#{theme}\"]）" if block.empty?
  have = tokens_in(block)
  miss = color_names.reject { |k| have.key?(k) }
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
%w[fs theme accent].each do |g|
  rule = /#set-#{g} \.seg__item\[aria-pressed="true"\][,{]/
  issues << "设置页「#{g}」那一组没有按下样式（选中了也看不出来）" unless set =~ rule
end

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

puts "页面：#{pages.size} 个，全部挂了启动器；字号可缩放 #{pages.size} 页"
puts "配色令牌：:root 里 #{color_names.size} 个颜色令牌，中色 / 暗色逐一对齐"
puts '对比度：亮 / 中 / 暗三套的正文、次级、说明、次要、主色均已计算'
unless issues.empty?
  puts
  issues.each { |i| puts "  ✗ #{i}" }
  exit 1
end
puts '阅读与显示体检全部通过 ✓'
