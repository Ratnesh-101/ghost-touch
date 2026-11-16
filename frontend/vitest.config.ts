import { defineConfig } from 'vitest/config';

// Test-only config. Kept separate from vite.config.ts so Vite 6 plugin types
// don't collide with Vitest's config types. Pure-core tests run in the `node`
// environment; component tests can add the react plugin + jsdom here later.
// https://vitest.dev/config/
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    env: {
      VITE_API_URL: '',
    },
    // Let tests read src/styles/global.css (touch-target rules) instead of an empty stub.
    css: { include: [/global\.css/] },
    include: [
      'tests/**/*.test.ts',
      'tests/**/*.test.tsx',
      'tests/**/*.prop.test.ts',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
    },
  },
});
