# encoding: UTF-8
# 论坛第二批：board.html（专题页）与 my-posts.html（我的帖子）接同一套数据
# 可重复执行：已改过的位置会跳过

ROOT = '/Users/liyuanyuan/Desktop/WKMATH'
$changed = []

def read(f) File.read(File.join(ROOT, f), encoding: 'UTF-8') end
def write(f, s) File.write(File.join(ROOT, f), s) end

def swap!(text, from, to, label)
  return false unless text.include?(from)
  text.sub!(from, to)
  $changed << label
  true
end

# 把 <section ...> 到它的 </section> 之间清空成 replacement
def cut_section(text, open_tag, replacement, label)
  return text unless text.include?(open_tag)
  a = text.index(open_tag)
  b = text.index('</section>', a) + '</section>'.length
  $changed << label
  text[0...a] + replacement + text[b..]
end

def append_style(text, css, label)
  return text if text.include?(css.split("\n").first)
  idx = text.index('</style>')
  raise "#{label}: 找不到 </style>" unless idx
  $changed << label
  text.dup.insert(idx, css)
end

def add_script(text, label)
  anchor = %(    <script src="assets/js/pages.js"></script>)
  raise "#{label}: 找不到 pages.js 锚点" unless text.include?(anchor)
  return text if text.include?('assets/js/forum.js')
  $changed << label
  text.sub(anchor, anchor + "\n    <script src=\"assets/js/forum.js\"></script>")
end

# ============ forum.html：筛选后给一个进专题页的入口 ============
h = read('forum.html')
if h.include?('id="forum-count"') && !h.include?('forum-board-link')
  swap!(h, %(              <span class="sec__note" id="forum-count">共 0 个主题</span>),
          %(              <span class="sec__note" id="forum-count">共 0 个主题</span>\n              <a class="sec__link" id="forum-board-link" href="board.html" hidden>进入专题页</a>),
          '首页·进专题页入口')
end
h = append_style(h, <<~CSS, '首页·入口样式')
  .sec__link{font-size:12px;color:var(--math-primary);text-decoration:none;white-space:nowrap;transition:color 140ms cubic-bezier(.2,.8,.2,1)}
  .sec__link:hover{text-decoration:underline}
  .sec__link[hidden]{display:none}
CSS
write('forum.html', h)

# ============ board.html：专题页 ============
b = read('board.html')

swap!(b, %(            <a class="forum-tab" href="#" data-active="true">最新</a>),
        %(            <a class="forum-tab" href="forum.html">最新</a>), '专题页·导航最新')
swap!(b, %(            <a class="forum-tab" href="#">热门</a>),
        %(            <a class="forum-tab" href="forum.html?tab=hot">热门</a>), '专题页·导航热门')
swap!(b, %(<a class="btn btn--primary btn--sm" href="forum-compose.html" data-dom-id="board-compose">),
        %(<a class="btn btn--primary btn--sm" href="forum.html?compose=1" data-dom-id="board-compose">),
        '专题页·发帖入口')
swap!(b, %(          <span>解题求助</span>), %(          <span id="board-crumb-name">解题求助</span>), '专题页·面包屑')
swap!(b, %(<h1 class="bhead__title">解题求助</h1>), %(<h1 class="bhead__title" id="board-title">解题求助</h1>), '专题页·标题')
swap!(b, %(<p class="bhead__desc">卡住的题，发出来一起看。请写清已知条件与已经尝试的步骤。</p>),
        %(<p class="bhead__desc" id="board-desc">卡住的题，发出来一起看。请写清已知条件与已经尝试的步骤。</p>),
        '专题页·说明')
swap!(b, %(<p class="bhead__stats">96 主题 · 1248 条回复</p>),
        %(<p class="bhead__stats" id="board-stats">0 主题 · 0 条回复</p>), '专题页·统计')
swap!(b, %(          <a class="sort" href="#" data-active="true">最新回复</a>\n          <a class="sort" href="#">最新发布</a>\n          <a class="sort" href="#">回复最多</a>),
        %(          <a class="sort" href="#" data-sort="reply" data-active="true">最新回复</a>\n          <a class="sort" href="#" data-sort="post">最新发布</a>\n          <a class="sort" href="#" data-sort="replies">回复最多</a>),
        '专题页·排序方式')
b = cut_section(b, %(<section class="tlist" aria-label="主题列表">),
                %(<section class="tlist" id="board-list" aria-label="主题列表"></section>),
                '专题页·列表改为数据渲染')
b = append_style(b, <<~CSS, '专题页·新增样式')
  .empty{padding:20px 0;border-top:1px solid var(--math-border);font-size:13px;color:var(--math-ink-3)}
CSS
b = add_script(b, '专题页·脚本')
write('board.html', b)

# ============ my-posts.html：我的帖子 ============
m = read('my-posts.html')

swap!(m, %(<p class="page-head__desc">共 <b class="num">3</b> 篇帖子与 <b class="num">12</b> 条回复。</p>),
        %(<p class="page-head__desc" id="mine-desc">共 <b class="num">0</b> 篇帖子与 <b class="num">0</b> 条回复。</p>),
        '我的帖子·统计')
swap!(m, %(            <a class="tab" href="#" data-active="true">我的帖子<span class="tab__count">3</span></a>\n            <a class="tab" href="#">我的回复<span class="tab__count">12</span></a>),
        %(            <a class="tab" href="#" id="mine-tab-posts" data-active="true">我的帖子<span class="tab__count" id="mine-count-posts">0</span></a>\n            <a class="tab" href="#" id="mine-tab-replies">我的回复<span class="tab__count" id="mine-count-replies">0</span></a>),
        '我的帖子·标签')
swap!(m, %(<a class="btn btn--primary btn--sm" href="forum-compose.html" data-dom-id="mypost-compose">),
        %(<a class="btn btn--primary btn--sm" href="forum.html?compose=1" data-dom-id="mypost-compose">),
        '我的帖子·发帖入口')
m = cut_section(m, %(<section class="panel" aria-label="我的帖子">),
                %(<section class="panel" id="mine-posts" aria-label="我的帖子"></section>),
                '我的帖子·列表改为数据渲染')
m = cut_section(m, %(<section class="panel panel--stack" aria-label="我的回复">),
                %(<section class="panel panel--stack" id="mine-replies" aria-label="我的回复"></section>),
                '我的回复·列表改为数据渲染')
m = append_style(m, <<~CSS, '我的帖子·新增样式')
  .empty{padding:20px 0;font-size:13px;color:var(--math-ink-3)}
  .panel[hidden],.tlist[hidden]{display:none}
CSS
m = add_script(m, '我的帖子·脚本')
write('my-posts.html', m)

puts $changed.empty? ? '没有需要改动的位置（已是最新）' : "已改动 #{$changed.size} 处：\n  " + $changed.join("\n  ")
