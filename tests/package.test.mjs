import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import * as esm from 'video-captions';
import * as runtime from 'video-captions/runtime';
import Reporter from 'video-captions/reporter';
import { enableSlowTyping } from 'video-captions/slow-typing';

test('ES modules expose the runtime, reporter, and slow typing entry points', () => {
  assert.equal(esm.test, runtime.test);
  assert.equal(esm.VideoSubtitlesReporter, Reporter);
  assert.equal(esm.enableSlowTyping, enableSlowTyping);
});

test('CommonJS consumers can require every public entry point', () => {
  const require = createRequire(import.meta.url);
  const cjs = require('video-captions');
  assert.equal(cjs.test, require('video-captions/runtime').test);
  assert.equal(cjs.VideoSubtitlesReporter, require('video-captions/reporter').default);
  assert.equal(cjs.enableSlowTyping, require('video-captions/slow-typing').enableSlowTyping);
  assert.equal(require('video-captions/package.json').name, 'video-captions');
});

test('source maps resolve to the shipped source files in both module formats', () => {
  for (const format of ['esm', 'cjs']) {
    const directory = new URL(`../dist/${format}/`, import.meta.url);
    for (const filename of readdirSync(directory, { recursive: true }).filter(name => name.endsWith('.js.map'))) {
      const mapUrl = new URL(filename, directory);
      const map = JSON.parse(readFileSync(mapUrl, 'utf8'));
      for (const source of map.sources) {
        assert.ok(source.endsWith('.ts'), `${format}/${filename} should map to TypeScript sources`);
        const path = resolve(fileURLToPath(new URL('.', mapUrl)), map.sourceRoot || '.', source);
        assert.ok(existsSync(path), `${format}/${filename} references missing source ${path}`);
      }
    }
  }
});
