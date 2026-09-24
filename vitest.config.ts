// Vitest runs the dashboard tests in tests/frontend. The default environment
// is node; a test that renders components opts into jsdom in its first line.
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
  test: {
    environment: 'node',
    include: ['tests/frontend/**/*.test.{ts,tsx}'],
    setupFiles: ['tests/frontend/setup.ts'],
    // Above the 5 s that tests/frontend/setup.ts gives Testing Library's
    // waits, so a wait that fails reports its own message and the page.
    testTimeout: 20_000,
  },
});
