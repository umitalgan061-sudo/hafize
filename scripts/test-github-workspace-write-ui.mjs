import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve(process.cwd());
const ui=fs.readFileSync(path.join(root,'public/github-workspace-write.ts'),'utf8');
const html=fs.readFileSync(path.join(root,'public/index.html'),'utf8');

assert.match(ui,/GitHub güvenli yazma/);
assert.match(ui,/Onayla ve yürüt/);
assert.match(ui,/Yazma önizlemesi/);
assert.match(ui,/github-workspace-write/);
assert.match(ui,/GITHUB_WRITE_APPROVAL_REQUIRED/);
assert.match(ui,/renderWriteHistory/);
assert.match(ui,/HISTORY_KEY/);
assert.match(ui,/HISTORY_MAX = 12/);
assert.match(ui,/sessionStorage/);
assert.doesNotMatch(ui,/localStorage\.setItem\(HISTORY_KEY/);
assert.match(html,/github-workspace-write\.css/);
assert.match(html,/typed-build\/github-workspace-write\.js/);
console.log('github-workspace-write-ui: ok');
