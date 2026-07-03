/**
 * Builds the Next.js app in standalone mode and assembles the runnable
 * server bundle into desktop/server-bundle/.
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', '..');       // project root
const desktop = path.join(__dirname, '..');
const bundle = path.join(desktop, 'server-bundle');

if (process.argv.includes('--skip-build')) {
  console.log('1/3 Skipping build (using existing .next)...');
} else {
  console.log('1/3 Building Next.js (standalone)...');
  execSync('npm run build', {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, BUILD_STANDALONE: '1' },
  });
}

console.log('2/3 Assembling server bundle...');
const distDir = path.join(root, '.next-desktop');   // kept separate from .next (see next.config.js)
fs.rmSync(bundle, { recursive: true, force: true });
fs.cpSync(path.join(distDir, 'standalone'), bundle, { recursive: true });
// Static assets are not included in standalone output — copy them in
fs.cpSync(
  path.join(distDir, 'static'),
  path.join(bundle, '.next-desktop', 'static'),
  { recursive: true }
);

// Standalone may have picked up .env.local (Atlas URI) — the desktop app
// injects its own env at runtime, so remove any baked env files.
for (const f of ['.env', '.env.local', '.env.production']) {
  fs.rmSync(path.join(bundle, f), { force: true });
}

console.log('3/3 Done →', bundle);
