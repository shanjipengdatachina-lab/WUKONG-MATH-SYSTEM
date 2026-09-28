# encoding: UTF-8
# 去掉侧栏主导航里的「错题本」
# 理由：错题本属于登录后的个人功能，个人中心的「学习中心」侧栏里已有入口
# 可重复执行：已去掉的页面跳过

ROOT = '/Users/liyuanyuan/Desktop/WKMATH'
RAIL = %r{<nav class="ide-rail".*?</nav>}m
ITEM = %r{\n\s*<a class="ide-rail__item" href="mistakes\.html".*?</a>}m

changed = []
already = []
Dir.glob(File.join(ROOT, '*.html')).sort.each do |path|
  name = File.basename(path)
  html = File.read(path, encoding: 'UTF-8')
  next unless html.include?('class="ide-rail"')
  rail = html[RAIL].to_s
  unless rail.include?('mistakes.html')
    already << name
    next
  end
  html = html.sub(RAIL) { |m| m.sub(ITEM, '') }
  File.write(path, html)
  changed << name
end

puts "去掉侧栏「错题本」：#{changed.size} 页；本来就没有：#{already.size} 页"

# 移除后错题本仍要进得去
still = Dir.glob(File.join(ROOT, '*.html')).select do |p|
  File.read(p, encoding: 'UTF-8').include?('href="mistakes.html"')
end.sort.map { |p| File.basename(p) }
puts "仍能进入错题本的页面（#{still.size} 页）：#{still.join('、')}"
