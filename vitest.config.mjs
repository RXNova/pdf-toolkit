import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  test: {
    projects: [
      {
        test: { name: 'core', environment: 'node', include: ['src/*.test.js', 'src/core/**/*.test.js', 'src/worker/**/*.test.js'] },
      },
      {
        plugins: [react()],
        test: {
          name: 'app',
          environment: 'jsdom',
          include: ['src/app/**/*.test.{js,jsx}'],
          setupFiles: ['src/app/test-setup.js'],
        },
      },
    ],
    coverage: {
      provider: 'v8',
      include: ['src/**'],
      // Composition roots (worker entry, React bootstrap) and the pdf.js adapter (needs a real
      // browser renderer) are covered by e2e instead.
      exclude: ['**/*.test.*', 'src/worker/pdf.worker.js', 'src/app/main.jsx', 'src/app/services.js', 'src/app/test-*.js',
        'src/app/pdf-preview.js'],
      thresholds: { lines: 90, branches: 85, functions: 90, statements: 90 },
    },
  },
});
