import assert from 'node:assert/strict';
import fs from 'node:fs';

const fill = fs.readFileSync('public/prompt-library-fill.js', 'utf8');
const historyUi = fs.readFileSync('public/prompt-library-fill-history-ui.js', 'utf8');
const sessionUi = fs.readFileSync('public/prompt-library-fill-session-ui.js', 'utf8');
const copy = fs.readFileSync('public/prompt-library-fill-copy.js', 'utf8');
const privacy = fs.readFileSync('public/prompt-library-fill-privacy.js', 'utf8');
const defaults = fs.readFileSync('public/prompt-library-fill-defaults.js', 'utf8');

const journey = [
  ['Alanları doldur', fill],
  ['promptLibraryFillDialog', fill],
  ['dataset.promptId', fill],
  ['messageInput', fill],
  ['dispatchEvent(new Event(\'input\'', fill],
  ['useCount', fill],
  ['history().record', historyUi],
  ['Bu oturumda hatırla', sessionUi],
  ['Önizlemeyi kopyala', copy],
  ['Tüm smart-fill verisini temizle', privacy],
  ['Varsayılanları uygula', defaults]
];
for (const [contract, source] of journey) assert.ok(source.includes(contract), `missing user-flow contract: ${contract}`);

assert.ok(fill.indexOf('composer.value') < fill.indexOf('updateUsage'));
assert.ok(fill.indexOf('updateUsage') < fill.indexOf('closeDialog'));
assert.ok(historyUi.indexOf('history().connect') < historyUi.indexOf('history().record'));
assert.ok(sessionUi.includes('session().set'));
assert.ok(sessionUi.includes('session().clear'));
assert.ok(privacy.includes('confirm'));
assert.ok(defaults.includes('input.value'));
assert.doesNotMatch(fill, /form\.submit\s*\(/i);
assert.doesNotMatch(copy, /fetch\s*\(/);
assert.doesNotMatch(historyUi, /fetch\s*\(/);
console.log('smart fill end-to-end user flow: ok');
