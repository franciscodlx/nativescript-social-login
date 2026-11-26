import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // Tests run against the core's sources, not its build.
    alias: {
      '@franciscodlxdev/nativescript-auth-core': fileURLToPath(
        new URL('./packages/auth-core/src/index.ts', import.meta.url)
      ),
      // nativescript-vue pulls in @nativescript/core, which only loads on a
      // device; its reactivity API is Vue's own runtime-core.
      'nativescript-vue': '@vue/runtime-core',
    },
  },
  test: {
    include: ['packages/*/src/**/*.test.ts'],
  },
});
