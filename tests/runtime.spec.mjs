import { test as baseTest, expect as baseExpect } from '@playwright/test';
import { configureVideoCaptions, createVideoCaptionTest, frameForCaption } from 'video-captions';

// Exercise real Playwright steps and matchers without downloading a browser.
class FakeLocator {
  events = [];
  async click(options) { this.events.push(['click', options]); }
  async check(options) { this.events.push(['check', options]); }
  async uncheck(options) { this.events.push(['uncheck', options]); }
  async fill(value, options) { this.events.push(['fill', value, options]); }
  async pressSequentially(value, options) { this.events.push(['type', value, options]); }
  async evaluate() { return 'Save'; }
  async scrollIntoViewIfNeeded() { this.events.push(['scroll']); }
}

const { test, expect } = createVideoCaptionTest(baseTest.extend({
  control: async ({}, use) => { await use(new FakeLocator()); },
}), baseExpect);

test.beforeEach(({ control }, testInfo) => {
  configureVideoCaptions({ locator: () => control }, testInfo);
});

test('captions marked actions and named outcomes', async ({ control }) => {
  await test.step('Business outcome', async () => {
    await control.click({ force: true });
    await control.check();
    await control.uncheck();
    await control.fill('admin');
    await Promise.resolve(expect({ name: 'admin' }, 'Administrator created').toMatchObject({ name: 'admin' }));
    await Promise.resolve(expect('admin', 'Administrator remains visible').not.toBe('guest'));
  }, { params: { videoCaption: true } });
  expect(control.events[0]).toEqual(['click', { force: true }]);
  if (Number(process.env.CAPTION_TYPING_DURATION_MS) > 0) {
    expect(control.events.slice(-2)).toEqual([['fill', '', undefined], ['type', 'admin', { delay: 12 / 5 }]]);
  } else {
    expect(control.events.at(-1)).toEqual(['fill', 'admin', undefined]);
  }
});

test('falls back to the business step title and preserves its return value', async () => {
  const start = Date.now();
  const result = await test.step('Fallback business caption', async () => {
    expect(1).toBe(1);
    return 42;
  }, { params: { videoCaption: true } });
  expect(result).toBe(42);
  if (Number(process.env.CAPTION_PACE_MS) > 0) expect(Date.now() - start).toBeGreaterThanOrEqual(10);
});

test('leaves unmarked actions and synchronous matchers alone', async ({ control }) => {
  await test.step('Unmarked step', async () => {
    await control.fill('plain');
    await control.click();
    const result = expect(1, 'Unmarked expectation').toBe(1);
    expect(result).toBeUndefined();
    await frameForCaption(control);
  });
  expect(control.events).toEqual([['fill', 'plain', undefined], ['click', undefined]]);
});

test('keeps empty fills immediate within marked steps', async ({ control }) => {
  await test.step('Empty field', async () => {
    await control.fill('');
  }, { params: { videoCaption: true } });
  expect(control.events).toEqual([['fill', '', undefined]]);
});

test('preserves assertion failures', async () => {
  test.fail();
  await test.step('Failed business caption', async () => {
    await Promise.resolve(expect(1, 'Failed expectation caption').toBe(2));
  }, { params: { videoCaption: true } });
});
