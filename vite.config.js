import { defineConfig } from 'vite';
import { resolve } from 'node:path';

const desktop = process.env.MODEL_VIEW_DESKTOP === '1' || process.env.GFPAK_DESKTOP === '1';
export default defineConfig({
  root: 'web',
  base: desktop ? '/' : '/Model-View/',
  publicDir: 'public',
  build: {
    outDir: desktop ? '../dist-desktop' : '../dist-web',
    emptyOutDir: true,
    target: 'es2022',
    sourcemap: false,
    rollupOptions: {
      input: {
        main: resolve(process.cwd(), 'web/index.html'),
        legacy: resolve(process.cwd(), 'web/legacy.html'),
      },
    },
  },
});