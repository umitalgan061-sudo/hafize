import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve(process.cwd());
const writer=fs.readFileSync(path.join(root,'lib/github-workspace-write.ts'),'utf8');

assert.match(writer,/createdRef/);
assert.match(writer,/commitSha/);
assert.match(writer,/commitUrl/);
assert.match(writer,/htmlUrl/);
assert.match(writer,/number/);
assert.match(writer,/title/);
assert.match(writer,/head/);
assert.match(writer,/base/);
assert.doesNotMatch(writer,/response\.body/);
assert.doesNotMatch(writer,/response\.headers/);
assert.match(writer,/safeResponseRecord/);
console.log('github-workspace-write-response-contract: ok');
