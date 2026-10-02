import { test, expect, VideoSubtitlesReporter } from 'video-captions';
import { configureVideoCaptions } from 'video-captions/runtime';
import { enableSlowTyping } from 'video-captions/slow-typing';

test.beforeEach(({ page }, info) => {
  configureVideoCaptions(page, info);
  enableSlowTyping(page, 100, () => true);
});
test('CommonJS declarations', async () => {
  await test.step('A result', async () => {
    await Promise.resolve(expect(42, 'The answer is correct').toBe(42));
  }, { params: { videoCaption: true } });
});
new VideoSubtitlesReporter({ outputFile: 'video.ass', chapterFile: 'chapters.ffmetadata' });
