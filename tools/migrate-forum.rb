# encoding: UTF-8
# 论坛功能接入：forum.html（专题筛选 + 帖子列表 + 内嵌发帖）与 forum-thread.html（数据驱动详情）
# 可重复执行：已经改过的位置会跳过

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

def append_style(text, css, label)
  return false if text.include?(css.split("\n").first)
  marker = "  </style>"
  idx = text.index(marker) || text.index("</style>")
  raise "#{label}: 找不到 </style>" unless idx
  text.insert(idx, css)
  $changed << label
  true
end

def add_script(text, label)
  anchor = %(    <script src="assets/js/pages.js"></script>)
  raise "#{label}: 找不到 pages.js 锚点" unless text.include?(anchor)
  return false if text.include?('assets/js/forum.js')
  text.sub!(anchor, anchor + "\n    <script src=\"assets/js/forum.js\"></script>")
  $changed << label
  true
end

# ============================ forum.html ============================
h = read('forum.html')

swap!(h,
  %(            <a class="forum-tab" href="#" data-active="true" data-dom-id="forum-tab-latest">最新</a>),
  %(            <a class="forum-tab" href="#" data-active="true" data-tab="latest" data-dom-id="forum-tab-latest">最新</a>),
  '首页·最新标签')

swap!(h,
  %(            <a class="forum-tab" href="#" data-dom-id="forum-tab-hot">热门</a>),
  %(            <a class="forum-tab" href="#" data-tab="hot" data-dom-id="forum-tab-hot">热门</a>),
  '首页·热门标签')

swap!(h,
  %(            <a class="btn btn--primary btn--sm" href="forum-compose.html" data-dom-id="forum-compose"><i data-lucide="square-pen" style="width:14px;height:14px"></i><span>发帖</span></a>),
  %(            <button type="button" class="btn btn--primary btn--sm" id="forum-compose-open" aria-expanded="false" data-dom-id="forum-compose"><i data-lucide="square-pen" style="width:14px;height:14px"></i><span>发帖</span></button>),
  '首页·发帖按钮')

# 专题卡片：改成站内可分享的筛选入口
ids = %w[study help exam]
n = -1
h.gsub!(%r{(<a class="board" href=")board\.html(")}) do
  n += 1
  "#{$1}forum.html?board=#{ids[n]}#{$2} data-board=\"#{ids[n]}\""
end
if n >= 0
  raise '首页·专题卡片：只找到 %d 个' % (n + 1) unless n == 2
  $changed << '首页·专题卡片（3 个）'
end

# 内嵌发帖表单
composer = [
  %(          <section class="compose" id="forum-compose-box" hidden aria-label="发表新帖">),
  %(            <div class="compose__head">),
  %(              <h2 class="compose__title">发表新帖</h2>),
  %(              <button type="button" class="compose__close" id="forum-compose-cancel" aria-label="收起发帖框"><i data-lucide="x" class="compose__close-icon"></i></button>),
  %(            </div>),
  %(            <div class="compose__row">),
  %(              <label class="compose__label" for="compose-title">标题</label>),
  %(              <input class="compose__input" id="compose-title" type="text" maxlength="60" placeholder="一句话说清你想讨论什么">),
  %(            </div>),
  %(            <div class="compose__row">),
  %(              <label class="compose__label" for="compose-board">专题</label>),
  %(              <select class="compose__input" id="compose-board">),
  %(                <option value="study">学习交流</option>),
  %(                <option value="help">解题求助</option>),
  %(                <option value="exam">真题讨论</option>),
  %(              </select>),
  %(            </div>),
  %(            <div class="compose__row">),
  %(              <label class="compose__label" for="compose-body">正文</label>),
  %(              <textarea class="compose__input compose__input--area" id="compose-body" rows="5" placeholder="写清题目或你的思路。公式用 $…$ 包起来，例如 $y = kx + b$；单独一行以「- 」开头会变成列表。"></textarea>),
  %(            </div>),
  %(            <div class="compose__foot">),
  %(              <p class="compose__note">演示版：帖子存在本机浏览器里，刷新不丢。</p>),
  %(              <div class="compose__acts">),
  %(                <a class="compose__more" href="forum-compose.html">用完整编辑器</a>),
  %(                <button type="button" class="btn btn--primary btn--sm" id="compose-submit">发布</button>),
  %(              </div>),
  %(            </div>),
  %(          </section>),
  %()
].join("\n")

anchor = %(      <div class="forum-wrap">\n        <div>\n)
raise '首页·找不到 forum-wrap 锚点' unless h.include?(anchor)
unless h.include?('forum-compose-box')
  h.sub!(anchor, anchor + composer)
  $changed << '首页·内嵌发帖表单'
end

# 列表容器 + 计数
swap!(h, %(<h2 class="sec__title" id="latest-topics">最新主题</h2>),
        %(<h2 class="sec__title" id="forum-sec-title">最新主题</h2>), '首页·列表标题')
swap!(h, %(<span class="sec__note">共 288 个主题</span>),
        %(<span class="sec__note" id="forum-count">共 0 个主题</span>), '首页·主题计数')

if h.include?('<a class="post"')
  first = h.index('<a class="post"')
  tail  = h.index("\n          </section>", first)
  raise '首页·找不到帖子列表结尾' unless tail
  h = h[0...first] + %(            <div id="forum-list"></div>) + h[tail..]
  $changed << '首页·帖子列表改为数据渲染'
end

append_style(h, <<~CSS, '首页·新增样式')
  /* ---------- 论坛：内嵌发帖表单与状态 ---------- */
  .compose{border:1px solid var(--math-border);border-radius:var(--math-radius-md);background:var(--math-surface);padding:16px 18px;margin-bottom:24px}
  .compose[hidden]{display:none}
  .compose__head{display:flex;align-items:center;gap:10px;margin-bottom:4px}
  .compose__title{font-size:15px;font-weight:600;color:var(--math-foreground)}
  .compose__close{margin-left:auto;width:26px;height:26px;display:grid;place-items:center;border:0;border-radius:var(--math-radius-sm);background:transparent;color:var(--math-ink-3);cursor:pointer;transition:background-color 140ms cubic-bezier(.2,.8,.2,1)}
  .compose__close:hover{background:var(--math-background);color:var(--math-foreground)}
  .compose__close-icon{width:14px;height:14px}
  .compose__row{display:grid;grid-template-columns:44px minmax(0,1fr);align-items:start;gap:12px;margin-top:12px}
  .compose__label{font-size:13px;color:var(--math-ink-3);line-height:36px}
  .compose__input{width:100%;height:36px;padding:0 12px;border:1px solid var(--math-border);border-radius:var(--math-radius-sm);background:var(--math-background);color:var(--math-foreground);font-family:var(--math-font-sans);font-size:14px}
  .compose__input--area{height:auto;min-height:112px;padding:10px 12px;line-height:1.8;resize:vertical}
  .compose__input:focus{outline:none;border-color:var(--math-primary);box-shadow:0 0 0 3px var(--math-primary-tint)}
  .compose__foot{display:flex;align-items:center;gap:12px;margin-top:14px;padding-top:12px;border-top:1px solid var(--math-border)}
  .compose__note{font-size:12px;color:var(--math-ink-4)}
  .compose__acts{margin-left:auto;display:flex;align-items:center;gap:12px}
  .compose__more{font-size:12px;color:var(--math-ink-3);text-decoration:none;transition:color 140ms cubic-bezier(.2,.8,.2,1)}
  .compose__more:hover{color:var(--math-primary)}
  .board[data-active="true"]{background:var(--math-primary-tint)}
  .empty{padding:20px 0;border-top:1px solid var(--math-border);font-size:13px;color:var(--math-ink-3)}
CSS

add_script(h, '首页·脚本')
write('forum.html', h)

# ========================= forum-thread.html =========================
t = read('forum-thread.html')

swap!(t, %(          <span>解题求助</span>), %(          <span id="thread-board">解题求助</span>), '详情·面包屑专题')
swap!(t, %(<h1 class="thread__title">一次函数分段讨论怎么入手</h1>),
        %(<h1 class="thread__title" id="thread-title">一次函数分段讨论怎么入手</h1>), '详情·标题')
swap!(t, %(            <span class="thread__tag">解题求助</span>),
        %(            <span class="thread__tag" id="thread-tag">解题求助</span>), '详情·专题标签')
swap!(t, %(            <span class="thread__info"><a class="thread__author" href="user.html" data-dom-id="thread-author">陈知远</a> · <b>12</b> 条回复 · 2 小时前</span>),
        %(            <span class="thread__info" id="thread-meta"><a class="thread__author" href="user.html" data-dom-id="thread-author">陈知远</a> · <b>12</b> 条回复 · 2 小时前</span>), '详情·作者与回复数')
swap!(t, %(            <span class="thread__info">浏览 <b>326</b></span>),
        %(            <span class="thread__info" id="thread-views">浏览 <b>326</b></span>), '详情·浏览数')

if t.include?('<div class="post-body">')
  b0 = t.index('<div class="post-body">')
  close = "\n        </div>"
  b1 = t.index(close, b0)
  raise '详情·找不到正文结尾' unless b1
  t = t[0...b0] + %(<div class="post-body" id="thread-body"></div>) + t[(b1 + close.length)..]
  $changed << '详情·正文改为数据渲染'
end

if t.include?('<section class="floors" aria-label="回复列表">')
  f0 = t.index('<section class="floors" aria-label="回复列表">')
  f1 = t.index('</section>', f0) + '</section>'.length
  t = t[0...f0] + %(<section class="floors" id="thread-floors" aria-label="回复列表"></section>) + t[f1..]
  $changed << '详情·楼层改为数据渲染'
end

swap!(t, %(          <div class="reply__box">回复陈知远的帖子，可以用 ▢ 插入公式。</div>),
        %(          <textarea class="reply__box reply__input" id="reply-text" rows="4" placeholder="回复陈知远的帖子。公式用 $…$ 包起来，例如 $k &gt; 0$"></textarea>),
        '详情·回复框')

swap!(t, %(<button type="button" class="btn btn--primary" data-dom-id="thread-reply">发表回复</button>),
        %(<button type="button" class="btn btn--primary" id="reply-submit" data-dom-id="thread-reply">发表回复</button>),
        '详情·发表回复按钮')

append_style(t, <<~CSS, '详情·新增样式')
  /* ---------- 论坛：可输入的回复框 ---------- */
  .reply__input{display:block;width:100%;background:var(--math-background);color:var(--math-foreground);font-family:var(--math-font-sans);resize:vertical;line-height:1.8}
  .reply__input::placeholder{color:var(--math-ink-4)}
  .reply__input:focus{outline:none;border-color:var(--math-primary);box-shadow:0 0 0 3px var(--math-primary-tint)}
  .post-body ul,.floor__text ul{margin:0 0 16px;padding-left:20px}
  .post-body li,.floor__text li{margin:4px 0}
  .empty{padding:16px 0;font-size:13px;color:var(--math-ink-3)}
CSS

add_script(t, '详情·脚本')
write('forum-thread.html', t)

puts $changed.empty? ? '没有需要改动的位置（已是最新）' : "已改动 #{$changed.size} 处：\n  " + $changed.join("\n  ")
