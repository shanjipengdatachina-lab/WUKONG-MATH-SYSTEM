# encoding: UTF-8
# 白板页体检
ROOT = (ENV['WKMATH_ROOT'] || File.expand_path('../..', __dir__)).dup.force_encoding('UTF-8')
html = File.read(File.join(ROOT, 'whiteboard.html'), encoding: 'UTF-8')

issues = []
%w[header nav main aside section div ul li button canvas label p a].each do |tag|
  o = html.scan(/<#{tag}[\s>]/i).length
  c = html.scan(%r{</#{tag}>}i).length
  issues << "#{tag} 标签不配平(#{o}/#{c})" if o != c
end

need = {
  '侧栏外壳' => 'class="ide-rail"',
  '侧栏版本标记' => 'data-shell="2"',
  '白板入口高亮' => 'data-nav-key="whiteboard" data-active="true"',
  '单列骨架（无左右栏）' => 'class="reader-shell wb-shell"',
  '单列优先于 ide.css 三栏' => '.reader-shell.wb-shell{display:grid;grid-template-columns:minmax(0,1fr)',
  '悬浮题库面板' => 'class="wb-bank" id="wb-bank" aria-label="题库" hidden',
  '题库拖拽标题栏' => 'class="wb-bank__head" id="wb-bank-head"',
  '拖拽手柄图标' => 'data-lucide="grip-vertical"',
  '题库关闭按钮' => 'class="wb-bank__close" id="wb-bank-close"',
  '工具条题库按钮' => 'class="wb-dock__btn" id="wb-bank-toggle"',
  '题库按钮用书库图标' => 'data-lucide="library-big"',
  '题目列表容器' => 'id="wb-bank-list"',
  '题目搜索框' => 'id="wb-search"',
  '册筛选' => 'id="wb-books"',
  '画布' => 'id="wb-canvas"',
  '悬浮工具条' => 'class="wb-dock"',
  '工具组：画笔组格子' => 'wb-dock__btn wb-dock__btn--group" id="wb-group-draw"',
  '工具组：图形组格子' => 'wb-dock__btn wb-dock__btn--group" id="wb-group-shape"',
  '画笔组浮层' => 'class="wb-flyout" id="wb-flyout-draw"',
  '图形组浮层' => 'class="wb-flyout" id="wb-flyout-shape"',
  '格子内按当前工具切换图标' => '.wb-dock__btn--group[data-active="pen"] [data-wb-ico="pen"]',
  '格子右下角的小三角' => 'class="wb-dock__caret"',
  '浮层样式' => '.wb-flyout{',
  '浮层项样式' => '.wb-flyout__item{',
  '画笔按钮' => 'id="wb-pen"',
  '荧光标记按钮' => 'id="wb-highlighter"',
  '橡皮按钮' => 'id="wb-eraser"',
  '直线按钮' => 'id="wb-line"',
  '箭头按钮' => 'id="wb-arrow"',
  '矩形按钮' => 'id="wb-rect"',
  '椭圆按钮' => 'id="wb-ellipse"',
  '缩放控件在工具条内' => 'id="wb-zoom-level"',
  '放大按钮' => 'id="wb-zoom-in"',
  '缩小按钮' => 'id="wb-zoom-out"',
  '适应内容（设置面板内）' => 'id="wb-zoom-fit"',
  '全屏按钮在侧栏（与全站一致）' => 'id="toggle-fullscreen"',
  '撤销按钮' => 'id="wb-undo"',
  '重做按钮' => 'id="wb-redo"',
  '清空按钮' => 'id="wb-clear"',
  '网格按钮' => 'id="wb-grid"',
  '题面开关' => 'id="wb-problem-toggle"',
  '回到知识点按钮' => 'class="wb-dock__btn" id="wb-jump-kp"',
  '设置面板开关' => 'id="wb-settings"',
  '悬浮设置面板' => 'id="wb-pop"',
  '颜色区' => 'id="wb-colors"',
  '笔粗区' => 'id="wb-widths"',
  '橡皮大小区' => 'id="wb-erasers"',
  '题面文字镜像（无障碍）' => 'id="wb-problem-text"',
  '题库脚本' => 'whiteboard-problems.js',
  '白板脚本' => 'whiteboard.js'
}
need.each { |label, token| issues << "缺 #{label}" unless html.include?(token) }

# 悬浮题库面板：必须是画板里的浮层，不能再占网格列
stage_i = html.index('<section class="wb-stage"')
bank_i = html.index('<aside class="wb-bank"')
issues << '题库面板没有放进画板（应作为 .wb-stage 的浮层子元素）' unless stage_i && bank_i && bank_i > stage_i
issues << '题库面板缺少绝对定位（应悬浮，不占画布空间）' unless html.include?('.wb-bank{') && html.include?('position:absolute;left:20px;bottom:80px')
issues << '题库面板没有拖拽态光标' unless html.include?('.wb-bank__head{') && html.include?('cursor:grab')
issues << '题库面板仍按窄屏堆叠（应始终悬浮）' if html.include?('#wb-bank{position:static')
issues << '仍保留旧的题库栏骨架类名' if html.include?('wb-pane-head') || html.include?('wb-pane-title')
issues << '侧栏仍留着旧的题库栏开关' if html.include?('id="toggle-left"')

# 工具条分组：画笔 / 图形这 7 个按钮必须收进两组浮层，条上只留两个格子
%w[wb-pen wb-highlighter wb-eraser wb-line wb-arrow wb-rect wb-ellipse].each do |id|
  unless html =~ /<button[^>]*class="wb-flyout__item"[^>]*id="#{id}"/
    issues << "工具 #{id} 没在浮层里（应带 wb-flyout__item 类）"
  end
end
%w[wb-group-draw wb-group-shape].each do |id|
  issues << "工具组格子 #{id} 的类名不对" unless html =~ /<button[^>]*wb-dock__btn--group"[^>]*id="#{id}"/
end

issues << '仍保留顶部工具条' if html.include?('class="wb-tools"')
issues << '仍保留右侧固定栏' if html.include?('class="wb-side"')
issues << '仍保留右侧悬浮栏目' if html.include?('class="wb-zoom"')
issues << '仍保留画布上方的题面卡片' if html.include?('class="wb-problem" id="wb-problem"')
issues << '标签页标题异常' unless html =~ /<title>数字白板/ && html.rstrip.end_with?('</html>')

puts "whiteboard.html: #{html.bytesize} 字节"

# 工具条槽位统计（分组后应该明显变少）
plain = html.scan(/class="wb-dock__btn"/).length
groups = html.scan(/class="wb-dock__btn wb-dock__btn--group"/).length
level = html.scan(/class="wb-dock__level"/).length
puts "工具条槽位: #{plain + groups + level} 个（工具组 #{groups} + 普通按钮 #{plain} + 缩放读数 #{level}）"
issues << '工具条槽位又变多了，检查是否把同类工具拆回了单个按钮' unless plain + groups + level <= 14

# 紧凑度：浮层 / 工具条 / 设置面板都收过一档，别又松回去
tight = {
  '浮层行高 26px' => '.wb-flyout__item{',
  '浮层宽度 146px' => 'min-width:146px;padding:4px',
  '浮层图标 14px' => '.wb-flyout__item svg{flex:none;width:14px;height:14px}',
  '浮层行间距 1px' => 'flex-direction:column;gap:1px',
  '工具条按钮 34px' => 'width:34px;height:34px;padding:0',
  '工具条图标 16px' => '.wb-dock__btn svg{width:16px;height:16px}',
  '设置面板内边距 12/14' => 'padding:12px 14px',
  '色板 22px' => 'width:22px;height:22px;padding:2px'
}
tight.each do |label, token|
  issues << "紧凑度回退：缺 #{label}" unless html.include?(token)
end
issues << '浮层行高又变回 32px' if html.include?('height:32px;padding:0 9px')
issues << '工具条按钮又变回 36px' if html.include?('width:36px;height:36px;padding:0')

# 激活态提示：圆角实心块（专业工具条做法），不再是圈住图标的圆环
shape = {
  '工具条是圆角矩形而不是胶囊' => 'border:1px solid var(--math-border);border-radius:var(--math-radius-lg)',
  '按钮是圆角方形而不是圆形' => 'border:1px solid transparent;border-radius:var(--math-radius-md)',
  '激活块用实心浅色 + 主色图标' =>
    '.wb-dock__btn.is-on{border-color:transparent;background:var(--math-primary-tint);color:var(--math-primary)}',
  '激活块悬停时加深一档' => '.wb-dock__btn.is-on:hover{background:var(--math-primary-200)}'
}
shape.each { |label, token| issues << "激活态缺「#{label}」" unless html.include?(token) }
issues << '浮层里当前工具的高亮没跟工具条统一' unless
  html.include?('.wb-flyout__item.is-on{background:var(--math-primary-tint);color:var(--math-primary)}')
issues << '激活态又用回「圆圈描边」' if
  html[/\.wb-dock__btn\.is-on\{[^}]*border-color:var\(--math-primary-200\)/]
issues << '工具条又变回胶囊' if html[/\.wb-dock\{[^}]*border-radius:999px/]
issues << '工具条按钮又变回圆形' if html[/\.wb-dock__btn\{[^}]*border-radius:999px/]
# 保留的圆只应是语义上该圆的：色板（含色板内圆）、笔迹预览点、橡皮预览环、册筛选胶囊
round_ok = html.scan(/border-radius:999px/).length
issues << "圆形用法数量异常（#{round_ok}）" unless round_ok == 6

# 悬浮提示：自绘气泡替掉系统灰框，工具条上不再挂 title
dock_html = html[/<div class="wb-dock".*?<div class="wb-pop"/m].to_s
issues << '工具条又挂回了系统 title 气泡' if dock_html.include?('title="')
issues << '自绘提示样式缺失' unless html.include?('content:attr(data-wb-tip)')
issues << '浮层展开时没有抑制提示' unless html.include?('[data-wb-tip][aria-expanded="true"]::after{display:none}')
issues << '自绘提示数量异常（' + html.scan('data-wb-tip="').length.to_s + '）' unless html.scan('data-wb-tip="').length == 14

# 提示气泡要真的浮在工具条**之上**：气泡锚在按钮上，而工具条自己还有 padding + border，
# 差值太小就会压住工具栏的边框，看着像"挡在工具栏上"。
tip_gap  = html[/\[data-wb-tip\]::after\{[^}]*?bottom:calc\(100% \+ (\d+)px\)/m, 1].to_i
dock_pad = html[/\.wb-dock\{[^}]*?padding:(\d+)px/m, 1].to_i
dock_bw  = html[/\.wb-dock\{[^}]*?border:(\d+)px/m, 1].to_i
clearance = tip_gap - dock_pad - dock_bw
issues << "提示气泡离工具条上沿只有 #{clearance}px，会压住工具栏（至少要 8px）" if clearance < 8

# 操作反馈（全站 toast）也不能压住工具条。它挂在 document.body 上、定位是全站统一的
# bottom:28px，而白板工具条底边在 18px、顶边在 64px —— 必然重叠。
# 覆盖规则必须写在样式表 <link> 之后（同权重靠文档顺序取胜），选择器要盖住 body 那一层。
toast_bottom = html[/body \.toast-stack\{[^}]*?bottom:calc\((\d+)px/m, 1].to_i
if toast_bottom.zero?
  issues << '白板页没有把操作反馈抬到工具条上方（body .toast-stack 覆盖缺失或选择器选不中）'
else
  dock_bottom = html[/\.wb-dock\{[^}]*?bottom:(\d+)px/m, 1].to_i
  dock_h      = html[/\.wb-dock__btn\{[^}]*?width:(\d+)px;height:(\d+)px/m, 1].to_i +
                2 * html[/\.wb-dock\{[^}]*?padding:(\d+)px/m, 1].to_i +
                2 * html[/\.wb-dock\{[^}]*?border:(\d+)px/m, 1].to_i
  gap = toast_bottom - (dock_bottom + dock_h)
  issues << "操作反馈离工具条上沿只有 #{gap}px，会压住工具栏（至少要 8px）" if gap < 8
end
link_i  = html.index('assets/css/shell.css')
style_i = html.index('<style id="wb-page-styles">')
issues << 'toast 覆盖写在了样式表之前，会被 shell.css 盖掉' if link_i && style_i && style_i < link_i
wbjs = File.read(File.join(ROOT, 'assets/js/whiteboard.js'), encoding: 'UTF-8')
issues << '笔粗 / 橡皮按钮仍用系统 title' if wbjs.include?('title="笔粗') || wbjs.include?('title="橡皮')

# 全屏已并到侧栏：工具条不留全屏，专注模式（wb-focus）那套一并清掉
dock_only = html[/<div class="wb-dock".*?<div class="wb-pop"/m].to_s
issues << '工具条里还留着全屏按钮（应与侧栏统一）' if dock_only.include?('id="wb-full"')
issues << '仍残留 wb-focus 专注模式样式' if html.include?('wb-focus')
issues << 'whiteboard.js 仍在自管全屏' if wbjs.include?('function toggleFull') || wbjs.include?('function setFocus')
issues << 'whiteboard.js 没监听全屏切换（全屏后画布要重排）' unless wbjs.include?("'fullscreenchange'")

flyout_h = 4 * 26 + 3 * 1 + 2 * 4 + 2
puts "浮层尺寸: 146 × #{flyout_h}px（原 172 × 148px，面积 -33%）"
puts "工具条按钮: 34px（原 36px）；设置面板内边距: 12/14（原 16/18）"

puts issues.empty? ? '白板页体检全部通过 ✓' : issues.map { |i| "  ✗ #{i}" }.join("\n")

# 题库统计
probs = File.read(File.join(ROOT, 'assets/js/whiteboard-problems.js'), encoding: 'UTF-8')
puts "题库条目: #{probs.scan(/\{ id: '/).length} 条"
puts "页面总数: #{Dir.glob(File.join(ROOT, '*.html')).length}"

# 全站白板入口（白板功能规划.html 是独立文档，按设计不进侧栏，不计入）
STANDALONE = %w[白板功能规划.html]
miss = Dir.glob(File.join(ROOT, '*.html'))
         .reject { |f| STANDALONE.include?(File.basename(f)) }
         .reject { |f| File.read(f, encoding: 'UTF-8').include?('data-nav-key="whiteboard"') }
puts miss.empty? ? '全站侧栏均已加入白板入口 ✓' : "缺白板入口: #{miss.map { |f| File.basename(f) }.join(', ')}"
