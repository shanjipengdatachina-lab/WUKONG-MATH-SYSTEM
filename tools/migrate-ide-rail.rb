# encoding: UTF-8
# ==========================================================================
# 外壳第二版：撤掉顶部栏，全部收进左侧栏
#   · 删除 <header class="ide-bar">
#   · 重建 <nav class="ide-rail">：顶部 logo+标题，中部导航，底部 搜索/通知/账号/设置
#   · 顶栏里的通知铃铛、用户头像原样迁到左下角，避免入口丢失
#   · 去掉 body 的 56px 顶栏留白，三栏页面的 sticky 偏移同步归零
# 可重复执行：已升级的页面（data-shell="2"）会跳过
# ==========================================================================

ROOT = '/Users/liyuanyuan/Desktop/WKMATH'
DRY = ENV['DRY'] == '1'
ONLY = (ENV['ONLY'] || '').split(',')

RAIL = [
  ['home',     'home.html',     '首页',   'house'],
  ['reader',   'reader.html',   '章节',   'book-open'],
  ['graph',    'graph.html',    '图谱',   'git-fork'],
  ['practice', 'practice.html', '练习',   'pencil-line'],
  ['exams',    'exams.html',    '真题',   'clipboard-list'],
  ['methods',  'methods.html',  '方法',   'lightbulb'],
  ['mistakes', 'mistakes.html', '错题本', 'bookmark']
]

PAGE_KEY = {
  'home.html' => 'home',
  'reader.html' => 'reader', 'chapter.html' => 'reader',
  'concept.html' => 'reader', 'concept-3d.html' => 'reader',
  'graph.html' => 'graph',
  'practice.html' => 'practice', 'practice-result.html' => 'practice',
  'exams.html' => 'exams',
  'methods.html' => 'methods', 'formulas.html' => 'methods',
  'mistakes.html' => 'mistakes', 'mistake-detail.html' => 'mistakes'
}.freeze

def build_rail(html)
  search = html.include?('class="shell-search"')
  bell_href = html[/<a class="shell-icon-btn" href="([^"]+)"/, 1]
  bell_dot = html.include?('shell-icon-btn__dot')
  avatar_href = html[/<a class="shell-avatar" href="([^"]+)"/, 1]
  avatar_mark = html[/<span class="shell-avatar__mark">([^<]*)</, 1].to_s.strip
  avatar_name = html[/<span class="shell-avatar__name">([^<]*)</, 1].to_s.strip
  has_panels = html.include?('class="reader-shell"')
  key = html[/data-nav-key="(\w+)"[^>]*data-active="true"/, 1] ||
        html[/<a class="ide-rail__item" href="([^"]+)"[^>]*data-active="true"/, 1]
  [search, bell_href, bell_dot, avatar_href, avatar_mark, avatar_name, has_panels, key]
end

def nav_items(active_key_or_href)
  RAIL.map do |k, href, name, icon|
    active = (k == active_key_or_href || href == active_key_or_href)
    attrs = active ? ' data-active="true" aria-current="page"' : ''
    %(        <a class="ide-rail__item" href="#{href}" data-nav-key="#{k}"#{attrs} title="#{name}">) +
      %(\n          <i data-lucide="#{icon}" class="ide-rail__icon"></i>) +
      %(\n          <span class="ide-rail__label">#{name}</span>) +
      %(\n        </a>)
  end.join("\n")
end

def foot_items(search, bell_href, bell_dot, avatar_href, avatar_mark, avatar_name, has_panels)
  out = ['        <span class="ide-rail__sep" aria-hidden="true"></span>']

  if has_panels
    out << %(        <button type="button" class="ide-rail__item" id="toggle-left" aria-pressed="true" aria-controls="chapter-tree" title="左栏：目录（⌘/Ctrl + B）">) +
           %(\n          <i data-lucide="panel-left" class="ide-rail__icon"></i>) +
           %(\n          <span class="ide-rail__label">目录</span>) +
           %(\n        </button>)
    out << %(        <button type="button" class="ide-rail__item" id="toggle-right" aria-pressed="true" aria-controls="related-quiz" title="右栏：本页目录（⌘/Ctrl + ⌥/Alt + B）">) +
           %(\n          <i data-lucide="panel-right" class="ide-rail__icon"></i>) +
           %(\n          <span class="ide-rail__label">本页</span>) +
           %(\n        </button>)
  end

  if search
    out << %(        <a class="ide-rail__item ide-rail__search" href="search.html" title="搜索知识点（⌘K）">) +
           %(\n          <i data-lucide="search" class="ide-rail__icon"></i>) +
           %(\n          <span class="ide-rail__label">搜索</span>) +
           %(\n          <kbd class="ide-rail__kbd">⌘K</kbd>) +
           %(\n        </a>)
  end

  if bell_href
    dot = bell_dot ? %(\n            <span class="ide-rail__dot" aria-hidden="true"></span>) : ''
    out << %(        <a class="ide-rail__item" href="#{bell_href}" title="消息通知">) +
           %(\n          <i data-lucide="bell" class="ide-rail__icon"></i>) +
           dot +
           %(\n          <span class="ide-rail__label">消息</span>) +
           %(\n        </a>)
  end

  if avatar_href
    out << %(        <a class="ide-rail__account" href="#{avatar_href}" title="个人中心">) +
           %(\n          <span class="ide-rail__avatar" aria-hidden="true">#{avatar_mark.empty? ? '我' : avatar_mark}</span>) +
           %(\n          <span class="ide-rail__label">#{avatar_name.empty? ? '个人中心' : avatar_name}</span>) +
           %(\n        </a>)
  else
    out << %(        <a class="ide-rail__account" href="login.html" title="登录 / 注册">) +
           %(\n          <span class="ide-rail__avatar" aria-hidden="true"><i data-lucide="user"></i></span>) +
           %(\n          <span class="ide-rail__label">登录</span>) +
           %(\n        </a>)
  end

  out << %(        <a class="ide-rail__item" href="settings.html" title="设置">) +
         %(\n          <i data-lucide="settings" class="ide-rail__icon"></i>) +
         %(\n          <span class="ide-rail__label">设置</span>) +
         %(\n        </a>)
  out.join("\n")
end

changed = []
Dir.glob(File.join(ROOT, '*.html')).sort.each do |path|
  name = File.basename(path)
  html = File.read(path, encoding: 'UTF-8')

  if html.include?('data-shell="2"')
    next
  end

  search, bell_href, bell_dot, avatar_href, avatar_mark, avatar_name, has_panels, key = build_rail(html)
  key = PAGE_KEY[name] if key.nil? && PAGE_KEY.key?(name)

  rail = <<~HTML.rstrip
        <nav class="ide-rail" data-shell="2" aria-label="主导航">
          <a class="ide-rail__brand" href="home.html" data-dom-id="nav-home" title="悟空数学 · 知识图谱">
            <span class="ide-rail__mark" aria-hidden="true">悟</span>
            <span class="ide-rail__brand-text">
              <span class="ide-rail__brand-name">悟空数学</span>
              <span class="ide-rail__brand-sub">知识图谱</span>
            </span>
          </a>
          <span class="ide-rail__sep" aria-hidden="true"></span>

          <div class="ide-rail__group">
    #{nav_items(key)}
          </div>

          <div class="ide-rail__foot">
    #{foot_items(search, bell_href, bell_dot, avatar_href, avatar_mark, avatar_name, has_panels)}
          </div>
        </nav>
  HTML

  # 1) 删掉顶部栏
  html = html.sub(/[ \t]*<header class="ide-bar">.*?<\/header>\n/m, '')

  # 2) 用新侧栏替换旧侧栏
  if html =~ %r{[ \t]*<nav class="ide-rail".*?</nav>\n}m
    html = html.sub(%r{[ \t]*<nav class="ide-rail".*?</nav>\n}m, rail + "\n")
  else
    # concept.html 之类没有标准顶栏的：侧栏插到 <body> 之后
    html = html.sub(/(<body[^>]*>\n)/) { "#{Regexp.last_match(1)}#{rail}\n" }
  end

  # 3) 顶栏没了，纵向留白还给内容
  html = html.gsub(/padding-top:\s*56px/, 'padding-top:0')
  html = html.gsub(/(?<![\w-])top:\s*56px/, 'top:0')
  html = html.gsub('calc(100vh - 56px)', '100vh')
  html = html.gsub('calc(100dvh - 56px)', '100dvh')

  # 4) 章节页左栏底部的账号块与侧栏重复，移除
  html = html.sub(/[ \t]*<div class="tree-account">.*?<\/div>\n/m, '')

  if DRY
    next unless ONLY.empty? || ONLY.include?(name)
    puts "===== #{name} ====="
    puts rail
    puts
    next
  end

  File.write(path, html, encoding: 'UTF-8')
  changed << name
end

unless DRY
  puts "撤顶栏 + 重建侧栏: #{changed.length} 个页面"
  changed.each { |c| puts "  ✓ #{c}" }
end
