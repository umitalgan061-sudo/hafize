import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve(process.cwd());
const ui=fs.readFileSync(path.join(root,'public/github-workspace-write.ts'),'utf8');
const css=fs.readFileSync(path.join(root,'public/github-workspace-write.css'),'utf8');
const audit=fs.readFileSync(path.join(root,'docs/GITHUB_WRITE_AUDIT.md'),'utf8');

assert.match(ui,/HISTORY_KEY = 'hafize\.github-workspace-write\.v1'/);
assert.match(ui,/HISTORY_MAX = 12/);
assert.match(ui,/sessionStorage\.getItem\(HISTORY_KEY\)/);
assert.match(ui,/sessionStorage\.setItem\(HISTORY_KEY/);
assert.match(ui,/safeHistoryJson/);
assert.match(ui,/copyWriteHistory\(visible\)/);
assert.match(ui,/content, commit body, token/i);
assert.match(css,/github-write-history-filter/);
assert.match(audit,/file content/);
assert.match(audit,/approval ticket/);
console.log('github-workspace-write-history: ok');
