import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: 'dist/cjs',
    target: 'es2022',
    sourcemap: true,
    minify: false,
    lib: {
      entry: Object.fromEntries(
        ['index', 'runtime', 'reporter', 'slow-typing'].map(name => [
          name,
          fileURLToPath(new URL(`./src/${name}.ts`, import.meta.url)),
        ]),
      ),
      formats: ['cjs'],
      fileName: (_format, name) => `${name}.js`,
    },
    rolldownOptions: {
      external: id => id.startsWith('node:') || id === '@playwright/test' || id.startsWith('@playwright/test/'),
      output: { exports: 'named', chunkFileNames: 'chunks/[name]-[hash].js' },
    },
  },
});
