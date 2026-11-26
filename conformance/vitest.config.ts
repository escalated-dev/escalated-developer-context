import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    globalSetup: ['./src/global-setup.ts'],
    testTimeout: 30_000,
    // Tests run in file order against one live install; keep them sequential.
    fileParallelism: false,
  },
});
