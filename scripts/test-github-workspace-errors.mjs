import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd());
const core = fs.readFileSync(path.join(root, 'lib/github-workspace.ts'), 'utf8');
const extra = fs.readFileSync(path.join(root, 'lib/github-workspace-extra.ts'), 'utf8');
const ui = fs.readFileSync(path.join(root, 'public/github-workspace.ts'), 'utf8');

for (const code of ['GITHUB_NOT_CONFIGURED', 'GITHUB_REPO_NOT_ALLOWED', 'INVALID_GITHUB_REPOSITORY', 'INVALID_GITHUB_PATH', 'GITHUB_ENDPOINT_FAILED', 'INVALID_GITHUB_RESPONSE']) {
  assert.match(core + extra, new RegExp(code));
}
assert.match(ui, /AUTH_REQUIRED/);
assert.match(ui, /GITHUB_CONTENT_CREDENTIAL_BLOCKED/);
assert.match(ui, /GITHUB_PATH_NOT_FILE/);
assert.match(ui, /statusLine\.textContent/);
console.log('github-workspace-errors: ok');
