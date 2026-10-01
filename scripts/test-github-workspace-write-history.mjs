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
assert.match(ui,/content, commit body, token/i, 'the clipboard allowlist is documented');
const entryType = ui.slice(ui.indexOf('interface WriteHistoryEntry'), ui.indexOf('}', ui.indexOf('interface WriteHistoryEntry')));
for (const forbidden of ['content', 'body', 'token', 'ticket', 'approval']) {
  assert.ok(!new RegExp(`\\b${forbidden}\\??:`, 'i').test(entryType), `write history never stores ${forbidden}`);
}
const copyPayload = ui.slice(ui.indexOf('function safeHistoryJson'), ui.indexOf('async function copyWriteHistory'));
for (const allowed of ['action', 'repository', 'target', 'status', 'at']) {
  assert.ok(copyPayload.includes(`item.${allowed}`), `copied history keeps ${allowed}`);
}
assert.ok(!/\bdelete\b/.test(copyPayload), 'the copy payload is an allowlist, not a redaction pass');
assert.match(css,/github-write-history-filter/);
assert.match(audit,/file content/);
assert.match(audit,/approval ticket/);
console.log('github-workspace-write-history: ok');
