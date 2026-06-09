import { defineConfig } from 'vite';

export default defineConfig({
  // Relative base so the build works under any GitHub Pages subpath
  // (https://<user>.github.io/<repo>/).
  base: './',
  build: {
    outDir: 'dist',
  },
});
