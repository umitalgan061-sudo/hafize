import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd());
const browserFiles = [
  'public/github-workspace.ts',
  'public/github-workspace-extra.ts',
  'public/github-workspace-actions.ts',
  'public/github-workspace-details.ts'
].map((name) => fs.readFileSync(path.join(root, name), 'utf8')).join('\n');
const serverFiles = [
  'server.ts',
  'lib/github-workspace.ts',
  'lib/github-workspace-extra.ts',
  'lib/github-workspace-details.ts'
].map((name) => fs.readFileSync(path.join(root, name), 'utf8')).join('\n');

assert.doesNotMatch(browserFiles, /Authorization\s*:/);
assert.doesNotMatch(browserFiles, /GITHUB_TOKEN/);
assert.match(serverFiles, /Authorization: 'Bearer '/);
console.log('github-workspace-token-boundary: ok');
