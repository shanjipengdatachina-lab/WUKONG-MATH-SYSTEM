# encoding: UTF-8
# 拼装外壳/章节树/全屏/论坛系列自检脚本
#   ruby tools/checks/build_harness.rb
# 输出到 tools/checks/_build/，随后用 osascript -l JavaScript 跑
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

build([here('harness-head.js'), src('math-tree.js'), src('reader-live.js'), here('harness-tail.js')],
      'reader-live-check.js')

build([here('harness-head.js'), src('ide-shell.js'), here('harness-ide-tail.js')],
      'ide-shell-check.js')

# 左栏默认展开：同一份断言跑「章节页」与「普通页」两种场景
build([here('prelude-reader-open.js'), here('harness-head.js'), src('ide-shell.js'),
       here('harness-ide-default-tail.js')], 'ide-reader-open-check.js')

build([here('prelude-plain-hidden.js'), here('harness-head.js'), src('ide-shell.js'),
       here('harness-ide-default-tail.js')], 'ide-plain-hidden-check.js')

# 章节树：pages.js 的册 / 章展开收起
build([here('pages-harness-head.js'), src('pages.js'), here('pages-harness-tail.js')],
      'pages-tree-check.js')

# 侧栏「全屏」按钮
build([here('harness-head.js'), src('ide-shell.js'), here('harness-ide-fullscreen-tail.js')],
      'ide-fullscreen-check.js')

# 侧栏「当前页入口不再重载」（重载会掉全屏）
build([here('harness-head.js'), src('ide-shell.js'), here('harness-ide-selflink-tail.js')],
      'ide-selflink-check.js')

# 全屏覆盖区：全屏里切栏目不掉全屏（普通页 / 覆盖区里的页面两种身份）
build([here('harness-head.js'), src('ide-shell.js'), here('harness-fs-shell-tail.js')],
      'ide-fs-shell-check.js')

build([here('prelude-embed.js'), here('harness-head.js'), src('ide-shell.js'),
       here('harness-fs-shell-tail.js')], 'ide-fs-embed-check.js')

# 侧栏「用鼠标点完就收回去」
build([here('harness-head.js'), src('ide-shell.js'), here('harness-ide-railblur-tail.js')],
      'ide-railblur-check.js')

# 论坛：首页 / 详情 / 没带 id / 讨论板 / 我的帖子 五种场景
build([here('prelude-forum-home.js'), here('forum-harness-head.js'), src('forum.js'),
       here('forum-harness-tail.js')], 'forum-home-check.js')

build([here('prelude-forum-thread.js'), here('forum-harness-head.js'), src('forum.js'),
       here('forum-harness-tail.js')], 'forum-thread-check.js')

build([here('prelude-forum-fallback.js'), here('forum-harness-head.js'), src('forum.js'),
       here('forum-harness-tail.js')], 'forum-fallback-check.js')

build([here('prelude-forum-board.js'), here('forum-harness-head.js'), src('forum.js'),
       here('forum-harness-tail.js')], 'forum-board-check.js')

build([here('prelude-forum-mine.js'), here('forum-harness-head.js'), src('forum.js'),
       here('forum-harness-tail.js')], 'forum-mine-check.js')
