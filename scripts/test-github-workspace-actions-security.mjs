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
assert.match(source, /\^https:\\\/\\\/github\\\.com\\\//, 'external links are allowlisted to github.com');
assert.match(source, /anchor\.rel = 'noopener noreferrer'/, 'external links drop the opener');
assert.match(source, /if \(safeGithubUrl\(link\)\)/, 'an un-allowlisted url renders no anchor at all');
console.log('github-workspace-actions-security: ok');
