import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd());
const core = fs.readFileSync(path.join(root, 'lib/github-workspace.ts'), 'utf8');
const extra = fs.readFileSync(path.join(root, 'lib/github-workspace-extra.ts'), 'utf8');
const registry = fs.readFileSync(path.join(root, 'agents/registry.json'), 'utf8');

for (const source of [core, extra]) {
  assert.doesNotMatch(source, /method: ['"](POST|PUT|PATCH|DELETE)['"]/);
  assert.match(source, /method: 'GET'/);
}
assert.match(registry, /repo\.merge/);
assert.match(registry, /repo\.delete/);
assert.match(registry, /repo\.write_branch/);
assert.match(registry, /secretsNeverEnterAgentContext/);
console.log('github-workspace-readonly: ok');
