// The Smart Fill journey, asserted end to end on the shipped sources: a prompt
// with variables opens the panel, the preview follows what is typed, presets
// round-trip, and the filled prompt lands in the composer without being sent.
//
// The anchors are matched through `source-contract.mjs`, so a `function x()`
// that becomes a typed arrow constant keeps passing while a step that actually
// disappears still fails.
import assert from 'node:assert/strict';
import { assertAnchors, assertDeclaresFunction, callPattern, readSource } from './source-contract.mjs';

const smart = readSource('public/prompt-library-smart-fill.ts');
const palette = readSource('public/prompt-library-command-palette.ts');
const hints = readSource('public/prompt-library-smart-fill-hints.ts');
const index = readSource('public/index.html');

/* Opening: a `Kullan` click on a prompt with variables is intercepted -------- */

assertDeclaresFunction(smart, 'interceptUse', 'open flow declares interceptUse');
assertAnchors(smart, [
  ['use button lookup', callPattern('closest', "'.prompt-item-actions button'")],
  ['use button label', "textContent?.trim() !== 'Kullan'"],
  ['variable detection', 'variableNames(prompt.body)'],
  ['default click suppressed', 'event.preventDefault()'],
  ['library handler suppressed', 'event.stopImmediatePropagation()'],
  ['panel opens', 'openFor(prompt)']
], 'open flow');

/* Editing: every keystroke repaints the preview ----------------------------- */

assertDeclaresFunction(smart, 'renderPreview', 'preview flow declares renderPreview');
assertAnchors(smart, [
  ['current values', 'currentValues()'],
  ['core substitution', 'replaceVariables?.(activePrompt.body, values)'],
  ['preview text node', 'preview.textContent'],
  ['input listener', "input.addEventListener('input', renderPreview)"]
], 'preview flow');

/* Presets: saved variable sets round-trip through the prompt-scoped key ------ */

for (const name of ['presetSelectOptions', 'applyPreset', 'savePreset', 'clearPresets', 'renderPresetBar']) {
  assertDeclaresFunction(smart, name, `preset flow declares ${name}`);
}
assertAnchors(smart, [
  ['preset read', 'readPresets(activePrompt.id)'],
  ['preset write', 'writePresets(activePrompt.id'],
  ['preset bar repaint', 'renderPresetBar()'],
  ['preset value applied', 'found.values[name]']
], 'preset flow');

/* Insertion: the composer is filled, never submitted ------------------------ */

assertDeclaresFunction(smart, 'insertIntoComposer', 'insert flow declares insertIntoComposer');
assertAnchors(smart, [
  ['empty field guard', 'const missing = activeNames.filter'],
  ['empty field test', "(values[name] ?? '').trim().length === 0"],
  ['missing field warning', 'Doldurulmamış değişkenler:'],
  ['composer write', 'composer.value = text'],
  ['composer write bound', 'slice(0, MAX_PREVIEW)'],
  ['input event', "new Event('input', { bubbles: true })"],
  ['composer focus', 'composer.focus()'],
  ['panel closes', 'closeDialog()']
], 'insert flow');
assert.doesNotMatch(smart, /requestSubmit\s*\(/);
assert.doesNotMatch(smart, /\.submit\s*\(/);

/* The `/prompt` palette reaches the same prompts from the composer ---------- */

for (const name of ['onInput', 'move', 'render', 'insert']) {
  assertDeclaresFunction(palette, name, `palette flow declares ${name}`);
}
assertAnchors(palette, [
  ['slash trigger', /\.match\(\/\(\^\|\\s\)\\\/prompt/],
  ['selection reset', 'activeIndex = 0'],
  ['list repaint', 'render()'],
  ['enter selects', "event.key === 'Enter'"],
  ['escape closes', "event.key === 'Escape'"],
  ['insertion', 'insert(chosen)']
], 'palette flow');

/* Hints repaint with the panel ---------------------------------------------- */

assertDeclaresFunction(hints, 'paintSmartFillHints', 'hints declare paintSmartFillHints');
assert.match(hints, /nextElementSibling/);
assert.match(hints, /requestAnimationFrame/);

/* The page ships the whole feature, in a usable order ----------------------- */

for (const asset of [
  'prompt-library-smart-fill.css',
  'prompt-library-command-palette.css',
  '/typed-build/prompt-library-smart-fill.js',
  '/typed-build/prompt-library-command-palette.js',
  '/typed-build/prompt-library-smart-fill-hints.js'
]) assert.ok(index.includes(asset), `missing asset: ${asset}`);

assert.ok(index.indexOf('prompt-library.js') < index.indexOf('/typed-build/prompt-library-smart-fill.js'));
assert.ok(index.indexOf('/typed-build/prompt-library-smart-fill.js') < index.indexOf('/typed-build/prompt-library-command-palette.js'));
assert.ok(index.indexOf('/typed-build/prompt-library-command-palette.js') < index.indexOf('/typed-build/prompt-library-smart-fill-hints.js'));

/* Nothing in the feature talks to the network or writes raw HTML ------------ */

for (const source of [smart, palette, hints]) {
  assert.doesNotMatch(source, /fetch\s*\(/);
  assert.doesNotMatch(source, /XMLHttpRequest/);
  assert.doesNotMatch(source, /WebSocket/);
  assert.doesNotMatch(source, /navigator\.sendBeacon/);
  assert.doesNotMatch(source, /innerHTML\s*=/);
  assert.doesNotMatch(source, /outerHTML/);
}

console.log('prompt smart-fill user journey: ok');
