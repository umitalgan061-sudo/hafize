import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync('public/typed/app-shell.ts', 'utf8');
const variants = fs.readFileSync('public/typed/response-variants.ts', 'utf8');
const variantUi = fs.readFileSync('public/typed/response-variants-ui.ts', 'utf8');
const options = fs.readFileSync('public/typed/response-regeneration-options.ts', 'utf8');
const optionsUi = fs.readFileSync('public/typed/response-regeneration-options-ui.ts', 'utf8');
const html = fs.readFileSync('public/index.html', 'utf8');
const readme = fs.readFileSync('README.md', 'utf8');

assert.match(app, /response-variants\.ts/);
assert.match(app, /response-variants-ui\.ts/);
assert.match(app, /response-regeneration-options-ui\.ts/);
assert.match(app, /response-regeneration-options\.ts/);

assert.match(variants, /MAX_RESPONSE_ALTERNATES = 3/);
assert.match(variants, /selectResponseVariant/);
assert.match(variants, /createGenerationSnapshot/);

assert.match(variantUi, /openResponseVariantDialog/);
assert.match(variantUi, /role.*dialog/);
assert.match(variantUi, /Bu yanıtı kullan/);

assert.match(options, /REGENERATION_PRESETS/);
assert.match(options, /MAX_REGENERATION_INSTRUCTION = 600/);
assert.match(options, /buildRegenerationMessages/);

assert.match(optionsUi, /openRegenerationOptions/);
assert.match(optionsUi, /Özel yönergeyle yeniden üret/);
assert.match(optionsUi, /aria-modal/);

assert.match(html, /typed-build\/app-shell\.js/);
assert.match(html, /typed-build\/prompt-library\.js/);

assert.match(readme, /Asistan yanıtı kontrolü/);
assert.match(readme, /Yönergeyle yeniden üret/);
assert.match(readme, /Varyantlar/);

const regeneration = app.slice(
  app.indexOf('async function regenerateAssistantMessage'),
  app.indexOf('function restorePreviousAssistantMessage')
);
assert.match(regeneration, /buildRegenerationMessages/);
assert.match(regeneration, /\/api\/chat/);
assert.match(regeneration, /\/api\/agent\/run/);
assert.match(regeneration, /saveConversations/);
assert.doesNotMatch(regeneration, /requestSubmit/);

console.log('response regeneration integration contract ok');
