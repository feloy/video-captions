import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import Reporter from 'video-captions/reporter';

function recording(t) {
  const directory = mkdtempSync(join(tmpdir(), 'video-captions-reporter-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const options = { outputFile: join(directory, 'nested/captions.ass'), chapterFile: join(directory, 'chapters.ffmetadata') };
  const reporter = new Reporter(options);
  reporter.onBegin();
  const suite = { type: 'describe', title: 'User management', parent: { type: 'file' } };
  const testcase = { title: 'Create a user', parent: suite };
  const result = { startTime: new Date(Date.now() + 100), duration: 1000, status: 'passed' };
  reporter.onTestBegin(testcase, result);
  const step = (title, extra = {}) => ({ title, category: 'test.step', startTime: result.startTime, duration: 50, steps: [], ...extra });
  return { reporter, testcase, result, step, subtitles: () => readFileSync(options.outputFile, 'utf8'), chapters: () => readFileSync(options.chapterFile, 'utf8') };
}

test('emits successful interaction and outcome cues with escaping, filtering other steps', t => {
  const { reporter, testcase, result, step, subtitles } = recording(t);
  for (const entry of [
    step('[video-action] Click Save'),
    step('[video-caption] Saved {admin}\nReady'),
    step('Fallback outcome', { params: { videoCaption: true } }),
    step('Suppressed fallback', { params: { videoCaption: true }, steps: [step('nested', { steps: [step('[video-caption] Named')] })] }),
    step('[video-caption] Failed', { error: { message: 'failure' } }),
    step('Unmarked'),
    step('[video-action] Internal', { category: 'pw:api' }),
  ]) reporter.onStepEnd(testcase, result, entry);
  reporter.onTestEnd(testcase, result);
  reporter.onEnd();
  const ass = subtitles();
  assert.equal(ass.split('\n').filter(line => line.startsWith('Dialogue:')).length, 6);
  assert.match(ass, /Interaction,,0,0,0,,Click Save/);
  assert.ok(ass.includes('Assertion,,0,0,0,,Saved \\{admin\\}\\NReady'));
  assert.match(ass, /Assertion,,0,0,0,,Fallback outcome/);
  assert.doesNotMatch(ass, /Suppressed fallback|Failed|Unmarked|Internal/);
});

test('aligns cue timestamps to the start of an external recording', t => {
  const previous = process.env.VIDEO_RECORDING_STARTED_AT;
  process.env.VIDEO_RECORDING_STARTED_AT = '10000';
  t.after(() => previous === undefined ? delete process.env.VIDEO_RECORDING_STARTED_AT : process.env.VIDEO_RECORDING_STARTED_AT = previous);
  const { reporter, testcase, result, step, subtitles } = recording(t);
  reporter.onStepEnd(testcase, result, step('[video-caption] Aligned', { startTime: new Date(11000), duration: 250 }));
  reporter.onEnd();
  assert.match(subtitles(), /Dialogue: 0,0:00:01\.25,0:00:04\.25,Assertion/);
});

test('writes nested group chapters, merges their ranges, and omits skipped tests', t => {
  const { reporter, testcase, result, chapters } = recording(t);
  testcase.parent = { type: 'describe', title: 'admins', parent: testcase.parent };
  reporter.onTestEnd(testcase, result);
  const next = { ...testcase, title: 'Delete = user; #1' };
  const nextResult = { ...result, startTime: new Date(result.startTime.valueOf() + 1500) };
  reporter.onTestBegin(next, nextResult);
  reporter.onTestEnd(next, nextResult);
  const skipped = { ...testcase, title: 'Skipped' };
  reporter.onTestBegin(skipped, result);
  reporter.onTestEnd(skipped, { ...result, status: 'skipped' });
  reporter.onEnd();
  const metadata = chapters();
  assert.ok(metadata.startsWith(';FFMETADATA1\n'));
  assert.equal(metadata.split('[CHAPTER]').length - 1, 4);
  assert.ok(metadata.includes('title=\\# USER MANAGEMENT'));
  assert.ok(metadata.includes('title=\\#\\# ADMINS'));
  assert.ok(metadata.includes('title=Delete \\= user\\; \\#1'));
  assert.doesNotMatch(metadata, /Skipped/);
  const starts = [...metadata.matchAll(/START=(\d+)/g)].map(match => Number(match[1]));
  assert.equal(starts[1] - starts[0], 1);
  assert.equal(starts[2] - starts[1], 1);
});

test('writes valid headers for an empty run', t => {
  const { reporter, subtitles, chapters } = recording(t);
  reporter.onEnd();
  assert.match(subtitles(), /\[Events\]/);
  assert.doesNotMatch(subtitles(), /Dialogue:/);
  assert.equal(chapters(), ';FFMETADATA1\n\n');
});
