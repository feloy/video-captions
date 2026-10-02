import { defineConfig } from '@playwright/test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

export default defineConfig({
  testDir: '.',
  testMatch: 'runtime.spec.mjs',
  workers: 1,
  reporter: [
    ['list'],
    [require.resolve('video-captions/reporter'), {
      outputFile: `${process.env.CAPTION_TEST_OUTPUT}/captions.ass`,
      chapterFile: `${process.env.CAPTION_TEST_OUTPUT}/chapters.ffmetadata`,
    }],
  ],
  outputDir: `${process.env.CAPTION_TEST_OUTPUT}/test-results`,
});
