import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { TOOL_CATALOG } from './src/catalog.js';

// Strict CSP for the built site. 'wasm-unsafe-eval' lets the worker compile qpdf's WebAssembly;
// connect-src 'self' means the page can't send data anywhere else. (Not applied in dev:
// Vite's dev server needs inline scripts for hot reload.)
export const CSP = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "worker-src 'self'",
  "connect-src 'self'",
  "img-src 'self' data: blob:",
  "style-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

const productionCsp = {
  name: 'production-csp',
  apply: 'build',
  transformIndexHtml: () => [
    { tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP }, injectTo: 'head-prepend' },
  ],
};

// Structured data for search engines (schema.org WebApplication), built from the catalog so the
// feature list always matches the tools. A JSON data block, not a script: the CSP doesn't apply.
export const STRUCTURED_DATA = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'PDF Toolkit',
  url: 'https://pdfkit.rxnova.dev/',
  description: 'Free PDF tools that run entirely in your browser. Your files never leave your device: nothing is uploaded.',
  applicationCategory: 'UtilitiesApplication',
  operatingSystem: 'Any (runs in a web browser)',
  browserRequirements: 'Requires JavaScript and a modern browser',
  isAccessibleForFree: true,
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  image: 'https://pdfkit.rxnova.dev/og-image.png',
  featureList: [...TOOL_CATALOG.map((t) => `${t.title}: ${t.desc}`), 'Private: files are processed on your device and never uploaded'],
  author: { '@type': 'Organization', name: 'RXNova' },
};

const structuredData = {
  name: 'structured-data',
  transformIndexHtml: () => [
    { tag: 'script', attrs: { type: 'application/ld+json' }, children: JSON.stringify(STRUCTURED_DATA), injectTo: 'head' },
  ],
};

// Public files worth having offline (sharing images, robots and sitemap aren't).
const OFFLINE_PUBLIC = readdirSync('public').filter((f) => /\.(svg|png|webmanifest)$/.test(f) && f !== 'og-image.png');

/**
 * Emits sw.js with the list of every built file to precache, and a version that changes
 * whenever any of them does (so a deploy replaces the old cache).
 */
const serviceWorker = {
  name: 'service-worker',
  apply: 'build',
  generateBundle(_options, bundle) {
    const built = Object.keys(bundle).filter((f) => !f.endsWith('.map'));
    // The page is cached as "./", the URL it's served at (hosts like Cloudflare redirect
    // /index.html to /, and a redirect can't stand in for a page). index.html itself is
    // emitted after this hook runs, so it's left out here.
    const precache = ['./', ...[...new Set([...built, ...OFFLINE_PUBLIC])].filter((f) => f !== 'index.html').sort()];
    const version = createHash('sha256').update(precache.join('\n')).update(
      built.map((f) => bundle[f].code ?? bundle[f].source ?? '').join(''),
    ).digest('hex').slice(0, 12);
    const source = readFileSync('src/sw/sw.js', 'utf8')
      .replace("'__VERSION__'", JSON.stringify(version))
      .replace('__PRECACHE__', JSON.stringify(precache));
    this.emitFile({ type: 'asset', fileName: 'sw.js', source });
  },
};

export default defineConfig({
  base: './', // relative URLs, so the site works from any sub-path (e.g. GitHub Pages)
  plugins: [react(), productionCsp, structuredData, serviceWorker],
  worker: { format: 'es' },
  // Pre-bundle the worker's dependencies at dev-server start. Otherwise Vite discovers them
  // on first use and reloads the page mid-session.
  optimizeDeps: { include: ['pdf-lib', 'fflate', '@neslinesli93/qpdf-wasm'] },
  build: { outDir: 'dist', emptyOutDir: true, target: 'es2022' },
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
});
