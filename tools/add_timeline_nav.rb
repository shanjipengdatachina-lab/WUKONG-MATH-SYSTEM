# encoding: UTF-8
# ==========================================================================
# 外壳第三批：左栏加入「时间轴」入口
#   · 「时间轴」排在「图谱」后面 —— 两个都是"把知识铺开看"的全景视图，
#     挨着放，从图谱切到时间轴不用越过其它栏目
#   · 图标用 git-commit-horizontal：一条横线 + 中间一个点，正是数轴的样子
#   · 只动 <nav class="ide-rail"> 里那一组，其余一个字不碰
# 可重复执行：已经带了 data-nav-key="timeline" 的页面会跳过
# ==========================================================================

ROOT = '/Users/liyuanyuan/Desktop/WKMATH'
DRY = ENV['DRY'] == '1'
ONLY = (ENV['ONLY'] || '').split(',')

# 用 <<- 而不是 <<~：侧栏每一条都缩进 8 格，波浪号会把这段公共缩进吃掉，
# 插进去的那一条就会比旁边的一排"贴左"，一眼看出来是后加的。
LINE = <<-HTML
        <a class="ide-rail__item" href="timeline.html" data-nav-key="timeline"%s title="时间轴">
          <i data-lucide="git-commit-horizontal" class="ide-rail__icon"></i>
          <span class="ide-rail__label">时间轴</span>
        </a>
HTML

# 「图谱」那一项的整块；新的那一项插在它后面
GRAPH_ITEM = %r{(^[ \t]*<a class="ide-rail__item" href="graph\.html".*?</a>\n)}m

changed = []
skipped = []

Dir.glob(File.join(ROOT, '*.html')).sort.each do |path|
  name = File.basename(path)
  next unless ONLY.empty? || ONLY.include?(name)

  html = File.read(path, encoding: 'UTF-8')

  if html.include?('data-nav-key="timeline"')
    skipped << name
    next
  end

  # 没有侧栏的独立文档（白板功能规划）不在这次改造范围内
  unless html =~ GRAPH_ITEM
    skipped << "#{name}（没有侧栏里的「图谱」项）"
    next
  end

  active = name == 'timeline.html' ? ' data-active="true" aria-current="page"' : ''
  item = format(LINE, active).rstrip
  html = html.sub(GRAPH_ITEM) { "#{Regexp.last_match(1)}#{item}\n" }

  if DRY
    puts "===== #{name} ====="
    puts item
    puts
    next
  end

  File.write(path, html, encoding: 'UTF-8')
  changed << name
end

unless DRY
  puts "左栏加入「时间轴」：改了 #{changed.length} 个页面"
  puts "  跳过 #{skipped.length} 个：#{skipped.join('、')}" unless skipped.empty?
end
