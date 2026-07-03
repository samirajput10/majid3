/**
 * Majid Steel Warehouse — desktop shell.
 *
 * Boot sequence:
 *   1. start a private local MongoDB (bundled mongod.exe, data in userData)
 *   2. start the Next.js server bundle on 127.0.0.1
 *   3. open the app window
 *   4. background-sync the local DB with MongoDB Atlas whenever online
 */
const { app, BrowserWindow, dialog } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const net = require('net');
const http = require('http');
const { runSync } = require('./sync');

const APP_PORT = 17123;
const MONGO_PORT = 27123;
const LOCAL_URI = `mongodb://127.0.0.1:${MONGO_PORT}/steelvault`;

let win = null;
let mongodProc = null;
let serverProc = null;
let syncTimer = null;
let quitting = false;

// ── Paths (dev vs packaged) ──────────────────────────────────────────────────
const RES = app.isPackaged ? process.resourcesPath : __dirname;
const MONGOD_EXE = app.isPackaged
  ? path.join(RES, 'mongod', 'mongod.exe')
  : path.join(__dirname, 'bin', 'mongod.exe');
const SERVER_DIR = app.isPackaged
  ? path.join(RES, 'app-server')
  : path.join(__dirname, 'server-bundle');

// ── Config (userData/config.json, seeded from bundled defaults) ─────────────
function loadConfig() {
  const userCfgPath = path.join(app.getPath('userData'), 'config.json');
  const defaultsPath = path.join(__dirname, 'default-config.json');
  let defaults = {};
  try { defaults = JSON.parse(fs.readFileSync(defaultsPath, 'utf8')); } catch {}
  let userCfg = {};
  try { userCfg = JSON.parse(fs.readFileSync(userCfgPath, 'utf8')); } catch {}
  const cfg = { ...defaults, ...userCfg };
  try { fs.writeFileSync(userCfgPath, JSON.stringify(cfg, null, 2)); } catch {}
  return cfg;
}

// ── Small wait helpers ───────────────────────────────────────────────────────
function waitForTcp(port, timeoutMs) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;
    (function tryOnce() {
      const sock = net.createConnection({ host: '127.0.0.1', port }, () => {
        sock.destroy(); resolve();
      });
      sock.on('error', () => {
        sock.destroy();
        if (Date.now() > deadline) return reject(new Error(`port ${port} not ready`));
        setTimeout(tryOnce, 300);
      });
    })();
  });
}

function waitForHttp(url, timeoutMs) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;
    (function tryOnce() {
      http.get(url, res => { res.resume(); resolve(); })
        .on('error', () => {
          if (Date.now() > deadline) return reject(new Error(`server not ready: ${url}`));
          setTimeout(tryOnce, 300);
        });
    })();
  });
}

// ── Child process logs (userData/logs/*.log) ───────────────────────────────
function childLog(name) {
  const dir = path.join(app.getPath('userData'), 'logs');
  fs.mkdirSync(dir, { recursive: true });
  return fs.openSync(path.join(dir, `${name}.log`), 'a');
}

// ── Local MongoDB ────────────────────────────────────────────────────────────
async function startMongo() {
  const dataDir = path.join(app.getPath('userData'), 'mongo-data');
  fs.mkdirSync(dataDir, { recursive: true });
  // Remove a stale lock left by a hard crash. If a previous mongod is still
  // alive it holds this file open and removal fails harmlessly (caught).
  try { fs.rmSync(path.join(dataDir, 'mongod.lock'), { force: true }); } catch {}

  const logFd = childLog('mongod');
  mongodProc = spawn(MONGOD_EXE, [
    '--dbpath', dataDir,
    '--port', String(MONGO_PORT),
    '--bind_ip', '127.0.0.1',
    '--wiredTigerCacheSizeGB', '0.25',
  ], { stdio: ['ignore', logFd, logFd], windowsHide: true });

  mongodProc.on('exit', code => {
    if (!quitting && code !== 0 && code !== null) {
      dialog.showErrorBox('Database error',
        `The local database stopped unexpectedly (code ${code}). Please restart the app.`);
    }
  });

  await waitForTcp(MONGO_PORT, 30000);
}

// ── Next.js server ───────────────────────────────────────────────────────────
async function startServer(cfg) {
  const serverJs = path.join(SERVER_DIR, 'server.js');
  const logFd = childLog('server');
  serverProc = spawn(process.execPath, [serverJs], {
    cwd: SERVER_DIR,
    windowsHide: true,
    stdio: ['ignore', logFd, logFd],
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      NODE_ENV: 'production',
      PORT: String(APP_PORT),
      HOSTNAME: '127.0.0.1',
      MONGODB_URI: LOCAL_URI,
      AUTH_EMAIL: cfg.authEmail || 'majid@admin.com',
      AUTH_PASSWORD: cfg.authPassword || 'majid123',
    },
  });

  serverProc.on('exit', code => {
    if (!quitting && code !== 0 && code !== null) {
      dialog.showErrorBox('App server error',
        `The app server stopped unexpectedly (code ${code}). Please restart the app.`);
    }
  });

  await waitForHttp(`http://127.0.0.1:${APP_PORT}/login`, 60000);
}

// ── Background sync ──────────────────────────────────────────────────────────
const BASE_TITLE = 'Majid Steel Warehouse';
function setStatus(text) {
  if (win && !win.isDestroyed()) win.setTitle(text ? `${BASE_TITLE} — ${text}` : BASE_TITLE);
}

let syncInFlight = false;
async function syncNow(cfg) {
  if (syncInFlight) return { mode: 'skipped', reason: 'sync already running' };
  syncInFlight = true;
  try {
    return await doSync(cfg);
  } finally {
    syncInFlight = false;
  }
}

async function doSync(cfg) {
  setStatus('syncing…');
  const result = await runSync({
    localUri: LOCAL_URI,
    atlasUri: cfg.atlasUri,
    log: msg => console.log('[sync]', msg),
  });
  const time = new Date().toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' });
  if (result.mode === 'push' || result.mode === 'pull') {
    setStatus(`synced ${time}`);
  } else if (result.mode === 'offline') {
    setStatus('offline — will sync when internet returns');
  } else if (result.mode === 'idle') {
    setStatus('');
  } else {
    setStatus('sync issue — data is safe locally');
    console.log('[sync]', result.reason);
  }
  return result;
}

function startSyncLoop(cfg) {
  const intervalMs = Math.max(1, cfg.syncIntervalMinutes || 3) * 60 * 1000;
  setTimeout(() => syncNow(cfg).catch(() => {}), 5000);          // shortly after boot
  syncTimer = setInterval(() => syncNow(cfg).catch(() => {}), intervalMs);
}

// ── App lifecycle ────────────────────────────────────────────────────────────
function cleanup() {
  quitting = true;
  if (syncTimer) clearInterval(syncTimer);
  if (serverProc) { try { serverProc.kill(); } catch {} }
  if (mongodProc) { try { mongodProc.kill(); } catch {} }
}

async function boot() {
  const cfg = loadConfig();
  try {
    if (!fs.existsSync(MONGOD_EXE)) {
      throw new Error(`mongod.exe not found at ${MONGOD_EXE}. Run "npm run fetch-mongod" first.`);
    }
    if (!fs.existsSync(path.join(SERVER_DIR, 'server.js'))) {
      throw new Error(`Server bundle not found at ${SERVER_DIR}. Run "npm run prepare-server" first.`);
    }
    await startMongo();
    await startServer(cfg);
  } catch (e) {
    cleanup();
    dialog.showErrorBox('Startup failed',
      String(e.message || e) +
      '\n\nSee logs in: ' + path.join(app.getPath('userData'), 'logs'));
    app.quit();
    return;
  }

  win = new BrowserWindow({
    width: 1400,
    height: 900,
    title: BASE_TITLE,
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });
  // The app sets document titles; keep our status title authoritative
  win.on('page-title-updated', e => e.preventDefault());
  win.loadURL(`http://127.0.0.1:${APP_PORT}`);
  win.on('closed', () => { win = null; });

  startSyncLoop(cfg);
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (win) { if (win.isMinimized()) win.restore(); win.focus(); }
  });
  app.whenReady().then(boot);
  app.on('before-quit', cleanup);
  app.on('window-all-closed', () => app.quit());
}
