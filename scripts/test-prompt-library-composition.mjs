// Load order contract for the prompt library surfaces.
//
// The core module is its own Vite entry; starters, enhancements and the keyboard
// layer are bundled into the single legacy entry, so their relative order is now
// decided by the import order inside public/typed/legacy-app.ts. Both halves of
// the order still have to hold: the core API must exist before anything builds on
// it, and each layer must come after the one it extends.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { shellAssetForBrowserModule, assertModuleDelivered } from './shell-cache-contract.mjs';

const html = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const legacyEntry = fs.readFileSync(new URL('../public/typed/legacy-app.ts', import.meta.url), 'utf8');

for (const name of ['prompt-library', 'prompt-library-starters', 'prompt-library-enhancements', 'prompt-library-keyboard']) {
  assertModuleDelivered(name);
}

const coreAsset = shellAssetForBrowserModule('prompt-library');
const legacyAsset = shellAssetForBrowserModule('prompt-library-starters');
assert.notEqual(coreAsset, legacyAsset, 'the core module keeps its own entry');
assert.equal((html.match(new RegExp(`src="${coreAsset}"`, 'g')) || []).length, 1, 'the core entry is loaded exactly once');
assert.equal((html.match(new RegExp(`src="${legacyAsset}"`, 'g')) || []).length, 1, 'the legacy entry is loaded exactly once');
assert.ok(html.indexOf(`src="${coreAsset}"`) < html.indexOf(`src="${legacyAsset}"`), 'the core API loads before the layers built on it');

const starterIndex = legacyEntry.indexOf('./legacy/prompt-library-starters.ts');
const enhancementIndex = legacyEntry.indexOf('./legacy/prompt-library-enhancements.ts');
const keyboardIndex = legacyEntry.indexOf('./legacy/prompt-library-keyboard.ts');
assert.ok(starterIndex >= 0 && enhancementIndex >= 0 && keyboardIndex >= 0);
assert.ok(starterIndex < enhancementIndex, 'starters load before enhancements');
assert.ok(enhancementIndex < keyboardIndex, 'enhancements load before the keyboard layer');

console.log('test-prompt-library-composition: ok');
