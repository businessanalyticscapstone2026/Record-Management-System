const http = require('http');
const fs = require('fs');
const path = require('path');

const root = __dirname;
const DEFAULT_PORT = 5500;
const cliPortArg = process.argv.find(arg => arg.startsWith('--port='));
const cliPort = cliPortArg ? Number(cliPortArg.split('=')[1]) : NaN;
const port = Number.isInteger(cliPort) && cliPort > 0 && cliPort <= 65535 ? cliPort : DEFAULT_PORT;
const backendHost = process.env.BACKEND_HOST || '127.0.0.1';
const backendPort = Number(process.env.BACKEND_PORT) || 5000;
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
  const requestPath = decodeURIComponent((req.url || '/').split('?')[0]);

  // Keep browser requests same-origin and forward API/health traffic to the
  // Express API, matching the routing behavior of the hosted Vercel app.
  if (/^\/(?:api(?:\/|$)|healthz?$)/.test(requestPath)) {
    const proxyRequest = http.request({
      hostname: backendHost,
      port: backendPort,
      path: req.url,
      method: req.method,
      headers: { ...req.headers, host: `${backendHost}:${backendPort}` }
    }, proxyResponse => {
      res.writeHead(proxyResponse.statusCode || 502, proxyResponse.headers);
      proxyResponse.pipe(res);
    });

    proxyRequest.on('error', error => {
      if (res.headersSent) return res.destroy(error);
      res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        success: false,
        message: `Local API is unavailable at http://${backendHost}:${backendPort}. Start the backend with npm run start:backend or npm start.`
      }));
    });

    req.pipe(proxyRequest);
    return;
  }

  const safePath = requestPath === '/' ? '/login.html' : requestPath;
  const filePath = path.normalize(path.join(root, safePath));

  if (!filePath.startsWith(root) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
    return;
  }

  const extension = path.extname(filePath).toLowerCase();
  const contentType = types[extension] || 'application/octet-stream';
  res.writeHead(200, {
    'Content-Type': contentType,
    'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
    Pragma: 'no-cache',
    Expires: '0'
  });
  fs.createReadStream(filePath).pipe(res);
});

server.listen(port, host, () => {
  console.log(`Record Management frontend running at http://localhost:${port}/login.html`);
  console.log(`API proxy: http://localhost:${port}/api -> http://${backendHost}:${backendPort}/api`);
  console.log('Press Ctrl+C in this terminal to stop it.');
});
