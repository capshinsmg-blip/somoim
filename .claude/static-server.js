const http = require('http'), fs = require('fs'), path = require('path');
// 루트 폴더와 포트를 argv로 받음 (기본: docs, 3100)
const rootArg = process.argv[2] || 'docs';
const port = parseInt(process.argv[3] || '3100', 10);
const root = path.join(__dirname, '..', rootArg);
http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const f = path.join(root, p);
  fs.readFile(f, (e, d) => {
    if (e) { res.writeHead(404); res.end('not found'); return; }
    const ext = path.extname(f);
    const ct = ext === '.html' ? 'text/html' : ext === '.js' ? 'application/javascript' : 'text/plain';
    res.writeHead(200, { 'Content-Type': ct + '; charset=utf-8' });
    res.end(d);
  });
}).listen(port, () => console.log('serving ' + rootArg + ' on http://localhost:' + port));
