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
// The sensitive-name guard is a regex literal; assert its source text.
assert.ok(extra.includes('private[._-]?keys?'), 'private key names are blocked');
assert.ok(extra.includes('\\.(pem|key|p12|pfx)$'), 'key file extensions are blocked');
console.log('github-workspace-paths: ok');
