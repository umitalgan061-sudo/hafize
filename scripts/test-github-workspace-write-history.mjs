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
// What matters is the serializer's allowlist, not a comment describing it: the
// copied history carries metadata only, never file content, commit bodies or
// credentials.
const serializer = ui.slice(ui.indexOf('function safeHistoryJson'), ui.indexOf('async function copyWriteHistory'));
for (const field of ['action', 'repository', 'target', 'status', 'at', 'reference']) {
  assert.match(serializer, new RegExp(`\\b${field}:`), `history keeps ${field}`);
}
for (const field of ['content', 'body', 'message', 'token', 'approval']) {
  assert.doesNotMatch(serializer, new RegExp(`\\b${field}:`), `history must not carry ${field}`);
}
assert.match(css,/github-write-history-filter/);
assert.match(audit,/file content/);
assert.match(audit,/approval ticket/);
console.log('github-workspace-write-history: ok');
