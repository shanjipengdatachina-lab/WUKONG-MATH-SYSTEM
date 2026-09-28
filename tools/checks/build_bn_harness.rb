# encoding: UTF-8
# 拼装论坛首页轮播的自检脚本
#   ruby tools/checks/build_bn_harness.rb
DIR  = __dir__
OUT  = File.join(__dir__, '_build')
ROOT = (ENV['WKMATH_ROOT'] || File.expand_path('../..', __dir__)).dup.force_encoding('UTF-8')
Dir.mkdir(OUT) unless Dir.exist?(OUT)

def build(parts, name)
  out = parts.map { |p| File.read(p, encoding: 'UTF-8') }.join("\n\n")
  File.write(File.join(OUT, name), out, encoding: 'UTF-8')
  puts "#{name}: #{out.length} 字符"
end

def here(n)
  File.join(DIR, n)
end

def src(n)
  File.join(ROOT, 'assets/js', n)
end

# 内容文件在前、组件在后 —— 组件在加载末尾会读 window.WK_BANNERS 自动挂载，
# 顺序反了就会挂到一个空列表上，而这个错误在浏览器里也能同样复现。
build([here('bn-harness-head.js'), src('forum-banners.js'), src('banner-carousel.js'),
       here('bn-harness-tail.js')], 'bn-check.js')
