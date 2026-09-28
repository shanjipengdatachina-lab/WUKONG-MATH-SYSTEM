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
  '板面选择器' => 'id="wb-themes"',
  '板面选择器样式' => '.wb-theme{',
  '网格疏密区' => 'id="wb-grids"',
  '网格疏密选择器样式' => '.wb-grid{',
  '画布底色跟着主题' => 'background:var(--wb-board,var(--math-background))',
  '题库脚本' => 'whiteboard-problems.js',
  '题面上方三个按钮（上传我的题）' => 'id="wb-act-upload"',
  '分析按钮' => 'id="wb-act-analysis"',
  '答案按钮' => 'id="wb-act-answer"',
  '三个按钮的按钮组' => 'class="wb-acts" id="wb-acts"',
  '思路框（题目右侧）' => 'id="wb-think"',
  '思路框的条目列表' => 'id="wb-think-list"',
  '答案块（题目下方）' => 'id="wb-answer"',
  '答案块的标准答案行' => 'id="wb-answer-result"',
  '答案块的注释开关' => 'id="wb-act-notes"',
  '上传功能的实话条' => 'id="wb-upload-tip"',
  '分析与答案数据脚本' => 'whiteboard-analysis.js',
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
# 保留的圆只应是语义上该圆的：色板（含色板内圆）、笔迹预览点、橡皮预览环、册筛选胶囊。
# **只数共享区（wb-styles）**：要守的是"工具条 / 浮层这些共用控件别变回胶囊"，
# 而回归风险只存在于共享区。页面自己的小控件用胶囊是合理的
# （「演示」标、语气标这种小标签本来就是圆的），数进去只会逼着后来人改预期数字。
shared_css = html[/<style id="wb-styles">(.*?)<\/style>/m, 1].to_s
round_ok = shared_css.scan(/border-radius:999px/).length
issues << "共享区里的圆形用法数量异常（#{round_ok}，应为 6）" unless round_ok == 6

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

# 「分析 / 答案」这一层：两个按钮必须"很轻"（静止不铺底色），否则板面就不干净了；
# 且新样式必须放在第二套 style 块里 —— wb-styles 是图谱共享样式的母版（会被改名抄到图谱）。
issues << '分析 / 答案按钮丢了"很轻"的静止态（应 background:none）' unless
  html[/\.wb-act\{[^}]*background:none/m]
# 注意这个正则：不能用 `.*?`，它会跨过 `</style>` 跑到后面那个块里去找 .wb-act{，
# 结果把"样式确实在独立块里"误报成"跑进了 wb-styles"（这条先写错过一次）。
issues << '分析 / 答案的样式跑进了 wb-styles（会被抄到图谱当死规则）' if
  html[/<style id="wb-styles">(?:(?!<\/style>).)*?\.wb-act\{/m]
issues << '分析 / 答案的样式没放进独立 style 块' unless html.include?('<style id="wb-analysis-styles">')
issues << '分析 / 答案按钮挂回了系统 title / 自绘提示（它们自己有字，不需要）' if
  html[/id="wb-act-(analysis|answer|transcribe)"[^>]*data-wb-tip/]
wbjs = File.read(File.join(ROOT, 'assets/js/whiteboard.js'), encoding: 'UTF-8')
issues << '笔粗 / 橡皮按钮仍用系统 title' if wbjs.include?('title="笔粗') || wbjs.include?('title="橡皮')

# 全屏已并到侧栏：工具条不留全屏，专注模式（wb-focus）那套一并清掉
dock_only = html[/<div class="wb-dock".*?<div class="wb-pop"/m].to_s
issues << '工具条里还留着全屏按钮（应与侧栏统一）' if dock_only.include?('id="wb-full"')
issues << '仍残留 wb-focus 专注模式样式' if html.include?('wb-focus')
issues << 'whiteboard.js 仍在自管全屏' if wbjs.include?('function toggleFull') || wbjs.include?('function setFocus')
issues << 'whiteboard.js 没监听全屏切换（全屏后画布要重排）' unless wbjs.include?("'fullscreenchange'")

# 网格疏密三档：三档必须齐、数值必须和 js 里的梯子对得上，
# 预览方块的疏密方向不能写反（20 那档格子最小），样式同样不许进共享区。
GRID_LADDER = [20, 40, 80].freeze
GRID_LADDER.each do |size|
  issues << "网格疏密少了 #{size} 这一档" unless html.include?(".wb-grid[data-wb-grid=\"#{size}\"] .wb-grid__chip")
end
chip_px = GRID_LADDER.map { |s| html[/\.wb-grid\[data-wb-grid="#{s}"\] \.wb-grid__chip\{background-size:([\d.]+)px/, 1].to_f }
if chip_px.any? { |v| v <= 0 }
  issues << "网格预览方块缺 background-size（有两档看起来一样密）"
elsif !(chip_px[0] < chip_px[1] && chip_px[1] < chip_px[2])
  issues << "网格预览方块的疏密写反了（应 20 最密 → 80 最疏，实际 #{chip_px.join(' / ')}px）"
end
GRID_LADDER.each do |size|
  issues << "js 里的网格梯子少了 #{size}" unless wbjs.include?("value: #{size}") || wbjs[/var GRID_SIZES[\s\S]*?\];/].to_s.include?("value: #{size}")
end
issues << '网格疏密是"顺手把网格打开"的（网格关着时选一档要能看到变化）' unless
  wbjs.include?('if (!state.grid) state.grid = true;')
issues << '网格疏密样式跑进了 wb-styles（会被抄到图谱当死规则）' if
  html[/<style id="wb-styles">(?:(?!<\/style>).)*?\.wb-grid\{/m]

# ---------- 手写转文字（思路框底部的按钮 + 题目下方的面板） ----------
# 这一层**没有真 AI**：内容全是预置的。所以最要紧的守线是"必须说清这是演示"，
# 以及"没写东西时不许凭空变出内容"（后者在断言里守，这里守页面上的那几处文案与结构）。
%w[wb-act-transcribe wb-ink-text wb-ink-steps wb-ink-note wb-ink-badge wb-ink-acts
   wb-ink-close wb-ink-again wb-ink-clear].each do |id|
  issues << "手写转文字缺挂点 ##{id}" unless html.include?(%(id="#{id}"))
end
issues << '转文字面板没有默认收起（会一进页面就浮在板上）' unless
  html[/id="wb-ink-text"[^>]*hidden/]
issues << '转文字面板没挂在题面同一层（应该是 .wb-canvas-wrap 的绝对定位子元素）' unless
  html.include?('.wb-ink{') && html.include?('position:absolute')
issues << '转文字面板缺「演示」标（预置数据必须说清，不许假装真识别）' unless
  html.include?('id="wb-ink-badge">演示<') || html.include?('id="wb-ink-badge">演示')
issues << '转文字面板缺一句说明挂点（#wb-ink-note）' unless html.include?('id="wb-ink-note"')
issues << '转文字样式跑进了 wb-styles（会被抄到图谱当死规则）' if
  html[/<style id="wb-styles">(?:(?!<\/style>).)*?\.wb-ink\{/m]
inkjs = File.read(File.join(ROOT, 'assets/js/whiteboard-ink-text.js'), encoding: 'UTF-8')
issues << '转文字的数据模块没被引用（应该是独立文件、界面与内容分开）' unless
  html.include?('whiteboard-ink-text.js') && html.index('whiteboard-ink-text.js') < html.index('assets/js/whiteboard.js')
issues << '转文字缺少"两个可替换的函数"（接真服务时只换它们）' unless
  inkjs.include?('function recognize(') && inkjs.include?('function review(')
issues << '转文字没写清"本版不接真 AI"' unless inkjs.include?('不接真 AI')
issues << '转文字没守住"只认题面框外的笔迹"' unless inkjs.include?('function outsideStrokes(')
issues << '转文字没写清"没写东西就不装"' unless inkjs.include?('一笔都没有时不装')
# 预置数据里不许出现"这一步有问题" —— 没有真模型就不判学生对错（语气标里支持，数据里不用）
issues << '预置数据里出现了 warn（没有真模型就不该判学生对错）' if
  inkjs[/var PRESET = \{[\s\S]*?\n  \};/].to_s.include?("'warn'")
issues << '文字那一格不是可编辑的（识别一定会出错，必须能改）' unless
  wbjs.include?('contenteditable')
# ---------- 题面上方那三个按钮 + 右侧思路框 + 下方答案块 ----------
# 用户看过第一版的"4~5 个可写台阶框"后明确否掉了，这一版是：三个小按钮（上传我的题 / 分析 / 答案）
# 摆在题目上方左对齐；「分析」出**一个**只读的思路框（在题目右侧）；
# 「答案」把标准答案直接写在题目下方，每步挂 AI 注释、注释可整块收起。
acts_html = html[/<div class="wb-acts".*?<\/div>/m].to_s
if acts_html.empty?
  issues << '找不到三个按钮那一排（.wb-acts）'
else
  issues << "按钮排里不是三个按钮（实际 #{acts_html.scan(/<button/).size} 个）" unless
    acts_html.scan(/<button/).size == 3
  order = %w[wb-act-upload wb-act-analysis wb-act-answer].map { |id| acts_html.index(id) }
  issues << '三个按钮的顺序不是「上传我的题 → 分析 → 答案」' unless
    order.all? && order == order.sort && order.uniq.size == 3
end

# 旧的台阶框必须**清干净**：留着挂点就会被下一版又接回去
issues << '页面上还留着旧的台阶框挂点（wb-step）' if html.include?('wb-step')
issues << 'whiteboard.js 里还留着台阶框那套代码' if wbjs.include?('wb-step') || wbjs.include?('stepGuides')
issues << 'whiteboard.js 里还留着可写台阶的内容字段（analysis.steps）' if wbjs.include?('analysis.steps')

%w[wb-think wb-answer].each do |id|
  issues << "#{id} 没有默认收起（会一进页面就浮在板上）" unless html[/id="#{id}"[^>]*hidden/]
end
think_i = html.index('id="wb-think"')
answer_i = html.index('id="wb-answer"')
think_html = (think_i && answer_i && answer_i > think_i) ? html[think_i...answer_i] : ''
issues << '思路框不是只读的（用户要的是"就看看思路"，里面不该有可写格子）' if
  think_html.include?('contenteditable')
issues << '思路框没挂在题面同一层（应该是 .wb-canvas-wrap 的绝对定位子元素）' unless
  html.include?('.wb-think{') && html.include?('.wb-answer{')
issues << '思路框 / 答案块样式跑进了 wb-styles（会被抄到图谱当死规则）' if
  html[/<style id="wb-styles">(?:(?!<\/style>).)*?\.wb-think\{/m]
issues << '答案块没标「AI 生成」（注释是 AI 给的，必须说清来源）' unless
  html.include?('wb-answer__flag') && html.include?('AI 生成')
issues << '「上传我的题」没写清这一版还没做（会变成点了没反应的假按钮）' unless
  html.include?('拍照上传还在做')
issues << '「上传我的题」没给出现在就能走的路（只说不做，等于把用户晾在那儿）' unless
  html.include?('用笔写出你的推导')
issues << '答案块没挂进"往下排"的登记表（各算各的位置，迟早和转写面板互相压）' unless
  wbjs.include?("el: byId('wb-answer')")
# 真机复核抓到过：窄题面时答案块（300 宽）比题面还宽，思路框只按"题面右缘"摆就会压在答案上。
issues << '思路框没让开题目下方那几块（会压在答案上，真机复核抓到过）' unless
  wbjs.include?('function groupRight(')
overlay_fn = wbjs[/function layoutOverlays\(ctx\)[\s\S]*?\n  \}/].to_s
issues << '浮层重排顺序不对：思路框要排在"下面那几块"之后摆（否则量不到它们的宽度）' unless
  overlay_fn.include?('layoutBelow(ctx)') && overlay_fn.include?('layoutThink(ctx)') &&
  overlay_fn.index('layoutBelow(ctx)') < overlay_fn.index('layoutThink(ctx)')
issues << '注释开关只有一态文案（收起 / 显示必须都有，否则点一次就再也回不来）' unless
  wbjs.include?('收起注释') && wbjs.include?('显示注释')
# 上限 8 步 × 大字号，内容能高过整块画布；不封顶的话框底那个「把手写转成文字」就再也点不到了
issues << '思路框 / 答案块没设最大高度（长内容会顶出画布，底下的按钮点不到）' unless
  html[/\.wb-think\{[^}]*max-height/] && html[/\.wb-answer\{[^}]*max-height/]
issues << '思路框 / 答案块的长内容不能自己滚（超出画布的部分就够不着了）' unless
  html[/\.wb-think__list\{[^}]*overflow-y:auto/] && html[/\.wb-answer__steps\{[^}]*overflow-y:auto/]
# 思路 / 答案 / 转文字三处共用同一套条目样式，最怕后一段"不带前缀地又写一遍"——
# 后写的会静静盖掉前写的，而且三处里只有一处看着不对（真机复核抓到过：
# 转文字面板的旧样式把答案块的编号压成了灰色小字、正文还多了一层底）。
tile_dupes = html.scan(/^([^\n{}]*?)\{/).flatten.map(&:strip)
               .select { |s| s.start_with?('.wb-tile') }
               .group_by { |s| s }.select { |_, v| v.size > 1 }.keys
issues << "条目样式被不带前缀地定义了两遍（后一条会悄悄盖掉前一条）：#{tile_dupes.join('、')}" unless tile_dupes.empty?
issues << '条目样式没做成三处共用的一套（思路 / 答案 / 转文字各写各的）' unless
  html.include?('.wb-tile{') && html.include?('.wb-tile__no{')
# 注释那一行是 flex:1 0 100%，再挂 margin 会被浏览器吞掉（真机上就是"注释与正文齐平"）
issues << 'AI 注释那一行没缩进（和正文齐平，会被当成正文的一部分）' unless
  html[/\.wb-tile__cmt\{[^}]*padding-left:/]
issues << '四块浮层的位置不是同一份（应共用 state.problemAt，"拖哪儿都整块动"）' if
  wbjs.include?('thinkAt') || wbjs.include?('answerAt') || wbjs.include?('actAt')
# 分析那一层的状态：只该有三个开关，落盘也是这三个
analysis_blocks = wbjs.scan(/analysis:\s*\{[\s\S]*?\n\s*\},/)
issues << '找不到分析那一层的状态 / 落盘块' if analysis_blocks.empty?
analysis_blocks.each do |b|
  %w[open answerOpen showNotes].each do |k|
    issues << "分析那一层的开关 #{k} 没进状态或没落盘" unless b.include?(k)
  end
  issues << '分析那一层存了步骤（步骤是算出来的，不该存）' if b.include?('steps')
end


# 设置面板又高了一行，矮屏上必须有个"放不下就自己滚"的兜底，不能把顶上一截切掉
issues << '设置面板没有兜底滚动（矮屏上会被切掉顶部，够不着上面那一行）' unless
  html[/\.wb-pop\{max-height:calc\(100vh - \d+px\);overflow-y:auto/]

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
