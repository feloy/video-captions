# video-captions

Turn a Playwright test run into a paced, captioned recording. Mark meaningful
business steps, then generate ASS subtitles and FFmetadata chapters describing
actions and verified outcomes. Pacing and slow typing default to off.

Requires Node.js 20 or later and `@playwright/test` 1.63 or later (before 2.0).
Playwright 1.63 provides the step `params` API used to mark captions.

```sh
npm install --save-dev video-captions @playwright/test
```

The package supports ES modules and CommonJS and includes TypeScript declarations.
It generates subtitle and chapter files; record the video separately with your
screen recorder or Playwright. The reporter uses one shared recording timeline.
Run with one worker for a sequential recording.

## Components

- `video-captions` (also `video-captions/runtime`) configures caption pacing and exports the Playwright `test` API
  with support for marked video steps.
- `video-captions/slow-typing` transparently replaces `Locator.fill()` with sequential
  typing over a fixed duration.
- `video-captions/reporter` produces an ASS subtitle track and FFmetadata chapters.

## Enable the framework

Configure the reporter when a recording is requested:

```ts
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  workers: 1,
  reporter: process.env.VIDEO_SUBTITLES === 'true'
    ? [
        ['list'],
        ['video-captions/reporter', {
          outputFile: './recordings/e2e.ass',
          chapterFile: './recordings/e2e.ffmetadata',
        }],
      ]
    : [['list']],
});
```

Install the runtime once from the shared Playwright fixture hook:

```ts
import { configureVideoCaptions, test } from 'video-captions';

test.beforeEach(({ page }, testInfo) => {
  configureVideoCaptions(page, testInfo);
});
```

Enable caption pacing and typing for the test process:

```sh
VIDEO_SUBTITLES=true CAPTION_PACE_MS=2000 CAPTION_TYPING_DURATION_MS=2000 npx playwright test
```

When recording externally, export `VIDEO_RECORDING_STARTED_AT` immediately
before the recorder starts. If omitted, the reporter aligns to the beginning of
the test run. Environment settings are read when the runtime is imported.

| Variable                     | Purpose                                                                                                |
| ---------------------------- | ------------------------------------------------------------------------------------------------------ |
| `VIDEO_SUBTITLES=true`       | Enables the reporter in the configuration above; the library does not register it automatically.       |
| `CAPTION_PACE_MS`            | Pause after each emitted caption. Set to `0` for no pacing.                                            |
| `CAPTION_TYPING_DURATION_MS` | Requested typing delay budget for each non-empty `.fill()` in a marked step, plus browser overhead. Set to `0` for normal fills. |
| `VIDEO_RECORDING_STARTED_AT` | Epoch milliseconds captured immediately before recording begins, used to align subtitles and chapters. |

Action captions are enabled when `CAPTION_PACE_MS` is positive. Marked business
steps and named expectations can still emit subtitles with pacing set to zero;
their cue duration defaults to the reporter's `testTitleDurationMs` (3,000 ms).
The runtime adds 120 seconds to the test timeout when pacing is enabled.

## Custom fixtures

Extend your fixtures first, then wrap their `test` and `expect` APIs. This preserves
custom fixture and matcher types:

```ts
import { test as baseTest, expect as baseExpect } from '@playwright/test';
import { configureVideoCaptions, createVideoCaptionTest } from 'video-captions';

const fixtures = baseTest.extend<{ username: string }>({ username: 'admin' });
export const { test, expect } = createVideoCaptionTest(fixtures, baseExpect);

test.beforeEach(({ page }, testInfo) => {
  configureVideoCaptions(page, testInfo);
});
```

Import the wrapped APIs in your specs. If you call `test.extend()` or
`expect.extend()` later, wrap the resulting APIs again.

### Migrating tests that use existing fixtures and expectations

The default `test` and `expect` exports from `video-captions` wrap
`@playwright/test`. If your tests already import these APIs from a fixture module
or a shared testing package, wrap those existing exports to preserve their
fixtures, hooks, and custom matchers.

Create a module that adds caption support to your existing test setup:

```ts
// video-fixtures.ts
import {
  test as baseTest,
  expect as baseExpect,
} from './fixtures'; // Your existing fixture module or shared testing package.
import { configureVideoCaptions, createVideoCaptionTest } from 'video-captions';

export const { test, expect } = createVideoCaptionTest(baseTest, baseExpect);

test.beforeEach(({ page }, testInfo) => {
  configureVideoCaptions(page, testInfo);
});
```

Update your specs to import both wrapped APIs from the new module:

```ts
import { test, expect } from './video-fixtures';
import { frameForCaption } from 'video-captions';
```

Passing only `baseTest` preserves its fixtures but uses standard Playwright's
`expect`; pass `baseExpect` as well to preserve your existing expectations.
Use the wrapped `test` for marked steps and the wrapped `expect` for named
expectation captions. Your existing fixture setup and test assertions can remain
in place.

## Write a captioned step

Mark a `test.step` with `{ params: { videoCaption: true } }` for one meaningful,
reviewer-facing business outcome. Put the UI actions that produce that outcome
and the checks that verify it in the same block. Do not use it for setup,
navigation, cleanup, or a single click.

Import the helpers from the caption framework:

```ts
import { expect, frameForCaption, test } from 'video-captions';
```

Use this `test` export for marked steps so the runtime can scope action and
expectation captions to their callbacks.

The recommended form has one named, final expectation. Its message says what
is already visible on screen after the action succeeds:

```ts
await test.step(
  'Create the administrator user',
  async () => {
    await page.getByRole('button', { name: 'Create user' }).click();
    await page.getByRole('textbox', { name: 'User name' }).fill('admin');
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'admin', exact: true }),
      'The newly created administrator user is listed',
    ).toBeVisible();
  },
  { params: { videoCaption: true } },
);
```

The example produces yellow captions for the button click and text entry, then
a green caption—“The newly created administrator user is listed”—once the final
assertion passes. Each caption remains visible for `CAPTION_PACE_MS`.

When the final assertion's target may be off-screen, call
`frameForCaption(locator)` immediately before it. During paced recordings this
centers the element and checks that it is in the viewport; normal runs are
unchanged. For a disappearance assertion, frame a nearby surviving element.

## Caption rules

| Code                                                                    | Caption                                 | Colour | Timing                      |
| ----------------------------------------------------------------------- | --------------------------------------- | ------ | --------------------------- |
| `.click()`, `.check()`, `.uncheck()`, or `.fill()` inside a marked step | The action and accessible control label | Yellow | After the interaction       |
| `expect(value, 'message')` inside a marked step                         | The custom expectation message          | Green  | After the assertion passes  |
| A marked step with no named expectation                                 | The step title                          | Green  | After the callback succeeds |
| Any action or expectation outside a marked step                         | None                                    | —      | No caption or added delay   |

For a named expectation to produce a caption, import `expect` from
`video-captions` or use the `expect` returned by `createVideoCaptionTest`.
Unnamed expectations are still normal checks, but do not create a caption.
Always await a named expectation so its caption finishes before the next action
or test starts. For synchronous matchers such as `toMatchObject`, use
`await Promise.resolve(expect(value, 'message').toMatchObject(expected))` because
Playwright types the matcher as returning `void` while the caption wrapper
returns a promise.

### More than one named expectation

Every named expectation inside a marked step produces its own green caption
and its own pacing delay, in the order in which the expectations pass. The
business-step fallback caption is not added when at least one named expectation
is present.

Use multiple named expectations only when each one verifies a distinct state a
reviewer should have time to inspect. Usually, keep intermediate checks
unnamed and give only the final, durable result a message. This keeps the video
concise and ensures the final caption describes the state that remains on
screen.

```ts
await test.step(
  'Create the administrator user',
  async () => {
    await page.getByRole('button', { name: 'Create user' }).click();
    await expect(dialog).toBeVisible(); // Check only: no caption.
    // …complete the dialog…
    await expect(userRow, 'The newly created administrator user is listed').toBeVisible();
  },
  { params: { videoCaption: true } },
);
```

## Chapters

The reporter creates one chapter for every executed test and uppercase,
Markdown-style chapter markers for each enclosing `test.describe` group. MP4
chapters are flat, so group markers are offset by one millisecond per nesting
level before the first child; this avoids FFmpeg collapsing same-timestamp
parent markers into zero-duration chapters.

To burn subtitles into an externally recorded video and attach chapters with FFmpeg:

```sh
ffmpeg -i recordings/raw.mp4 -i recordings/e2e.ffmetadata \
  -map 0 -map_metadata 1 -map_chapters 1 \
  -vf "ass=recordings/e2e.ass" -c:v libx264 -c:a copy recordings/captioned.mp4
```

## API

| Export | Purpose |
| --- | --- |
| `test`, `expect` | Standard Playwright APIs with scoped caption support. |
| `createVideoCaptionTest(test, expect?)` | Wrap an existing Playwright fixture and optionally its custom expectations. |
| `configureVideoCaptions(page, testInfo)` | Install interaction captions and slow typing from a `beforeEach` hook. |
| `frameForCaption(locator)` | Center an element before a caption during paced marked steps. |
| `VideoSubtitlesReporter` | Reporter constructor; also the default export of `video-captions/reporter`. |
| `SubtitleReporterOptions` | Type with required `outputFile`, `chapterFile`, and optional `testTitleDurationMs`. |
| `enableSlowTyping(page, durationMs, shouldTypeSlowly)` | Install the low-level scoped typing helper. |

```js
const { configureVideoCaptions, test, expect } = require('video-captions');
```

## Development and publishing

```sh
npm ci
npm test
npm run typecheck
npm pack --dry-run
npm publish
```

`npm test` covers reporter output, both module formats, and real Playwright
runner integration using simulated locators; it requires no browser download.
`npm pack` and `npm publish` build the package automatically. Publishing requires
an npm account authorized to publish `video-captions`.

TypeScript uses `NodeNext` to emit ESM JavaScript and declarations. Vite's library
build emits CommonJS from the same sources, keeping Playwright and Node builtins
external. Both formats include declarations and source maps. Run `npm run build`
to build the package. The `ES2022` target supports the package's Node.js 20 minimum;
development with Vite requires Node.js 20.19+ or 22.12+ (CI uses Node.js 24).

### Publishing to GitHub Packages

The `Publish GitHub package` workflow runs when a GitHub release is published or
when started manually from the Actions tab. It installs dependencies, runs tests
and type checks, builds a tarball, saves it as the `video-captions-package`
workflow artifact, and publishes that same tarball to GitHub Packages.

GitHub Packages requires a scoped name. The workflow publishes
`@owner/video-captions`, where `owner` is the repository owner's lowercase name.
It sets the package's repository URL and registry in the workflow checkout; the
source package remains named `video-captions` for npmjs publishing. Authentication
uses the workflow's `GITHUB_TOKEN` with `packages: write`, so no additional
publishing secret is needed. Update the version in `package.json` and
`package-lock.json` before publishing a new version; published versions cannot
be overwritten.

To install the GitHub package while keeping the imports in this README, configure
your consuming project's `.npmrc` (replace `owner` with the repository owner):

```ini
@owner:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
```

Set `NODE_AUTH_TOKEN` to a token authorized to read the package, then install it
under the `video-captions` alias:

```sh
npm install --save-dev video-captions@npm:@owner/video-captions
```

See [GitHub's npm registry documentation](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry)
for package access and installation authentication.

## License

Apache-2.0. See [LICENSE](LICENSE).
