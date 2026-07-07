const http = require('http'), fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..', 'docs');
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
}).listen(3100, () => console.log('serving docs on http://localhost:3100'));
