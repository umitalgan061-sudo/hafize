import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync('public/typed/app-shell.ts', 'utf8');
const variants = fs.readFileSync('public/typed/response-variants.ts', 'utf8');
const options = fs.readFileSync('public/typed/response-regeneration-options.ts', 'utf8');
const variantUi = fs.readFileSync('public/typed/response-variants-ui.ts', 'utf8');
const optionUi = fs.readFileSync('public/typed/response-regeneration-options-ui.ts', 'utf8');
const css = fs.readFileSync('public/styles.css', 'utf8');

const required = [
  'Yeniden üret',
  'Yönergeyle yeniden üret',
  'Varyantlar',
  'Kopyala',
  'setAssistantFeedback',
  'saveConversations'
];
for (const token of required) assert.match(app, new RegExp(token));

assert.match(variants, /MAX_RESPONSE_ALTERNATES = 3/);
assert.match(variants, /restoreLatestResponseAlternate/);
assert.match(variants, /selectResponseVariant/);
assert.match(options, /MAX_REGENERATION_INSTRUCTION = 600/);
assert.match(options, /REGENERATION_PRESETS/);
assert.match(variantUi, /aria-modal/);
assert.match(optionUi, /aria-modal/);
assert.match(css, /assistant-message-actions/);
assert.match(css, /response-variant-dialog/);
assert.match(css, /response-regeneration-options/);

const segment = app.slice(
  app.indexOf('async function regenerateAssistantMessage'),
  app.indexOf('function restorePreviousAssistantMessage')
);

assert.match(segment, /buildRegenerationMessages/);
assert.match(segment, /\/api\/chat/);
assert.match(segment, /\/api\/agent\/run/);
assert.doesNotMatch(segment, /requestSubmit/);
assert.doesNotMatch(segment, /https?:\/\//);
assert.doesNotMatch(segment, /sendBeacon/);
assert.doesNotMatch(segment, /WebSocket/);

console.log('response regeneration final audit ok');
