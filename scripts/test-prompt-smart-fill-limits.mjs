import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const text = fs.readFileSync(path.join(process.cwd(), 'public/prompt-library-smart-fill.ts'), 'utf8');

assert.match(text, /MAX_VALUE = 1000/);
assert.match(text, /MAX_VARIABLES = 12/);
assert.match(text, /MAX_PRESETS = 6/);
assert.match(text, /MAX_NAME = 60/);
assert.match(text, /MAX_PREVIEW = 8000/);
assert.match(text, /input\.maxLength = MAX_VALUE/);

// The limits are asserted through the module instead of through the spelling of
// each `slice(...)` call, so sharing one clamp helper stays a free refactor
// while a widened bound still fails the suite.
const memory = new Map();
globalThis.localStorage = {
  getItem: (key) => (memory.has(key) ? memory.get(key) : null),
  setItem: (key, value) => { memory.set(key, String(value)); },
  removeItem: (key) => { memory.delete(key); }
};
// Variable extraction lives in the prompt library core, which smart fill reads
// off the same global the browser gives it.
globalThis.HafizePromptLibrary = require('../public/prompt-library.js');
// Smart Fill ships as an ES module written in TypeScript, so it is imported
// from its source instead of required from a bundled build output.
await import('../public/prompt-library-smart-fill.ts');
const smartFill = globalThis.HafizePromptLibrarySmartFill;
assert.ok(smartFill, 'smart fill exposes its API on the global');

const promptId = 'limit-prompt';
const oversizedValues = Object.fromEntries(
  Array.from({ length: 30 }, (_, index) => [`değişken${index}`, 'x'.repeat(4000)])
);
smartFill.writePresets(promptId, Array.from({ length: 20 }, (_, index) => ({
  id: `preset-${index}`,
  name: 'ad'.repeat(200),
  values: oversizedValues
})));

const presets = smartFill.readPresets(promptId);
assert.equal(presets.length, 6, 'at most MAX_PRESETS presets are kept per prompt');
for (const preset of presets) {
  assert.equal(preset.name.length, 60, 'preset names are clamped to MAX_NAME');
  const entries = Object.entries(preset.values);
  assert.equal(entries.length, 12, 'at most MAX_VARIABLES values are kept per preset');
  for (const [name, value] of entries) {
    assert.ok(name.length <= 32, 'variable names stay within their own bound');
    assert.equal(value.length, 1000, 'variable values are clamped to MAX_VALUE');
  }
}

const body = Array.from({ length: 30 }, (_, index) => `{{alan${index}}}`).join(' ');
assert.equal(smartFill.variableNames(body).length, 12, 'a prompt exposes at most MAX_VARIABLES fields');
assert.deepEqual(smartFill.variableNames('{{tekrar}} {{tekrar}}'), ['tekrar'], 'repeated variables render one field');

// A hostile or corrupted store never escalates past an empty preset list.
memory.set(`hafize.prompt-library.smart-fill.v1.${promptId}`, '{"not":"an array"}');
assert.deepEqual(smartFill.readPresets(promptId), []);
memory.set(`hafize.prompt-library.smart-fill.v1.${promptId}`, 'kırık json');
assert.deepEqual(smartFill.readPresets(promptId), []);

console.log('prompt smart-fill limits: ok');
