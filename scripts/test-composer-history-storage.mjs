// Storage isolation and failure handling for the real composer history module.
//
// This suite used to build a throwaway storage stub and assert on the stub, so
// it passed or failed regardless of what `public/composer-history.js` did. It
// now drives the shipped module against the shared harness storage.

import assert from 'node:assert/strict';
import { createStorage, loadBrowserApi } from './browser-module-harness.mjs';

function withHistory(initial = {}, options = {}) {
  const localStorage = createStorage(initial, options);
  const { api } = loadBrowserApi('composer-history.js', 'HafizeComposerHistory', { localStorage });
  return { api, localStorage };
}

// History lives under its own key and leaves every neighbouring key untouched.
{
  const { api, localStorage } = withHistory({ 'hafize.other': JSON.stringify(['secret']) });
  assert.equal(api.STORAGE_KEY, 'hafize.composer-history.v1');
  assert.equal(api.SETTINGS_KEY, 'hafize.composer-history.settings.v1');

  api.save(['a', 'b']);
  assert.deepEqual(JSON.parse(localStorage.getItem(api.STORAGE_KEY)), ['a', 'b']);
  assert.equal(localStorage.getItem('hafize.other'), JSON.stringify(['secret']), 'unrelated keys are preserved');

  api.saveSettings({ enabled: true, maxItems: 20 });
  assert.deepEqual(JSON.parse(localStorage.getItem(api.STORAGE_KEY)), ['a', 'b'], 'settings writes do not clobber history');
  assert.equal(localStorage.getItem('hafize.other'), JSON.stringify(['secret']));
}

// Clearing history removes only its own key.
{
  const { api, localStorage } = withHistory({ 'hafize.other': 'keep' });
  api.save(['a']);
  api.saveSettings({ enabled: false, maxItems: 40 });
  assert.equal(localStorage.getItem(api.STORAGE_KEY), null);
  assert.equal(localStorage.getItem('hafize.other'), 'keep');
}

// A blocked read (private mode, blocked site data) degrades to an empty history.
{
  const { api } = withHistory({}, { failOn: ['getItem'] });
  assert.deepEqual(api.load(), [], 'a throwing getItem yields no history');
  assert.deepEqual(api.loadSettings(), { enabled: true, maxItems: api.MAX_ITEMS }, 'settings fall back to defaults');
}

// A failed write (quota exceeded) is reported rather than thrown.
{
  const { api } = withHistory({}, { failOn: ['setItem'] });
  assert.equal(api.save(['a']), false, 'save reports failure instead of throwing');
  assert.equal(api.saveSettings({ enabled: true, maxItems: 10 }), false);
}

// A successful write reports success.
{
  const { api } = withHistory();
  assert.equal(api.save(['a']), true);
  assert.equal(api.saveSettings({ enabled: true, maxItems: 10 }), true);
}

// Only the documented retention options are accepted; anything else falls back.
{
  const { api } = withHistory();
  for (const value of api.RETENTION_VALUES) {
    api.saveSettings({ enabled: true, maxItems: value });
    assert.equal(api.loadSettings().maxItems, value);
  }
  for (const rejected of [7, -1, 9999, '20', null, undefined, Number.NaN]) {
    api.saveSettings({ enabled: true, maxItems: rejected });
    assert.equal(api.loadSettings().maxItems, api.MAX_ITEMS, `maxItems ${String(rejected)} falls back to the default`);
  }
}

// Settings survive a corrupt payload.
{
  const { api, localStorage } = withHistory();
  localStorage.setItem(api.SETTINGS_KEY, 'not json');
  assert.deepEqual(api.loadSettings(), { enabled: true, maxItems: api.MAX_ITEMS });
}

console.log('composer history storage isolation: ok');
