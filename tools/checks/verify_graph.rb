# encoding: UTF-8
# 知识图谱页体检：满屏骨架、底部工具条、悬浮面板、默认年级；并核对与白板的样式同源
ROOT = (ENV['WKMATH_ROOT'] || File.expand_path('../..', __dir__)).dup.force_encoding('UTF-8')
issues = []

graph = File.read(File.join(ROOT, 'graph.html'), encoding: 'UTF-8')
mini  = File.read(File.join(ROOT, 'assets/js/mindmap.js'), encoding: 'UTF-8')
shell = File.read(File.join(ROOT, 'assets/js/ide-shell.js'), encoding: 'UTF-8')
wb    = File.read(File.join(ROOT, 'whiteboard.html'), encoding: 'UTF-8')

# ---------- 1. 满屏骨架：去掉页头，画布独占 ----------
issues << '还能看到旧的页头 .mm-head' if graph.include?('class="mm-head"')
issues << '还留着"框架全屏"按钮' if graph.include?('mm-frame')
issues << '还留着"浏览器全屏"按钮' if graph.include?('id="mm-full"')
issues << '还留着框架全屏的样式钩子 data-mm-frame' if graph.include?('data-mm-frame')
issues << '缺少单列骨架 .reader-shell.mm-shell' unless graph.include?('.reader-shell.mm-shell')
issues << '画布没有铺满（缺 .mm-canvas{position:absolute;inset:0}）' unless graph =~ /\.mm-canvas\{position:absolute;inset:0/
issues << '画布没有回到第 1 列（CSS Grid 隐式列会把它压成 1px）' unless graph.include?('.mm-stage{grid-column:1')
issues << '侧栏的全屏按钮缺失（全站统一在左下角）' unless graph.include?('id="toggle-fullscreen"')

# ---------- 2. 底部工具条 ----------
issues << '缺底部工具条 .mm-dock' unless graph.include?('class="mm-dock"')
%w[mm-book-btn mm-book-menu mm-level-btn mm-level-menu mm-search-toggle mm-fit mm-out mm-reset mm-in mm-help-btn mm-help-menu].each do |id|
  issues << "工具条缺 ##{id}" unless graph.include?("id=\"#{id}\"")
end
issues << '工具条按钮没有自绘提示（应用 data-mm-tip，不要系统 title）' unless graph.include?('data-mm-tip=')
dock = graph[/<div class="mm-dock".*?<\/div>\s*<\/div>\s*<\/section>/m].to_s
issues << '工具条里还有系统 title 气泡' if dock =~ /\stitle="/

# ---------- 3. 悬浮面板（与白板题库面板同一套） ----------
issues << '缺悬浮信息面板 #mm-panel' unless graph.include?('id="mm-panel"')
issues << '信息面板没有默认收起（应带 hidden）' unless graph =~ /id="mm-panel"[^>]*hidden/
issues << '信息面板标题栏缺拖拽手柄' unless graph.include?('mm-card__grip')
issues << '信息面板缺关闭按钮' unless graph.include?('id="mm-panel-close"')
issues << '缺悬浮定位面板 #mm-search-panel' unless graph.include?('id="mm-search-panel"')
issues << '定位面板没有默认收起' unless graph =~ /id="mm-search-panel"[^>]*hidden/
issues << '定位面板缺标题栏' unless graph.include?('id="mm-search-head"')
issues << 'board-link.js 依赖的 #mm-panel 不见了（题目旁边的小按钮会失效）' unless graph.include?('id="mm-panel"')

# ---------- 4. 浮层内容 ----------
books = graph.scan(/data-book="/).size
issues << "册浮层应有 7 项（总览 + 六册），实际 #{books}" unless books == 7
folds = graph.scan(/data-fold="/).size
issues << "层级浮层应有 3 档，实际 #{folds}" unless folds == 3
%w[mm-help__title mm-help__list mm-help__legend mm-help__note].each do |cls|
  issues << "说明浮层缺 #{cls}（介绍与提示应能收进工具条）" unless graph.include?(cls)
end

# ---------- 5. mindmap.js 的接线 ----------
{
  '册浮层选项监听' => "qsa('#mm-book-menu [data-book]')",
  '层级浮层选项监听' => "qsa('#mm-level-menu [data-fold]')",
  '状态同步 syncScope' => 'function syncScope()',
  '默认年级 initialScope' => 'function initialScope()',
  '登录态判定 signedIn' => 'function signedIn()',
  '面板拖动 bindDrag' => 'function bindDrag(card, handle)',
  '自查接口 window.__MM__' => 'window.__MM__',
  '记住上次看的册' => "SCOPE_KEY = 'wkmath.graph.scope'"
}.each do |label, needle|
  issues << "mindmap.js 缺#{label}" unless mini.include?(needle)
end
%w[mm-frame mm-full .mm-fold__btn .segmented__item mm-panel__empty].each do |stale|
  issues << "mindmap.js 还引用已删除的 #{stale}" if mini.include?(stale)
end

# ---------- 6. 会话（登录后按学生年级） ----------
{
  '本机会话键' => "SESSION_KEY = 'wkmath.user'",
  '登录写入' => 'function signIn(',
  '退出清除' => 'function signOut(',
  '对外接口 window.WK_SHELL' => 'window.WK_SHELL'
}.each do |label, needle|
  issues << "ide-shell.js 缺#{label}" unless shell.include?(needle)
end
issues << 'mindmap.js 没有从会话里取年级' unless mini.include?('window.WK_SHELL')

# ---------- 7. 与白板的样式同源：逐条比对规则正文 ----------
def rule_body(css, selector)
  # 取第一次出现的该选择器规则（选择器要整体匹配，避免 __head 之类串到父类）
  pattern = /(?:^|\})\s*#{Regexp.escape(selector)}\s*\{([^{}]*)\}/m
  m = css.match(pattern)
  m && m[1].gsub(/\s+/, ' ').strip
end

pairs = [
  ['.wb-dock', '.mm-dock'],
  ['.wb-dock__btn', '.mm-dock__btn'],
  ['.wb-dock__btn svg', '.mm-dock__btn svg'],
  ['.wb-dock__sep', '.mm-dock__sep'],
  ['.wb-dock__level', '.mm-dock__level'],
  ['.wb-dock__group', '.mm-dock__group'],
  ['.wb-flyout', '.mm-flyout'],
  ['.wb-flyout__item', '.mm-flyout__item'],
  ['.wb-flyout__item kbd', '.mm-flyout__item kbd'],
  ['.wb-bank', '.mm-card'],
  ['.wb-bank__head', '.mm-card__head'],
  ['.wb-bank__grip', '.mm-card__grip'],
  ['.wb-bank__close', '.mm-card__close']
]

compared = 0
pairs.each do |wb_sel, mm_sel|
  a = rule_body(wb, wb_sel)
  b = rule_body(graph, mm_sel)
  if a.nil?
    issues << "白板里找不到 #{wb_sel}（无法比对）"
  elsif b.nil?
    issues << "图谱里找不到 #{mm_sel}（工具条样式缺失）"
  else
    compared += 1
    issues << "#{mm_sel} 与白板不一致：\n    板 #{a}\n    图 #{b}" unless a == b
  end
end

# 悬浮提示的气泡：同样要一致
tip_a = wb[/\[data-wb-tip\]::after\{([^}]*)\}/m, 1].to_s.gsub(/\s+/, ' ').strip
tip_b = graph[/\[data-mm-tip\]::after\{([^}]*)\}/m, 1].to_s.gsub(/\s+/, ' ').strip
issues << '悬浮提示气泡与白板不一致' unless tip_a == tip_b && !tip_a.empty?
compared += 1

puts "图谱页体检：#{issues.empty? ? '通过' : '发现问题'}"
puts "  与白板逐条比对的样式：#{compared} 条"
unless issues.empty?
  puts
  issues.each { |i| puts "  ✗ #{i}" }
  exit 1
end
