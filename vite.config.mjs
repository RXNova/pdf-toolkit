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

export default defineConfig({
  base: './', // relative URLs, so the site works from any sub-path (e.g. GitHub Pages)
  plugins: [react(), productionCsp, structuredData],
  worker: { format: 'es' },
  // Pre-bundle the worker's dependencies at dev-server start. Otherwise Vite discovers them
  // on first use and reloads the page mid-session.
  optimizeDeps: { include: ['pdf-lib', 'fflate', '@neslinesli93/qpdf-wasm'] },
  build: { outDir: 'dist', emptyOutDir: true, target: 'es2022' },
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
});
