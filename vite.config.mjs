import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

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

export default defineConfig({
  base: './', // relative URLs, so the site works from any sub-path (e.g. GitHub Pages)
  plugins: [react(), productionCsp],
  worker: { format: 'es' },
  // Pre-bundle the worker's dependencies at dev-server start. Otherwise Vite discovers them
  // on first use and reloads the page mid-session.
  optimizeDeps: { include: ['pdf-lib', 'fflate', '@neslinesli93/qpdf-wasm'] },
  build: { outDir: 'dist', emptyOutDir: true, target: 'es2022' },
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
});
