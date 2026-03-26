import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));

/**
 * Node server bundle (stdio + HTTP transports). Dependencies stay external;
 * project source is rolled up with correct ESM specifiers for Node.
 */
export default defineConfig({
  root,
  publicDir: false,
  build: {
    ssr: true,
    target: 'node20',
    outDir: 'dist',
    emptyOutDir: false,
    minify: false,
    sourcemap: true,
    rollupOptions: {
      input: {
        stdio: resolve(root, 'src/stdio.ts'),
        http: resolve(root, 'src/http.ts'),
      },
      output: {
        format: 'esm',
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
      },
    },
  },
  ssr: {
    target: 'node',
    // Default: npm deps are external; only local src is bundled.
  },
});
