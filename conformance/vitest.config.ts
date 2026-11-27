import { defineConfig } from 'vitest/config';
import AlphabeticalSequencer from './src/sequencer.ts';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    globalSetup: ['./src/global-setup.ts'],
    testTimeout: 30_000,
    // Tests run in file name order against one live install; keep them sequential.
    fileParallelism: false,
    sequence: { sequencer: AlphabeticalSequencer },
  },
});
