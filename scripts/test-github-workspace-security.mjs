import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd());
const core = fs.readFileSync(path.join(root, 'lib/github-workspace.ts'), 'utf8');
const reader = fs.readFileSync(path.join(root, 'lib/github-read.ts'), 'utf8');
const guard = fs.readFileSync(path.join(root, 'lib/production-guard.ts'), 'utf8');
const ui = fs.readFileSync(path.join(root, 'public/github-workspace.ts'), 'utf8');

assert.match(core, /allowedRepositories/);
assert.match(core, /method: 'GET'/);
assert.doesNotMatch(core, /method: ['"]POST['"]/);
assert.doesNotMatch(core, /method: ['"]PATCH['"]/);
assert.doesNotMatch(core, /method: ['"]DELETE['"]/);
assert.match(reader, /SENSITIVE_FILE_PATTERNS/);
assert.match(reader, /containsPlaintextCredential/);
assert.match(guard, /\/api\/github\/workspace/);
assert.match(guard, /protectedPath/);
assert.doesNotMatch(ui, /GITHUB_TOKEN/);
assert.doesNotMatch(ui, /Authorization/);
assert.match(ui, /credentials: ['"]same-origin['"]/);
console.log('github-workspace-security: ok');
