# encoding: UTF-8
# 检查全站内部链接是否指向不存在的文件（失效链接 = 页面被废弃的痕迹）
ROOT = (ENV['WKMATH_ROOT'] || File.expand_path('../..', __dir__)).dup.force_encoding('UTF-8')
existing = Dir.glob(File.join(ROOT, '*.html')).map { |f| File.basename(f) }

broken = Hash.new { |h, k| h[k] = [] }
Dir.glob(File.join(ROOT, '*.html')).sort.each do |path|
  src = File.basename(path)
  html = File.read(path, encoding: 'UTF-8')
  html.scan(/href="([^"#?]+\.html)(?:[#?][^"]*)?"/).flatten.uniq.each do |t|
    broken[t] << src unless existing.include?(t)
  end
end

Dir.glob(File.join(ROOT, 'assets/js/*.js')).sort.each do |path|
  next if path.include?('lucide.min.js')
  js = File.read(path, encoding: 'UTF-8')
  js.scan(/['"]([a-z0-9-]+\.html)['"]/).flatten.uniq.each do |t|
    broken[t] << "assets/js/#{File.basename(path)}" unless existing.include?(t)
  end
end

if broken.empty?
  puts '没有任何失效的内部链接 ✓'
else
  puts '指向不存在页面的链接：'
  broken.each { |target, sources| puts "  #{target}  <- #{sources.uniq.join(', ')}" }
end

# 反向：哪些页面没有任何 <a> 之外的方式进入（仅统计 href；脚本链接也算）
puts
puts "站点文件清单：#{existing.length} 个页面"
