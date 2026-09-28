# encoding: UTF-8
# 拼装白板两套自检脚本：wb-check.js（白板本体）、bl-check.js（跨页小按钮注入）
#   ruby tools/checks/build_wb_harness.rb
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

build([here('wb-harness-head.js'), src('whiteboard-problems.js'), src('whiteboard.js'),
       here('wb-harness-tail.js')], 'wb-check.js')

build([here('wb-harness-head.js'), src('board-link.js'), here('bl-harness-tail.js')],
      'bl-check.js')
