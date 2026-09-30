import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve(process.cwd());
const ui=fs.readFileSync(path.join(root,'public/github-workspace-write.ts'),'utf8');

assert.match(ui,/githubWriteTitle/);
assert.match(ui,/githubWriteHistoryTitle/);
assert.match(ui,/aria-labelledby/);
assert.match(ui,/aria-live/);
assert.match(ui,/setAttribute\('aria-label'/);
assert.match(ui,/focus/);
assert.match(ui,/button/);
assert.doesNotMatch(ui,/alert\(/);
console.log('github-workspace-write-accessibility: ok');
