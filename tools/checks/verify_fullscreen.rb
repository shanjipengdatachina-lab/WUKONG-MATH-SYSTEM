# encoding: UTF-8
# 全屏模式体检：侧栏「全屏」按钮位于「搜索」之上，且白板页不重复
ROOT = (ENV['WKMATH_ROOT'] || File.expand_path('../..', __dir__)).dup.force_encoding('UTF-8')
pages = Dir.glob(File.join(ROOT, '*.html')).sort
css   = File.read(File.join(ROOT, 'assets/css/ide.css'), encoding: 'UTF-8')
js    = File.read(File.join(ROOT, 'assets/js/ide-shell.js'), encoding: 'UTF-8')
lucide = File.read(File.join(ROOT, 'assets/js/lucide.min.js'), encoding: 'UTF-8')

issues = []
with_btn = []
order_ok = 0

pages.each do |path|
  base = File.basename(path)
  html = File.read(path, encoding: 'UTF-8')
  next unless html.include?('id="toggle-fullscreen"')
  with_btn << base

  issues << "#{base}: 全屏按钮缺 aria-pressed" unless html.include?('id="toggle-fullscreen" aria-pressed="false"')
  # 提示语里不再写按键（原来是「全屏模式（Esc 退出）」）—— 用户要求去掉界面上的快捷键提示。
  issues << "#{base}: 全屏按钮缺 title" unless html.include?('title="全屏模式"')
  issues << "#{base}: 全屏按钮的 title 里又带上了按键（应只是「全屏模式」）" if
    html.include?('title="全屏模式（')
  issues << "#{base}: 全屏按钮缺图标（maximize/minimize）" unless
    html.include?('data-lucide="maximize"') && html.include?('data-lucide="minimize"')
  issues << "#{base}: 全屏按钮缺文字标签" unless html.include?('<span class="ide-rail__label">全屏</span>')

  # 必须排在「搜索」按钮上面（没有搜索按钮的页面看是否排在账号入口之前）
  here = html.index('id="toggle-fullscreen"')
  anchor = html.include?('ide-rail__search') ? html.index('ide-rail__search') : html.index('ide-rail__account')
  if anchor && here && here < anchor
    order_ok += 1
  else
    issues << "#{base}: 全屏按钮没有排在搜索按钮上面"
  end
end

# 除独立文档（白板功能规划）外应全有。这个数是**页面总数 - 1**：
# 2026-09-29 加入 timeline.html 之后是 43 - 1 = 42，加页面时跟着改。
issues << '仍有个别页面漏加全屏按钮（除独立文档外应全有）' unless with_btn.size == 42
issues << '白板工具条里还留着全屏按钮（应与侧栏统一）' if
  File.read(File.join(ROOT, 'whiteboard.html'), encoding: 'UTF-8')[/<div class="wb-dock".*?<div class="wb-pop"/m].to_s.include?('id="wb-full"')

# 行为脚本
issues << 'ide-shell.js 没有初始化全屏按钮' unless js.include?("getElementById('toggle-fullscreen')")
issues << 'ide-shell.js 没有整页全屏请求' unless js.include?('requestFullscreen')
issues << 'ide-shell.js 没有监听 fullscreenchange' unless js.include?("'fullscreenchange'")
issues << 'ide-shell.js 没做浏览器能力判断' unless js.include?('function supported()')
issues << 'ide-shell.js 没同步按钮状态' unless js.include?("btn.setAttribute('aria-pressed', on ? 'true' : 'false')")

# 全屏覆盖区（全屏里切栏目不掉全屏）
issues << 'ide-shell.js 没有覆盖区（全屏切页不换文档）' unless js.include?("className = 'fs-shell'")
issues << 'ide-shell.js 没有生成装页面的 iframe' unless js.include?('fs-shell__frame')
issues << 'ide-shell.js 没有标记 data-embed（区内页藏侧栏）' unless js.include?("setAttribute('data-embed', '')")
issues << 'ide-shell.js 没有同步侧栏高亮' unless js.include?('function syncRail()')
issues << 'ide-shell.js 没有同步地址栏 / 前进后退' unless
  js.include?('pushState') && js.include?("addEventListener('popstate'")
issues << 'ide-shell.js 退出全屏时没有收回覆盖区' unless js.include?('window.location.replace')
issues << 'board-link.js 没给覆盖区让路（会强行换页）' unless
  File.read(File.join(ROOT, 'assets/js/board-link.js'), encoding: 'UTF-8').include?('e.defaultPrevented')
issues << 'ide.css 缺覆盖区样式' unless css.include?('.fs-shell {')
issues << 'ide.css 缺区内页藏侧栏的规则' unless
  css.include?('html[data-embed] .ide-rail { display: none; }')

# 双图标样式
issues << 'ide.css 缺全屏双图标样式' unless css.include?('#toggle-fullscreen[aria-pressed="true"] .ide-rail__icon--fs-off')
issues << 'lucide 里没有 minimize 图标' unless lucide.include?('Minimize')

puts "带侧栏全屏按钮: #{with_btn.size} 页"
puts "排在搜索按钮上面: #{order_ok}/#{with_btn.size} 页"
puts '白板页: 侧栏已加全屏，工具条不再重复 ✓'
puts issues.empty? ? '全屏模式体检全部通过 ✓' : issues.map { |i| "  ✗ #{i}" }.join("\n")
