# encoding: UTF-8
# ==========================================================================
# 撤回左栏的「时间轴」入口（add_timeline_nav.rb 的反向动作）
#
# 为什么要单独一个脚本来撤：
#   这次改造是**纯增量**的（只往侧栏里插一段，不动别的），而 §5.1 第 1 步要求的
#   "改造前备份"这一次没做 —— 所以回退的路就落在这个脚本上：它把插入的那一段
#   按同样的边界整块摘掉，跑完页面回到加之前的样子。
#
# 可重复执行：已经摘干净的页面会跳过。
# ==========================================================================

ROOT = '/Users/liyuanyuan/Desktop/WKMATH'
DRY = ENV['DRY'] == '1'
ONLY = (ENV['ONLY'] || '').split(',')

# 「时间轴」那一项的整块（含尾随换行）；带不带 data-active 都能摘（用 [^>]* 吞掉中间那段）
ITEM = %r{^[ \t]*<a class="ide-rail__item" href="timeline\.html" data-nav-key="timeline"[^>]*>\n(?:.*?\n)*?[ \t]*</a>\n}m

changed = []
skipped = []

Dir.glob(File.join(ROOT, '*.html')).sort.each do |path|
  name = File.basename(path)
  next unless ONLY.empty? || ONLY.include?(name)

  html = File.read(path, encoding: 'UTF-8')

  unless html.include?('data-nav-key="timeline"')
    skipped << name
    next
  end

  before = html.length
  html = html.sub(ITEM, '')
  if html.length == before
    puts "  ! #{name}: 找到了「时间轴」入口，但没匹配上整块 —— 没动它，请手工看一眼"
    next
  end

  if DRY
    puts "===== #{name} ====="
    puts '（摘掉一段）'
    next
  end

  File.write(path, html, encoding: 'UTF-8')
  changed << name
end

unless DRY
  puts "撤回左栏的「时间轴」：改了 #{changed.length} 个页面"
  puts "  跳过 #{skipped.length} 个（本来就没有这一段）" unless skipped.empty?
end
