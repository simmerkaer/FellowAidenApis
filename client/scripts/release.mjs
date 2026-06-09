#!/usr/bin/env node
/**
 * One-step release helper.
 *
 *   npm run release            # patch: 0.1.1 -> 0.1.2
 *   npm run release -- minor   # 0.1.1 -> 0.2.0
 *   npm run release -- major   # 0.1.1 -> 1.0.0
 *
 * Bumps client/package.json, commits, creates a `vX.Y.Z` tag, and pushes.
 * Pushing the tag triggers .github/workflows/release.yml, which publishes to
 * npm via trusted publishing (OIDC).
 *
 * This exists because `npm version` only auto-commits/tags at the git root,
 * and this package lives in a subdirectory.
 */
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const ALLOWED = ['patch', 'minor', 'major'];
const bump = process.argv[2] ?? 'patch';

if (!ALLOWED.includes(bump)) {
  console.error(`Usage: npm run release -- [${ALLOWED.join('|')}]  (default: patch)`);
  process.exit(1);
}

const run = (cmd) => execSync(cmd, { stdio: 'inherit' });
const capture = (cmd) => execSync(cmd, { encoding: 'utf8' }).trim();

// Refuse to release from a dirty tree (git reports repo-wide status).
if (capture('git status --porcelain')) {
  console.error('✖ Working tree is not clean. Commit or stash your changes first.');
  process.exit(1);
}

// 1. Bump the version only (no git side effects from npm).
run(`npm version ${bump} --no-git-tag-version`);

const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)));
const tag = `v${version}`;

// 2. Commit the bump, tag it, and push (git resolves the repo root from here).
run('git add package.json package-lock.json');
run(`git commit -m "Release ${tag}"`);
run(`git tag -a ${tag} -m "${tag}"`);
run('git push --follow-tags');

console.log(`\n✓ Pushed ${tag}. The release workflow will publish ${version} to npm.`);
