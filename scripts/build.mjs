import { execFileSync } from 'node:child_process';
import { copyFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const root = fileURLToPath(new URL('../', import.meta.url));
const compiler = fileURLToPath(new URL('../node_modules/typescript/bin/tsc', import.meta.url));
rmSync(new URL('../dist/', import.meta.url), { recursive: true, force: true });
execFileSync(process.execPath, [compiler, '--project', 'tsconfig.json'], { cwd: root, stdio: 'inherit' });

await build({ root, configFile: fileURLToPath(new URL('../vite.config.mjs', import.meta.url)) });

// Both formats expose the same API. Node interprets declarations in this
// directory as CommonJS according to its package.json.
for (const filename of readdirSync(new URL('../dist/esm/', import.meta.url))) {
  if (filename.endsWith('.d.ts')) {
    copyFileSync(new URL(`../dist/esm/${filename}`, import.meta.url), new URL(`../dist/cjs/${filename}`, import.meta.url));
  }
}
writeFileSync(new URL('../dist/cjs/package.json', import.meta.url), '{"type":"commonjs"}\n');
