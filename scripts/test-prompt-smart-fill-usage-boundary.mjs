// Usage accounting boundary for the smart-fill dialog.
//
// The dialog intercepts the library's "Kullan" button and calls
// stopImmediatePropagation, so the library never runs its own use counter for a
// prompt that has variables. The dialog therefore has to record the use itself,
// and it must do that through the library API rather than by reaching into the
// usage insights module or by writing storage behind the library's back.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createStorage, loadBrowserApi, loadBrowserModule } from './browser-module-harness.mjs';

const root = process.cwd();
const smart = fs.readFileSync(path.join(root, 'public/prompt-library-smart-fill.js'), 'utf8');
const usage = fs.readFileSync(path.join(root, 'public/prompt-library-usage.js'), 'utf8');

// Both modules speak the same useCount field.
assert.match(usage, /useCount/);
assert.match(smart, /useCount/);
assert.match(smart, /items\.findIndex/);
assert.match(smart, /normalizeItem/);
assert.match(smart, /persist\(/, 'the updated list is written back');

// The dialog never couples to the insights module and never leaves the device.
assert.doesNotMatch(smart, /HafizePromptLibraryUsage/);
assert.doesNotMatch(smart, /fetch\s*\(/);
assert.doesNotMatch(smart, /navigator\.sendBeacon/);

// Behaviour: one recorded use increments exactly one prompt by exactly one.
function withLibrary(items) {
  const localStorage = createStorage();
  const { api: library } = loadBrowserApi('prompt-library.js', 'HafizePromptLibrary', { localStorage });
  library.saveItems(localStorage, items);
  const smartRoot = loadBrowserModule('prompt-library-smart-fill.js', {
    localStorage,
    HafizePromptLibrary: library,
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() { return true; }
  });
  return { library, localStorage, smartFill: smartRoot.HafizePromptLibrarySmartFill };
}

{
  const { library, localStorage, smartFill } = withLibrary([
    { id: 'a', title: 'A', body: 'merhaba {{konu}}' },
    { id: 'b', title: 'B', body: 'selam' }
  ]);

  assert.equal(library.loadItems(localStorage).find((item) => item.id === 'a').useCount, 0);

  assert.equal(smartFill.recordUse('a'), true);
  const afterFirst = library.loadItems(localStorage);
  assert.equal(afterFirst.find((item) => item.id === 'a').useCount, 1, 'the used prompt is counted');
  assert.equal(afterFirst.find((item) => item.id === 'b').useCount, 0, 'other prompts are untouched');

  assert.equal(smartFill.recordUse('a'), true);
  assert.equal(library.loadItems(localStorage).find((item) => item.id === 'a').useCount, 2);

  // An unknown id is a no-op rather than an error or a stray write.
  assert.equal(smartFill.recordUse('missing'), false);
  assert.equal(smartFill.recordUse(''), false);
  assert.equal(smartFill.recordUse(undefined), false);
  assert.equal(library.loadItems(localStorage).length, 2);
}

// The recorded count is what the insights module then summarizes.
{
  const { library, localStorage, smartFill } = withLibrary([
    { id: 'a', title: 'A', body: 'merhaba {{konu}}' }
  ]);
  smartFill.recordUse('a');
  const usageRoot = loadBrowserModule('prompt-library-usage.js', { localStorage });
  const summary = usageRoot.HafizePromptLibraryUsage.summarize(library.loadItems(localStorage));
  assert.equal(summary.totalUses, 1);
  assert.equal(summary.usedCount, 1);
  assert.equal(summary.top[0].id, 'a');
}

console.log('prompt smart-fill usage boundary: ok');
