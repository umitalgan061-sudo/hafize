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
// The copied/stored history is a descriptor whitelist: it must never carry
// file content, the commit body or anything token-bearing.
const historySerializer = ui.slice(ui.indexOf('function safeHistoryJson'), ui.indexOf('async function copyWriteHistory'));
assert.ok(historySerializer.length > 0);
assert.doesNotMatch(historySerializer, /content|body|token|Authorization/i);
assert.match(ui, /file content, commit body and\n\/\/ token-bearing fields never reach the clipboard or session storage/);
assert.match(css,/github-write-history-filter/);
assert.match(audit,/file content/);
assert.match(audit,/approval ticket/);
console.log('github-workspace-write-history: ok');
