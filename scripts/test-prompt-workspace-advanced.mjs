import assert from 'node:assert/strict';
import fs from 'node:fs';

const workspace = fs.readFileSync('public/prompt-library-workspaces.js', 'utf8');
const builder = fs.readFileSync('public/prompt-library-pack-builder.js', 'utf8');
const batch = fs.readFileSync('public/prompt-library-batch-editor.js', 'utf8');
const review = fs.readFileSync('public/prompt-library-import-review.js', 'utf8');
const audit = fs.readFileSync('public/prompt-library-audit.js', 'utf8');
const dashboard = fs.readFileSync('public/prompt-library-dashboard.js', 'utf8');

assert.match(workspace, /function snapshotSelected/);
assert.match(workspace, /function serializePack/);
assert.match(workspace, /function importPack/);
assert.match(workspace, /MAX_PAYLOAD\s*=\s*180_000/);
assert.match(builder, /function build\(/);
assert.match(builder, /includeCollections/);
assert.match(builder, /includeWorkspaces/);
assert.match(builder, /includeRevisions/);
assert.match(batch, /function apply\(/);
assert.match(batch, /MAX_SELECTION\s*=\s*40/);
assert.match(review, /function inspect\(/);
assert.match(review, /function readAndInspect\(/);
assert.match(audit, /function audit\(/);
assert.match(dashboard, /function summary\(/);

for (const source of [workspace, builder, batch, review, audit, dashboard]) {
  assert.equal(/console\.log|console\.error/.test(source), false, 'UI modules should not log prompt data');
}
console.log('prompt workspace advanced regression: ok');
