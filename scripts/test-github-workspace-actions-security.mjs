import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd());
const source = fs.readFileSync(path.join(root, 'public/github-workspace-actions.ts'), 'utf8');

assert.match(source, /HISTORY_KEY/);
assert.match(source, /MAX_HISTORY = 6/);
assert.match(source, /sessionStorage/);
assert.match(source, /credentials: ['"]same-origin['"]/);
assert.match(source, /cache: ['"]no-store['"]/);
assert.doesNotMatch(source, /Authorization/);
assert.doesNotMatch(source, /GITHUB_TOKEN/);
assert.doesNotMatch(source, /method: ['"](POST|PATCH|DELETE)['"]/);
// The module gates every rendered link through one host test, written as a
// regex literal, so the contract is asserted against that exact guard.
assert.match(source, /function safeGithubUrl/);
assert.ok(
  source.includes(String.raw`/^https:\/\/github\.com\//i`),
  'rendered links stay restricted to https://github.com/'
);
console.log('github-workspace-actions-security: ok');
