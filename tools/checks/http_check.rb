# encoding: UTF-8
require 'net/http'

targets = ['/reader.html', '/graph.html', '/assets/js/reader-live.js', '/assets/js/math-tree.js']
targets.each do |path|
  begin
    res = Net::HTTP.get_response(URI("http://127.0.0.1:5173#{path}"))
    body = res.body.to_s
    line = format('%-30s HTTP %s  %d bytes', path, res.code, body.bytesize)
    if path.end_with?('reader.html')
      line += "  | reader-live.js: #{body.include?('reader-live.js')}"
      line += "  | page-outline: #{body.include?('page-outline')}"
    end
    if path.end_with?('graph.html')
      line += "  | mm-frame: #{body.include?('id="mm-frame"')}"
      line += "  | mm-full: #{body.include?('id="mm-full"')}"
    end
    puts line
  rescue StandardError => e
    puts "#{path} 请求失败: #{e.class}"
  end
end
