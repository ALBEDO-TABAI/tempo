import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
export default defineConfig({
  plugins: [react()],
  base: './',
  resolve: { alias: { '@tokens': path.resolve(__dirname, '../tokens/generated'), '@tempo/core': path.resolve(__dirname, '../core/src/index.ts') } },
  server: { port: 5300, strictPort: true, host: '127.0.0.1', fs: { allow: [path.resolve(__dirname, '../..')] } },
  build: { outDir: 'dist', chunkSizeWarningLimit: 2000 },
});
