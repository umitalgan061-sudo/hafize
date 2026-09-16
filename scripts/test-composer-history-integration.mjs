import assert from 'node:assert/strict';
import fs from 'node:fs';
import { assertVersionedCacheDeclaration } from './shell-cache-contract.mjs';
const files = {
  core: 'public/composer-history.js',
  panel: 'public/composer-history-panel.js',
  backup: 'public/composer-history-backup.js',
  settings: 'public/composer-history-settings.js',
  help: 'public/composer-history-help.js'
};
const source = Object.fromEntries(Object.entries(files).map(([key, file]) => [key, fs.readFileSync(file, 'utf8')]));
assert.match(source.core, /hafize\.composer-history\.v1/);
assert.match(source.core, /hafize\.composer-history\.settings\.v1/);
assert.match(source.core, /MAX_ITEMS = 40/);
assert.match(source.core, /MAX_TEXT = 12000/);
assert.match(source.core, /RETENTION_VALUES/);
assert.match(source.core, /mount: boot/);
assert.doesNotMatch(source.core, /HafizeComposerHistory\.mount\s*=/);
assert.match(source.core, /ArrowUp/);
assert.match(source.core, /ArrowDown/);
assert.match(source.core, /event\.isComposing/);
assert.match(source.core, /restoreDraft/);
assert.match(source.core, /submit/);
assert.match(source.panel, /composerHistoryPanel/);
assert.match(source.panel, /composerHistoryToggle/);
assert.match(source.panel, /Geçmiş/);
assert.match(source.panel, /Kullan/);
assert.match(source.panel, /Sil/);
assert.match(source.panel, /Escape/);
assert.match(source.backup, /MAX_IMPORT = 512000/);
assert.match(source.backup, /exportPayload/);
assert.match(source.backup, /importPayload/);
assert.match(source.backup, /Blob/);
assert.match(source.settings, /Gönderim geçmişini cihazda sakla/);
assert.match(source.settings, /Saklama limiti/);
assert.match(source.help, /Ctrl\/⌘ \+ Shift \+ H/);
assert.match(source.help, /↑ \/ ↓/);
for (const value of Object.values(source)) {
  assert.doesNotMatch(value, /innerHTML\s*=/);
  assert.doesNotMatch(value, /outerHTML/);
  assert.doesNotMatch(value, /fetch\s*\(/);
  assert.doesNotMatch(value, /XMLHttpRequest/);
}
const html = fs.readFileSync('public/index.html', 'utf8');
for (const asset of Object.keys(files).map((key) => `/${files[key].split('/').at(-1)}`)) assert.match(html, new RegExp(asset.replaceAll('/','\\/')));
const sw = fs.readFileSync('public/sw-policy.js', 'utf8');
for (const asset of Object.keys(files).map((key) => `/${files[key].split('/').at(-1)}`)) assert.match(sw, new RegExp(asset.replaceAll('/','\\/')));
assertVersionedCacheDeclaration(sw);
console.log('composer history integrated contract: ok');
