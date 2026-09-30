import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve(process.cwd());
const writer=fs.readFileSync(path.join(root,'lib/github-workspace-write.ts'),'utf8');
const ui=fs.readFileSync(path.join(root,'public/github-workspace-write.ts'),'utf8');

for(const forbidden of [
  'mergePullRequest',
  'deleteBranch',
  'forcePush',
  'deleteFile'
]) assert.doesNotMatch(writer,new RegExp(forbidden));
assert.doesNotMatch(ui,/merge/i);
assert.match(writer,/GITHUB_DEFAULT_BRANCH_BLOCKED/);
assert.match(writer,/GITHUB_WORKFLOW_PATH_BLOCKED/);
console.log('github-workspace-write-no-destructive: ok');
