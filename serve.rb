#!/usr/bin/env ruby
# frozen_string_literal: true

# ==========================================================================
# 初中数学知识图谱 — 零依赖本地静态服务器
# --------------------------------------------------------------------------
# 项目本身是纯静态站点（无构建、无 npm 依赖），可直接双击 home.html 打开；
# 但用 HTTP 方式访问体验更好（相对路径、localStorage、剪贴板 API 等都更稳定）。
#
# 用法：
#   ruby serve.rb            # 默认 http://127.0.0.1:5173
#   ruby serve.rb 8080       # 指定端口
#
# 仅使用 Ruby 标准库（socket / uri），无需安装任何 gem。
# ==========================================================================

require 'socket'
require 'uri'
require 'time'

ROOT = File.expand_path(__dir__)
PORT = (ARGV[0] || ENV['PORT'] || 5173).to_i
HOST = ARGV[1] || '127.0.0.1'

MIME = {
  '.html' => 'text/html; charset=utf-8',
  '.css'  => 'text/css; charset=utf-8',
  '.js'   => 'text/javascript; charset=utf-8',
  '.mjs'  => 'text/javascript; charset=utf-8',
  '.json' => 'application/json; charset=utf-8',
  '.svg'  => 'image/svg+xml',
  '.png'  => 'image/png',
  '.jpg'  => 'image/jpeg',
  '.jpeg' => 'image/jpeg',
  '.gif'  => 'image/gif',
  '.webp' => 'image/webp',
  '.ico'  => 'image/x-icon',
  '.woff' => 'font/woff',
  '.woff2' => 'font/woff2',
  '.ttf'  => 'font/ttf',
  '.txt'  => 'text/plain; charset=utf-8',
  '.md'   => 'text/markdown; charset=utf-8',
  '.map'  => 'application/json; charset=utf-8'
}.freeze

def resolve_path(request_path)
  # 去掉查询串并做 URL 解码
  raw = request_path.split('?', 2).first.to_s
  decoded = begin
    URI.decode_www_form_component(raw)
  rescue StandardError
    raw
  end

  relative = decoded.sub(%r{\A/}, '')
  candidate = File.expand_path(File.join(ROOT, relative))

  # 防止目录穿越
  return nil unless candidate == ROOT || candidate.start_with?(ROOT + File::SEPARATOR)

  if File.directory?(candidate)
    index = File.join(candidate, 'home.html')
    return File.exist?(index) ? index : nil
  end
  candidate
end

def build_response(status, headers, body)
  head = +"HTTP/1.1 #{status}\r\n"
  headers.each { |key, value| head << "#{key}: #{value}\r\n" }
  head << "Connection: close\r\n"
  head << "\r\n"
  head + body
end

def not_found
  body = <<~HTML
    <!DOCTYPE html>
    <html lang="zh-CN"><head><meta charset="UTF-8">
    <title>404</title>
    <style>
      body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
           font-family:-apple-system,"PingFang SC",system-ui,sans-serif;color:#101215;background:#fff}
      .box{text-align:center}
      .code{font-size:13px;color:#9ba1a9;letter-spacing:.08em}
      h1{font-size:22px;font-weight:600;margin:12px 0 8px}
      a{color:#1a3a8f;text-decoration:none;font-size:14px}
    </style></head>
    <body><div class="box">
      <p class="code">404</p>
      <h1>页面不存在</h1>
      <p><a href="/">返回总目录</a></p>
    </div></body></html>
  HTML
  build_response('404 Not Found',
                 { 'Content-Type' => 'text/html; charset=utf-8',
                   'Content-Length' => body.bytesize.to_s },
                 body)
end

server = TCPServer.new(HOST, PORT)
puts '悟空数学知识图谱 · 本地预览服务已启动'
puts "  → http://#{HOST}:#{PORT}/"
puts "  → 首页 http://#{HOST}:#{PORT}/home.html"
puts '  按 Ctrl+C 停止'

loop do
  begin
    socket = server.accept
  rescue Interrupt
    break
  end

  Thread.new(socket) do |client|
    begin
      request_line = client.gets
      next if request_line.nil?

      method, target, = request_line.split(' ')
      # 消费剩余请求头
      while (line = client.gets)
        break if line.strip.empty?
      end

      if method != 'GET' && method != 'HEAD'
        client.write(build_response('405 Method Not Allowed',
                                    { 'Content-Type' => 'text/plain; charset=utf-8',
                                      'Allow' => 'GET, HEAD',
                                      'Content-Length' => '0' }, ''))
        next
      end

      path = resolve_path(target)

      if path.nil? || !File.file?(path)
        client.write(not_found)
        next
      end

      body = File.binread(path)
      type = MIME[File.extname(path).downcase] || 'application/octet-stream'
      headers = {
        'Content-Type' => type,
        'Content-Length' => body.bytesize.to_s,
        'Cache-Control' => 'no-cache, no-store, must-revalidate',
        'Last-Modified' => File.mtime(path).httpdate
      }
      response = build_response('200 OK', headers, method == 'HEAD' ? '' : body)
      client.write(response)
    rescue StandardError => e
      warn "  ! #{e.class}: #{e.message}"
    ensure
      client.close rescue nil
    end
  end
end

server.close
puts '服务已停止'
