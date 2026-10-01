import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd());
const core = fs.readFileSync(path.join(root, 'lib/github-workspace.ts'), 'utf8');
const extra = fs.readFileSync(path.join(root, 'lib/github-workspace-extra.ts'), 'utf8');
for (const source of [core, extra]) {
  assert.match(source, /MAX_REPOSITORY = 120/);
  assert.match(source, /MAX_REF = 200/);
  assert.match(source, /MAX_PATH = 400/);
  assert.match(source, /segment === '\.\.'/);
  assert.match(source, /startsWith\('\/'\)/);
  assert.match(source, /includes\('\\\\'\)/);
}
assert.ok(
  extra.includes('private[._-]?keys?'),
  'directory listing filters private-key filenames'
);
for (const token of ['\\.env', 'credentials?', 'secrets?', 'tokens?', 'pem|key|p12|pfx']) {
  assert.ok(extra.includes(token), `directory listing filters sensitive files: ${token}`);
}
console.log('github-workspace-paths: ok');
