# encoding: UTF-8
# 侧栏主导航去掉「练习」，只留「真题」
# 说明：真题页（exams.html）本身就是考点速练总览，点其中任一考点行即进入 practice.html，
#       所以练习并没有丢，只是不再占一个主导航位。
# 另外：practice.html / practice-result.html 属于真题这条线，把侧栏「真题」标为当前项。
# 可重复执行：已处理的页面跳过

ROOT = '/Users/liyuanyuan/Desktop/WKMATH'
RAIL = %r{<nav class="ide-rail".*?</nav>}m
ITEM = %r{\n\s*<a class="ide-rail__item" href="practice\.html".*?</a>}m
SUB_PAGES = %w[practice.html practice-result.html]

changed = []
already = []
Dir.glob(File.join(ROOT, '*.html')).sort.each do |path|
  name = File.basename(path)
  html = File.read(path, encoding: 'UTF-8')
  next unless html.include?('class="ide-rail"')
  rail = html[RAIL].to_s
  unless rail.include?('data-nav-key="practice"')
    already << name
    next
  end

  rail = rail.sub(ITEM, '')
  # 练习这条线下的页面：把「真题」标为当前项，避免侧栏一个高亮都没有
  if SUB_PAGES.include?(name) && !rail.include?('data-active="true"')
    rail = rail.sub(/(<a class="ide-rail__item" href="exams\.html"[^>]*?)( title="真题")/) do
      "#{$1} data-active=\"true\" aria-current=\"page\"#{$2}"
    end
  end

  html = html.sub(RAIL, rail)
  File.write(path, html)
  changed << name
end

puts "去掉侧栏「练习」：#{changed.size} 页；本来就没有：#{already.size} 页"
puts "其中把「真题」标为当前项：#{SUB_PAGES.select { |f| changed.include?(f) }.join('、')}"

still = Dir.glob(File.join(ROOT, '*.html')).select do |p|
  File.read(p, encoding: 'UTF-8').include?('href="practice.html"')
end.sort.map { |p| File.basename(p) }
puts "仍能进入练习的页面（#{still.size} 页）：#{still.join('、')}"
