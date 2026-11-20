import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // Tests run against the core's sources, not its build.
    alias: {
      '@franciscodlxdev/nativescript-auth-core': fileURLToPath(
        new URL('./packages/auth-core/src/index.ts', import.meta.url)
      ),
    },
  },
  test: {
    include: ['packages/*/src/**/*.test.ts'],
  },
});
