import assert from 'node:assert/strict';
import fs from 'node:fs';

const files = {
  fill: fs.readFileSync('public/prompt-library-fill.js', 'utf8'),
  presets: fs.readFileSync('public/prompt-library-fill-presets.js', 'utf8'),
  backup: fs.readFileSync('public/prompt-library-fill-backup.js', 'utf8'),
  backupUi: fs.readFileSync('public/prompt-library-fill-backup-ui.js', 'utf8'),
  history: fs.readFileSync('public/prompt-library-fill-history.js', 'utf8'),
  historyUi: fs.readFileSync('public/prompt-library-fill-history-ui.js', 'utf8'),
  privacy: fs.readFileSync('public/prompt-library-fill-privacy.js', 'utf8'),
  status: fs.readFileSync('public/prompt-library-fill-field-status.js', 'utf8'),
  defaults: fs.readFileSync('public/prompt-library-fill-defaults.js', 'utf8'),
  session: fs.readFileSync('public/prompt-library-fill-session.js', 'utf8'),
  copy: fs.readFileSync('public/prompt-library-fill-copy.js', 'utf8'),
  usage: fs.readFileSync('public/prompt-library-usage.js', 'utf8'),
  sw: fs.readFileSync('public/sw-policy.js', 'utf8')
};

for (const [name, source] of Object.entries(files)) {
  assert.doesNotMatch(source, /eval\s*\(/, `${name}: eval`);
  assert.doesNotMatch(source, /new Function\s*\(/, `${name}: Function constructor`);
  assert.doesNotMatch(source, /XMLHttpRequest/, `${name}: xhr`);
  assert.doesNotMatch(source, /navigator\.sendBeacon/, `${name}: beacon`);
}

assert.match(files.fill, /data-prompt-id/);
assert.match(files.fill, /promptLibraryFillDialog/);
assert.match(files.fill, /messageInput/);
assert.match(files.fill, /dispatchEvent\(new Event\('input'/);
assert.match(files.fill, /useCount/);
assert.match(files.fill, /showModal/);
assert.match(files.fill, /aria-labelledby/);
assert.match(files.fill, /aria-label/);
assert.match(files.fill, /textContent/);
assert.match(files.fill, /MAX_VALUE = 1000/);

assert.match(files.presets, /MAX_PRESETS = 8/);
assert.match(files.presets, /MAX_NAME = 48/);
assert.match(files.presets, /MAX_VALUE = 1000/);
assert.match(files.presets, /safeValues/);
assert.match(files.presets, /savePreset/);
assert.match(files.presets, /deletePreset/);
assert.match(files.presets, /toLocaleLowerCase\('tr-TR'\)/);

assert.match(files.backup, /MAX_BYTES = 250000/);
assert.match(files.backup, /normalize/);
assert.match(files.backup, /merge/);
assert.match(files.backupUi, /Prompt-Preset/);
assert.match(files.backupUi, /Blob/);
assert.match(files.backupUi, /FileReader/);
assert.match(files.backupUi, /confirm/);

assert.match(files.history, /MAX_ENTRIES = 24/);
assert.match(files.history, /MAX_VALUES = 12/);
assert.match(files.history, /record/);
assert.match(files.history, /clearPrompt/);
assert.match(files.history, /deduplicated|JSON.stringify/);
assert.match(files.historyUi, /data-hafize-fill-history-ui/);
assert.match(files.historyUi, /history\(\)\.record/);

assert.match(files.privacy, /clearRemembered/);
assert.match(files.privacy, /clearPresets/);
assert.match(files.privacy, /clearAll/);
assert.match(files.privacy, /confirm/);
assert.match(files.status, /MAX_VALUE = 1000/);
assert.match(files.status, /aria-describedby/);
assert.match(files.defaults, /Güvenli varsayılanlar/);
assert.match(files.defaults, /Türkçe/);
assert.match(files.session, /MAX_PROMPTS = 30/);
assert.match(files.session, /Map\(\)/);
assert.match(files.copy, /navigator\?\.clipboard/);
assert.match(files.copy, /Önizlemeyi kopyala/);

for (const path of [
  '/prompt-library-fill.css',
  '/prompt-library-fill-history.css',
  '/prompt-library-fill.js',
  '/prompt-library-fill-presets.js',
  '/prompt-library-fill-keyboard.js',
  '/prompt-library-fill-backup.js',
  '/prompt-library-fill-backup-ui.js',
  '/prompt-library-fill-history.js',
  '/prompt-library-fill-history-ui.js',
  '/prompt-library-fill-privacy.js',
  '/prompt-library-fill-field-status.js',
  '/prompt-library-fill-defaults.js',
  '/prompt-library-fill-session.js',
  '/prompt-library-fill-copy.js'
]) assert.match(files.sw, new RegExp(path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));

for (const asset of ['prompt-library-fill.css','prompt-library-fill.js','prompt-library-fill-presets.js','prompt-library-fill-keyboard.js','prompt-library-fill-history.js','prompt-library-fill-privacy.js','prompt-library-fill-defaults.js','prompt-library-fill-session.js']) {
  assert.match(files.usage, new RegExp(asset.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
}

assert.match(files.sw, /CURRENT_CACHE.*v39/);
assert.match(files.sw, /pathname\.startsWith\('\/api\/'\)/);
console.log('smart fill extended contracts: ok');
