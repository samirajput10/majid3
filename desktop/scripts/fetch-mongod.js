/**
 * Downloads the MongoDB Community server for Windows and extracts mongod.exe
 * into desktop/bin/. Run once before `npm run dist` (or `npm start`).
 */
const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const VERSION = '7.0.14';
const URL = `https://fastdl.mongodb.org/windows/mongodb-windows-x86_64-${VERSION}.zip`;

const binDir = path.join(__dirname, '..', 'bin');
const zipPath = path.join(binDir, 'mongodb.zip');
const exePath = path.join(binDir, 'mongod.exe');

if (fs.existsSync(exePath)) {
  console.log('mongod.exe already present — skipping download.');
  process.exit(0);
}

fs.mkdirSync(binDir, { recursive: true });

function download(url, dest, cb) {
  console.log('Downloading', url);
  const file = fs.createWriteStream(dest);
  https.get(url, res => {
    if (res.statusCode >= 300 && res.headers.location) {
      file.close();
      return download(res.headers.location, dest, cb);
    }
    if (res.statusCode !== 200) {
      console.error('Download failed with HTTP', res.statusCode);
      process.exit(1);
    }
    const total = parseInt(res.headers['content-length'] || '0', 10);
    let got = 0, lastPct = -10;
    res.on('data', c => {
      got += c.length;
      const pct = total ? Math.floor((got / total) * 100) : 0;
      if (pct >= lastPct + 10) { lastPct = pct; console.log(`  ${pct}%`); }
    });
    res.pipe(file);
    file.on('finish', () => file.close(cb));
  }).on('error', e => { console.error(e.message); process.exit(1); });
}

download(URL, zipPath, () => {
  console.log('Extracting mongod.exe ...');
  const extractDir = path.join(binDir, 'extract');
  execSync(
    `powershell -NoProfile -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${extractDir}' -Force"`,
    { stdio: 'inherit' }
  );
  // Find mongod.exe inside the extracted folder
  const inner = fs.readdirSync(extractDir).find(d => d.startsWith('mongodb-'));
  const src = path.join(extractDir, inner, 'bin', 'mongod.exe');
  fs.copyFileSync(src, exePath);
  // Clean up
  fs.rmSync(extractDir, { recursive: true, force: true });
  fs.rmSync(zipPath, { force: true });
  console.log('Done →', exePath);
});
