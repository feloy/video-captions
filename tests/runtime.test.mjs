import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

for (const pace of [0, 10]) {
  test(`real Playwright runtime and reporter integrate with pacing ${pace}`, t => {
    const directory = mkdtempSync(join(tmpdir(), 'video-captions-runtime-'));
    t.after(() => rmSync(directory, { recursive: true, force: true }));
    execFileSync(process.execPath, [fileURLToPath(new URL('../node_modules/@playwright/test/cli.js', import.meta.url)), 'test', '--config', 'tests/playwright.config.mjs'], {
      cwd: fileURLToPath(new URL('../', import.meta.url)),
      env: { ...process.env, CAPTION_TEST_OUTPUT: directory, CAPTION_PACE_MS: String(pace), CAPTION_TYPING_DURATION_MS: pace ? '12' : '0', VIDEO_RECORDING_STARTED_AT: String(Date.now()) },
      timeout: 30000,
      stdio: 'pipe',
      encoding: 'utf8',
    });
    const ass = readFileSync(join(directory, 'captions.ass'), 'utf8');
    assert.match(ass, /Administrator created/);
    assert.match(ass, /Administrator remains visible/);
    assert.match(ass, /Fallback business caption/);
    assert.doesNotMatch(ass, /,,Business outcome\n|Unmarked expectation|Failed expectation caption|,,Failed business caption\n/);
    if (pace) {
      assert.match(ass, /Click Save/);
      assert.match(ass, /Select Save/);
      assert.match(ass, /Clear Save/);
      assert.match(ass, /Enter text in Save/);
    } else {
      assert.doesNotMatch(ass, /Interaction,,0,0,0,,/);
    }
  });
}
