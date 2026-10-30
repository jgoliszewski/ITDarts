/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The server (port 3000) owns all state; Vite only serves the SPA in dev.
export default defineConfig({
  root: 'web',
  plugins: [react()],
  build: { outDir: '../dist/web', emptyOutDir: true },
  server: {
    host: true,
    port: 5173,
    proxy: {
      // xfwd: the server tells the kiosk from phones by the browser's address (server/index.ts).
      '/ws': { target: 'ws://localhost:3000', ws: true, xfwd: true },
      '/api': 'http://localhost:3000',
      '/sounds': 'http://localhost:3000',
      '/caller': 'http://localhost:3000',
    },
  },
  test: { root: '.', include: ['games/**/*.test.ts', 'server/**/*.test.ts', 'web/src/**/*.test.ts'] },
});
