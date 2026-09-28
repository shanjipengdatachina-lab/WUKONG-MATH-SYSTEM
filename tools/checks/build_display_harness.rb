# encoding: UTF-8
# 拼装「阅读与显示设置」的自检脚本（display.js）
#   ruby tools/checks/build_display_harness.rb
DIR  = __dir__
OUT  = File.join(__dir__, '_build')
ROOT = (ENV['WKMATH_ROOT'] || File.expand_path('../..', __dir__)).dup.force_encoding('UTF-8')
Dir.mkdir(OUT) unless Dir.exist?(OUT)

parts = [
  File.join(DIR, 'dd-harness-head.js'),
  File.join(ROOT, 'assets/js/display.js'),
  File.join(DIR, 'dd-harness-tail.js')
]
out = parts.map { |p| File.read(p, encoding: 'UTF-8') }.join("\n\n")
File.write(File.join(OUT, 'dd-check.js'), out, encoding: 'UTF-8')
puts "dd-check.js: #{out.length} 字符"
