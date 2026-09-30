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
// The sensitive-name denylist is one regex literal, so the contract is that
// pattern rather than a plain mention of the words.
for (const fragment of ['private[._-]?keys?', '\\.env', 'credentials?', 'secrets?', 'tokens?', '.(pem|key|p12|pfx)$']) {
  assert.ok(extra.includes(fragment), `sensitive-name denylist covers ${fragment}`);
}
console.log('github-workspace-paths: ok');
