import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
  test: {
    environment: 'node',          // pure-function tests only — no DOM needed
    include: ['tests/frontend/**/*.test.ts'],
  },
});
