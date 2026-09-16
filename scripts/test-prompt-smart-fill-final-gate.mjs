import assert from 'node:assert/strict';
import fs from 'node:fs';

const sources = [
  'public/prompt-library-fill.js',
  'public/prompt-library-fill-presets.js',
  'public/prompt-library-fill-backup.js',
  'public/prompt-library-fill-backup-ui.js',
  'public/prompt-library-fill-history.js',
  'public/prompt-library-fill-history-ui.js',
  'public/prompt-library-fill-history-backup.js',
  'public/prompt-library-fill-history-backup-ui.js',
  'public/prompt-library-fill-privacy.js',
  'public/prompt-library-fill-field-status.js',
  'public/prompt-library-fill-defaults.js',
  'public/prompt-library-fill-session.js',
  'public/prompt-library-fill-session-ui.js',
  'public/prompt-library-fill-copy.js',
  'public/prompt-library-fill-keyboard.js'
].map((file) => [file, fs.readFileSync(file, 'utf8')]);

for (const [file, source] of sources) {
  assert.ok(source.length > 100, `${file} unexpectedly small`);
  assert.doesNotMatch(source, /<script/i, `${file} inline script marker`);
  assert.doesNotMatch(source, /javascript:/i, `${file} javascript url`);
  assert.doesNotMatch(source, /document\.write\s*\(/, `${file} document.write`);
  assert.doesNotMatch(source, /eval\s*\(/, `${file} eval`);
}

const fill = Object.fromEntries(sources);
assert.match(fill['public/prompt-library-fill.js'], /data-prompt-id/);
assert.match(fill['public/prompt-library-fill.js'], /messageInput/);
assert.match(fill['public/prompt-library-fill.js'], /useCount/);
assert.match(fill['public/prompt-library-fill.js'], /showModal/);
assert.match(fill['public/prompt-library-fill-presets.js'], /MAX_PRESETS = 8/);
assert.match(fill['public/prompt-library-fill-backup.js'], /MAX_BYTES = 250000/);
assert.match(fill['public/prompt-library-fill-history.js'], /MAX_ENTRIES = 24/);
assert.match(fill['public/prompt-library-fill-history-backup.js'], /MAX_ENTRIES = 24/);
assert.match(fill['public/prompt-library-fill-privacy.js'], /Tüm smart-fill verisini temizle/);
assert.match(fill['public/prompt-library-fill-defaults.js'], /Güvenli varsayılanlar/);
assert.match(fill['public/prompt-library-fill-session.js'], /beforeunload/);
assert.match(fill['public/prompt-library-fill-session.js'], /Map/);
assert.match(fill['public/prompt-library-fill-session-ui.js'], /Bu oturumda hatırla/);
assert.match(fill['public/prompt-library-fill-copy.js'], /Önizlemeyi kopyala/);
assert.match(fill['public/prompt-library-fill-keyboard.js'], /enter/);
assert.match(fill['public/prompt-library-fill-keyboard.js'], /'r'/);

const css = fs.readFileSync('public/prompt-library-fill.css', 'utf8');
assert.match(css, /focus-visible/);
assert.match(css, /prefers-reduced-motion/);
assert.match(css, /forced-colors/);

const sw = fs.readFileSync('public/sw-policy.js', 'utf8');
for (const asset of ['prompt-library-fill.js','prompt-library-fill-presets.js','prompt-library-fill-history.js','prompt-library-fill-history-backup.js','prompt-library-fill-session-ui.js','prompt-library-fill-copy.js']) {
  assert.match(sw, new RegExp(asset));
}
assert.match(sw, /CURRENT_CACHE.*v40/);
assert.match(sw, /api\\//);
console.log('smart fill final gate: ok');
