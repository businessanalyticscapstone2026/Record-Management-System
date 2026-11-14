const { spawn } = require('child_process');
const path = require('path');

const root = __dirname;
const env = { ...process.env };
const children = [];

function start(name, script, args = []) {
  const child = spawn(process.execPath, [path.join(root, script), ...args], {
    cwd: root,
    env,
    stdio: 'inherit'
  });
  children.push({ name, child });
  child.on('exit', (code, signal) => {
    if (shuttingDown) return;
    console.error(`[${name}] exited (${signal || code}). Stopping the other local services.`);
    shutdown(code || 1);
  });
  child.on('error', error => {
    console.error(`Unable to start ${name}:`, error.message);
    shutdown(1);
  });
}

let shuttingDown = false;
function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const { child } of children) {
    if (!child.killed) child.kill('SIGTERM');
  }
  setTimeout(() => {
    for (const { child } of children) {
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    }
    process.exit(exitCode);
  }, 1500).unref();
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

console.log('Starting OSCA Record Management System locally...');
console.log('Frontend: http://localhost:5500/login.html');
console.log('Backend:  http://localhost:5000/health');
console.log('Make sure the root .env contains SUPABASE_URL and SUPABASE_SECRET_KEY.');
start('backend', 'backend/server.js');
start('frontend', 'local-server.js', ['--port=5500']);
