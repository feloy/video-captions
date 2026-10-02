import { test as baseTest, expect as baseExpect } from '@playwright/test';
import { createVideoCaptionTest, configureVideoCaptions, type SubtitleReporterOptions } from 'video-captions';
import Reporter from 'video-captions/reporter';

const customExpect = baseExpect.extend({ toBeAnswer(value: unknown) { return { pass: value === 42, message: () => 'Expected 42' }; } });
const { test, expect } = createVideoCaptionTest(baseTest.extend<{ answer: number }>({ answer: 42 }), customExpect);
test.beforeEach(({ page }, info) => configureVideoCaptions(page, info));
test('custom fixture types', async ({ answer }) => {
  await test.step('Answer', async () => {
    await Promise.resolve(expect(answer, 'The answer is correct').toBeAnswer());
  }, { params: { videoCaption: true } });
});
const options: SubtitleReporterOptions = { outputFile: 'video.ass', chapterFile: 'chapters.ffmetadata' };
new Reporter(options);
