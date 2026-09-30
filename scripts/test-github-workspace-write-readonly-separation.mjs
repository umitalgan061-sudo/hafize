import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve(process.cwd());
const reader=fs.readFileSync(path.join(root,'lib/github-workspace.ts'),'utf8');
const writer=fs.readFileSync(path.join(root,'lib/github-workspace-write.ts'),'utf8');
const readUi=fs.readFileSync(path.join(root,'public/github-workspace.ts'),'utf8');

assert.match(reader,/method: 'GET'/);
assert.doesNotMatch(reader,/method: 'POST'/);
assert.match(writer,/method,/);
assert.match(writer,/createBranch/);
assert.match(writer,/commitFile/);
assert.match(writer,/createPullRequest/);
assert.doesNotMatch(writer,/DELETE/);
assert.doesNotMatch(writer,/force-push/);
assert.match(readUi,/salt okunur/);
console.log('github-workspace-write-readonly-separation: ok');
