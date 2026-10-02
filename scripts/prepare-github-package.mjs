import { readFileSync, writeFileSync } from 'node:fs';

const repository = process.env.GITHUB_REPOSITORY;
if (!repository || !/^[\w.-]+\/[\w.-]+$/.test(repository)) {
  throw new Error('GITHUB_REPOSITORY must identify the publishing repository as owner/repo.');
}

const owner = repository.split('/')[0].toLowerCase();
const manifest = JSON.parse(readFileSync('package.json', 'utf8'));
manifest.name = `@${owner}/${manifest.name.split('/').at(-1)}`;
manifest.repository = {
  type: 'git',
  url: `git+https://github.com/${repository}.git`,
};
manifest.publishConfig = {
  ...manifest.publishConfig,
  registry: 'https://npm.pkg.github.com',
};

const lockfile = JSON.parse(readFileSync('package-lock.json', 'utf8'));
lockfile.name = manifest.name;
lockfile.packages[''].name = manifest.name;

writeFileSync('package.json', `${JSON.stringify(manifest, null, 2)}\n`);
writeFileSync('package-lock.json', `${JSON.stringify(lockfile, null, 2)}\n`);
console.log(`Prepared ${manifest.name}@${manifest.version} for ${manifest.publishConfig.registry}`);
