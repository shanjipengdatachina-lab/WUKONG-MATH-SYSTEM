/* JS 语法体检：用 new Function 只解析不执行，专抓语法错误
   用法：osascript -l JavaScript js_syntax_check.js <文件...>          */
ObjC.import('Foundation');

function readFile(path) {
  var s = $.NSString.stringWithContentsOfFileEncodingError(path, $.NSUTF8StringEncoding, null);
  return s.isNil() ? null : ObjC.unwrap(s);
}

function run(argv) {
  var files = (argv && argv.length) ? argv : [];
  if (!files.length) return '用法: osascript -l JavaScript js_syntax_check.js <文件...>';
  var bad = 0;
  var out = [];
  for (var i = 0; i < files.length; i++) {
    var src = readFile(files[i]);
    if (src === null) { out.push('MISS  ' + files[i]); bad++; continue; }
    try {
      new Function(src);                     // 只解析，不执行
      out.push('OK    ' + files[i]);
    } catch (e) {
      out.push('ERROR ' + files[i] + ' → ' + e.message);
      bad++;
    }
  }
  out.push(bad ? ('RESULT: ' + bad + ' 个文件有问题') : 'RESULT: 全部通过');
  return out.join('\n');
}
