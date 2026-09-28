# encoding: UTF-8
# 全站侧栏加「论坛」入口；论坛各页把它标为当前项
# 可重复执行：已有则该页跳过

ROOT = '/Users/liyuanyuan/Desktop/WKMATH'
FORUM_PAGES = %w[forum.html forum-thread.html board.html my-posts.html forum-compose.html]
ANCHOR = %(          <span class="ide-rail__label">错题本</span>\n        </a>)

def item(active)
  [
    %(        <a class="ide-rail__item" href="forum.html" data-nav-key="forum"#{active ? ' data-active="true" aria-current="page"' : ''} title="论坛">),
    %(          <i data-lucide="messages-square" class="ide-rail__icon"></i>),
    %(          <span class="ide-rail__label">论坛</span>),
    %(        </a>)
  ].join("\n")
end

changed = []
already = []
Dir.glob(File.join(ROOT, '*.html')).sort.each do |path|
  name = File.basename(path)
  html = File.read(path, encoding: 'UTF-8')
  next unless html.include?('class="ide-rail"')

  if html.include?('data-nav-key="forum"')
    already << name
    next
  end

  rail = html[%r{<nav class="ide-rail".*?</nav>}m].to_s
  raise "#{name}: 侧栏里找不到错题本锚点" unless rail.include?(ANCHOR)

  # 论坛各页：先摘掉别的当前项，再把「论坛」设成当前项
  if FORUM_PAGES.include?(name)
    rail = rail.gsub(/ data-active="true" aria-current="page"(?=[^>]*title="(?!论坛"))/m, '')
  end
  rail = rail.sub(ANCHOR, ANCHOR + "\n" + item(FORUM_PAGES.include?(name)))
  html = html.sub(%r{<nav class="ide-rail".*?</nav>}m, rail)
  File.write(path, html)
  changed << name
end

puts "加了「论坛」入口：#{changed.size} 页" +
     (already.empty? ? '' : "；已有该入口：#{already.size} 页")
puts "  其中标为当前项：#{FORUM_PAGES.select { |f| changed.include?(f) }.join('、')}"
