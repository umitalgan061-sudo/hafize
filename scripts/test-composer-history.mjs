import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createStorage, loadBrowserApi } from './browser-module-harness.mjs';
const source = fs.readFileSync('public/composer-history.js', 'utf8');
assert.match(source, /hafize\.composer-history\.v1/);
assert.match(source, /MAX_ITEMS = 40/);
assert.match(source, /MAX_TEXT = 12000/);
assert.match(source, /JSON\.parse/);
assert.match(source, /localStorage/);

// The stored list is capped by the user's retention choice, which is itself
// bounded by MAX_ITEMS. Asserted as behaviour rather than as a literal
// `slice(0, MAX_ITEMS)`, which the retention setting replaced.
{
  const { api } = loadBrowserApi('composer-history.js', 'HafizeComposerHistory', { localStorage: createStorage() });
  const overflow = Array.from({ length: api.MAX_ITEMS + 25 }, (_, index) => `m${index}`);
  api.save(overflow);
  assert.equal(api.load().length, api.MAX_ITEMS, 'the default retention caps the history at MAX_ITEMS');
  assert.ok(api.RETENTION_VALUES.every((value) => value <= api.MAX_ITEMS), 'no retention option exceeds MAX_ITEMS');
}

assert.match(source, /hafize:composer-history-changed/);
assert.match(source, /dataset\.historyReady/);
assert.match(source, /compositionstart/);
assert.match(source, /ArrowUp/);
assert.match(source, /ArrowDown/);
assert.match(source, /destroy:/);
console.log('composer history core contract: ok');
