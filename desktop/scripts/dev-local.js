/**
 * Test helper: runs the desktop stack (local mongod + standalone server)
 * without Electron, for browser-based verification. Ctrl+C stops both.
 */
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const desktop = path.join(__dirname, '..');
const dataDir = process.env.DBPATH || path.join(os.tmpdir(), 'majid-desktop-local-data');
fs.mkdirSync(dataDir, { recursive: true });

const mongod = spawn(path.join(desktop, 'bin', 'mongod.exe'), [
  '--dbpath', dataDir,
  '--port', '27124',
  '--bind_ip', '127.0.0.1',
  '--wiredTigerCacheSizeGB', '0.25',
], { stdio: 'ignore' });

setTimeout(() => {
  const server = spawn('node', ['server.js'], {
    cwd: path.join(desktop, 'server-bundle'),
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: 'production',
      PORT: process.env.PORT || '17124',
      HOSTNAME: '127.0.0.1',
      MONGODB_URI: 'mongodb://127.0.0.1:27124/steelvault',
      AUTH_EMAIL: 'majid@admin.com',
      AUTH_PASSWORD: 'majid123',
    },
  });
  server.on('exit', () => { mongod.kill(); process.exit(0); });
}, 2500);

process.on('SIGINT', () => { mongod.kill(); process.exit(0); });
process.on('SIGTERM', () => { mongod.kill(); process.exit(0); });
