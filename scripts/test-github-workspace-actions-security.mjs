import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('public/github-workspace-actions.ts', 'utf8');

assert.match(source, /HISTORY_KEY/);
assert.match(source, /MAX_HISTORY = 6/);
assert.match(source, /sessionStorage/);
assert.match(source, /credentials: ['"]same-origin['"]/);
assert.match(source, /cache: ['"]no-store['"]/);
assert.doesNotMatch(source, /Authorization/);
assert.doesNotMatch(source, /GITHUB_TOKEN/);
assert.doesNotMatch(source, /method: ['"](POST|PATCH|DELETE)['"]/);
assert.match(source, /safeGithubUrl/);

console.log('github-workspace-actions-security: ok');
