import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve(process.cwd());
const writer=fs.readFileSync(path.join(root,'lib/github-workspace-write.ts'),'utf8');

assert.match(writer,/MAX_REPOSITORY = 120/);
assert.match(writer,/MAX_REF = 200/);
assert.match(writer,/MAX_BRANCH = 200/);
assert.match(writer,/MAX_PATH = 400/);
assert.match(writer,/MAX_CONTENT = 96 \* 1024/);
assert.match(writer,/MAX_COMMIT_MESSAGE = 180/);
assert.match(writer,/MAX_PR_TITLE = 240/);
assert.match(writer,/MAX_PR_BODY = 4000/);
assert.match(writer,/MAX_APPROVALS = 1000/);
assert.match(writer,/APPROVAL_TTL_MS = 2 \* 60 \* 1000/);
assert.match(writer,/value\.length > MAX_CONTENT/);
assert.match(writer,/result\.length > max/);
console.log('github-workspace-write-boundaries: ok');
