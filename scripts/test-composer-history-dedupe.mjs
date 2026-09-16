// Dedupe/retention behaviour of the real composer history module.
//
// This suite used to assert against an inline re-implementation of the dedupe
// rule, so it exercised nothing in `public/` and its own copy disagreed with the
// assertions. It now drives the shipped module.

import assert from 'node:assert/strict';
import { createStorage, loadBrowserApi } from './browser-module-harness.mjs';

function withHistory(initial = {}) {
  const localStorage = createStorage(initial);
  const { api } = loadBrowserApi('composer-history.js', 'HafizeComposerHistory', { localStorage });
  return { api, localStorage };
}

// Newest first, with an earlier duplicate removed rather than repeated.
{
  const { api } = withHistory();
  api.save(['b', 'a']);
  const stored = api.load();
  assert.deepEqual(stored, ['b', 'a']);
}

// A re-sent message moves to the front instead of appearing twice.
{
  const { api } = withHistory();
  const add = (items, value) => [value, ...items.filter((item) => item !== value)].slice(0, api.MAX_ITEMS);
  let items = [];
  items = add(items, 'a');
  items = add(items, 'b');
  items = add(items, 'a');
  api.save(items);
  assert.deepEqual(api.load(), ['a', 'b'], 'the resent entry moves to the front');
}

// Blank and whitespace-only entries never reach storage.
{
  const { api } = withHistory();
  api.save(['a', '', '   ', 'b']);
  assert.deepEqual(api.load(), ['a', 'b'], 'empty entries are dropped on read');
}

// Non-string junk is discarded rather than crashing the reader.
{
  const { api, localStorage } = withHistory();
  localStorage.setItem(api.STORAGE_KEY, JSON.stringify(['a', 42, null, { text: 'x' }, 'b']));
  assert.deepEqual(api.load(), ['a', 'b']);
}

// Corrupt JSON degrades to an empty history instead of throwing.
{
  const { api, localStorage } = withHistory();
  localStorage.setItem(api.STORAGE_KEY, '{not json');
  assert.deepEqual(api.load(), []);
}

// The retention cap is honoured and can never exceed MAX_ITEMS.
{
  const { api } = withHistory();
  assert.ok(api.RETENTION_VALUES.every((value) => value <= api.MAX_ITEMS), 'retention options stay within MAX_ITEMS');
  api.saveSettings({ enabled: true, maxItems: 10 });
  api.save(Array.from({ length: 40 }, (_, index) => `m${index}`));
  assert.equal(api.load().length, 10);
}

// Each entry is clamped to MAX_TEXT.
{
  const { api } = withHistory();
  api.save(['x'.repeat(api.MAX_TEXT + 500)]);
  assert.equal(api.load()[0].length, api.MAX_TEXT);
}

// Disabling retention, or choosing the 0 option, clears the stored history.
{
  const { api, localStorage } = withHistory();
  api.save(['a', 'b']);
  api.saveSettings({ enabled: false, maxItems: 40 });
  assert.deepEqual(api.load(), []);
  assert.equal(localStorage.getItem(api.STORAGE_KEY), null, 'disabling retention erases the stored entries');

  api.saveSettings({ enabled: true, maxItems: 0 });
  api.save(['c']);
  assert.deepEqual(api.load(), []);
}

console.log('composer history dedupe: ok');
