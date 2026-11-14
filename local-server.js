const http = require('http');
const fs = require('fs');
const path = require('path');

const root = __dirname;
const DEFAULT_PORT = 5500;
const cliPortArg = process.argv.find(arg => arg.startsWith('--port='));
const cliPort = cliPortArg ? Number(cliPortArg.split('=')[1]) : NaN;
const port = Number.isInteger(cliPort) && cliPort > 0 && cliPort <= 65535 ? cliPort : DEFAULT_PORT;
const host = '0.0.0.0';

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  const requestPath = decodeURIComponent(req.url.split('?')[0]);
  const safePath = requestPath === '/' ? '/login.html' : requestPath;
  const filePath = path.normalize(path.join(root, safePath));

  if (!filePath.startsWith(root) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
    return;
  }

  const extension = path.extname(filePath).toLowerCase();
  const contentType = types[extension] || 'application/octet-stream';
  const isStaticAsset = ['.html', '.js', '.css', '.svg', '.jpg', '.jpeg', '.png', '.ico'].includes(extension);

  res.writeHead(200, {
    'Content-Type': contentType,
    'Cache-Control': isStaticAsset ? 'no-store, no-cache, must-revalidate, max-age=0' : 'no-store, no-cache, must-revalidate, max-age=0',
    Pragma: 'no-cache',
    Expires: '0'
  });
  fs.createReadStream(filePath).pipe(res);
});

server.listen(port, host, () => {
  console.log(`AdminStaffPortal running at http://localhost:${port}/login.html`);
  console.log(`Also available at http://127.0.0.1:${port}/login.html`);
  console.log('Press Ctrl+C in this terminal to stop it.');
});
