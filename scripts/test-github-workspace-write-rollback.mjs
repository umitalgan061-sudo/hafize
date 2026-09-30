import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve(process.cwd());
const doc=fs.readFileSync(path.join(root,'docs/GITHUB_WRITE_ROLLBACK.md'),'utf8');
const writer=fs.readFileSync(path.join(root,'lib/github-workspace-write.ts'),'utf8');

assert.match(doc,/PR revert/);
assert.match(doc,/force-push/);
assert.match(doc,/sessionStorage/);
assert.match(doc,/Ticketlar server memory/);
assert.match(writer,/GITHUB_DEFAULT_BRANCH_BLOCKED/);
assert.doesNotMatch(writer,/git\/refs\/.*DELETE/);
assert.doesNotMatch(writer,/git\/refs\/.*force/);
console.log('github-workspace-write-rollback: ok');
