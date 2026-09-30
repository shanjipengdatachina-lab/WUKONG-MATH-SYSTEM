# encoding: UTF-8
# 拼装时间轴自检脚本：tl-check.js
#   ruby tools/checks/build_tl_harness.rb
# 顺序要紧：图谱数据（MATH_TREE）与学习记录（WK_LEARNING）都在 timeline.js **加载时**就要读，
# 所以它们必须排在前面；timeline.js 自己是个 IIFE，加载完就把 window.WK_TIMELINE 挂出来。
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

build([here('tl-harness-head.js'), src('math-tree.js'), src('timeline-data.js'),
       src('timeline.js'), here('tl-harness-tail.js')], 'tl-check.js')
