import fs from 'node:fs';
import assert from 'node:assert/strict';

const files = [
  'public/typed/app-shell.ts',
  'public/typed/response-variants.ts',
  'public/typed/response-variants-ui.ts',
  'public/typed/response-regeneration-options.ts',
  'public/typed/response-regeneration-options-ui.ts',
  'public/typed/response-variants.test.ts',
  'public/typed/response-variants-ui.test.ts',
  'public/styles.css',
  'README.md'
];

for (const file of files) assert.ok(fs.existsSync(file), 'missing file: ' + file);

const app = fs.readFileSync('public/typed/app-shell.ts', 'utf8');
const variants = fs.readFileSync('public/typed/response-variants.ts', 'utf8');
const options = fs.readFileSync('public/typed/response-regeneration-options.ts', 'utf8');
const variantsUi = fs.readFileSync('public/typed/response-variants-ui.ts', 'utf8');
const optionsUi = fs.readFileSync('public/typed/response-regeneration-options-ui.ts', 'utf8');
const css = fs.readFileSync('public/styles.css', 'utf8');
const readme = fs.readFileSync('README.md', 'utf8');

for (const token of [
  'regenerateAssistantMessage',
  'restorePreviousAssistantMessage',
  'setAssistantFeedback',
  'navigator.clipboard',
  'openResponseVariantDialog',
  'openRegenerationOptions',
  'buildRegenerationMessages'
]) assert.match(app, new RegExp(token));

for (const token of [
  'MAX_RESPONSE_ALTERNATES = 3',
  'normalizeResponseAlternates',
  'rememberResponseAlternate',
  'restoreLatestResponseAlternate',
  'selectResponseVariant'
]) assert.match(variants, new RegExp(token));

assert.match(options, /MAX_REGENERATION_INSTRUCTION = 600/);
assert.match(options, /REGENERATION_PRESETS/);
assert.match(options, /role: 'user'/);

assert.match(variantsUi, /role.*dialog/);
assert.match(variantsUi, /Bu yanıtı kullan/);
assert.doesNotMatch(variantsUi, /innerHTML/);

assert.match(optionsUi, /role.*dialog/);
assert.match(optionsUi, /Daha kısa/);
assert.match(optionsUi, /Özel yönerge/);

assert.match(css, /assistant-message-actions/);
assert.match(css, /response-variant-dialog/);
assert.match(css, /response-regeneration-options/);

assert.match(readme, /Yeniden üret/);
assert.match(readme, /Varyantlar/);
assert.match(readme, /Yönergeyle yeniden üret/);

const segment = app.slice(
  app.indexOf('async function regenerateAssistantMessage'),
  app.indexOf('function restorePreviousAssistantMessage')
);
assert.match(segment, /\/api\/chat/);
assert.match(segment, /\/api\/agent\/run/);
assert.doesNotMatch(segment, /https?:\/\//);
assert.doesNotMatch(segment, /sendBeacon/);
assert.doesNotMatch(segment, /addMessage\('user'/);

console.log('response regeneration final gate ok');
