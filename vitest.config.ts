import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
  test: {
    environment: 'node',          // default — UI tests opt into jsdom per-file
    include: ['tests/frontend/**/*.test.{ts,tsx}'],
  },
});
