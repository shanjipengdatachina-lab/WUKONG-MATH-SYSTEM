# encoding: UTF-8
# 章节页体检：目录默认展开 + 章节目录默认全开 + 点章节不把它点关
ROOT = (ENV['WKMATH_ROOT'] || File.expand_path('../..', __dir__)).dup.force_encoding('UTF-8')
html = File.read(File.join(ROOT, 'reader.html'), encoding: 'UTF-8')
js   = File.read(File.join(ROOT, 'assets/js/pages.js'), encoding: 'UTF-8')
shell = File.read(File.join(ROOT, 'assets/js/ide-shell.js'), encoding: 'UTF-8')

issues = []

# 1) 左栏默认展开
issues << '章节页没有声明「左栏默认展开」' unless html.include?('class="reader-shell" data-left-default="open"')
issues << 'ide-shell.js 没有读取 data-left-default' unless shell.include?("getAttribute('data-left-default') === 'open'")
issues << 'ide-shell.js 没有按声明跳过上次的收起状态' unless shell.include?("if (!leftAlwaysOpen && readStore(STORE_LEFT) === 'hidden')")

# 2) 六册章列表默认展开
lists = html.scan(/<ul class="chapter-list"( data-subtree="([a-z]+)")?>/)
expanded = lists.count { |m| m[1] == 'expanded' }
issues << "册章列表默认展开数异常：#{expanded}/#{lists.size}" unless lists.size == 6 && expanded == 6
issues << '仍有整册章列表处于收起态' if html.include?('<ul class="chapter-list" data-subtree="collapsed">')
issues << '册标题箭头仍是收起态（chevron-right）' if html.scan(/chevron-right" class="volume-head__icon"/).any?

# 3) 当前章的节列表保持展开；其余章没有自带子列表
issues << '当前章的节列表没展开' unless html.include?('<ul class="section-list" data-subtree="expanded">')
issues << '当前章没有 default-active 标记' unless html.include?('data-chapter="01" data-active="true"')

# 4) 点章节 = 展开（不再用普通 toggle 把当前章点关）
issues << 'pages.js 仍用 bindToggle 处理章节行（会把刚点的章点关）' if
  js.include?("bindToggle(row, li ? qs('ul[data-subtree]', li) : null, null, null)")
issues << 'pages.js 缺少「点章节即展开」逻辑' unless js.include?('applyChapter(row, sub, true)')
issues << 'pages.js 缺少同册只留一章展开的收拢逻辑' unless js.include?('applyChapter(other, otherSub, false)')
issues << 'pages.js 缺少章节行 aria-expanded 同步' unless js.include?("row.setAttribute('aria-expanded', String(expanded))")

# 5) 册的展开收起（bindToggle）仍在
issues << '册的展开收起被误删' unless js.include?('qsa(\'.tree-volume\', tree)')

puts "章节树: 册章列表 #{lists.size} 个（展开 #{expanded} 个）"
puts "章行: #{html.scan(/class="ch-row"/).length} 个；节行: #{html.scan(/class="sec-row"/).length} 个"
puts issues.empty? ? '章节页体检全部通过 ✓' : issues.map { |i| "  ✗ #{i}" }.join("\n")
