/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Standalone output is only used for the desktop (Electron) build.
  // It gets its own distDir so building the desktop bundle can never corrupt
  // a running `next dev` server that serves from .next.
  ...(process.env.BUILD_STANDALONE === '1'
    ? { output: 'standalone', distDir: '.next-desktop' }
    : {}),
};

module.exports = nextConfig;
