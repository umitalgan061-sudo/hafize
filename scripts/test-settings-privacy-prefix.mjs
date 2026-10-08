import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadApi, makeStorage } from './settings-privacy-fixture.mjs';

const s=readFileSync('public/typed/settings-privacy.ts','utf8');
assert.match(s,/surface\.prefix && value\.startsWith\(surface\.prefix\)/);
assert.ok(s.includes('hafize.prompt-library.smart-fill.v1.'));

// Behaviour, not spelling: a prefix surface claims its own keys, the exact base
// key Smart Fill dispatches events with, and nothing that merely looks similar.
const api = await loadApi();
assert.equal(api.classifyKey('hafize.prompt-library.smart-fill.v1.alpha').id, 'smart-fill');
assert.equal(api.classifyKey('hafize.prompt-library.smart-fill.v1').id, 'smart-fill');
assert.equal(api.classifyKey('hafize.prompt-library.smart-fill.v1x'), null);
assert.equal(api.classifyKey('hafize.prompt-library.smart-fill'), null);

const store = makeStorage({
  'hafize.prompt-library.smart-fill.v1.alpha': 'a',
  'hafize.prompt-library.smart-fill.v1.beta': 'b',
  'hafize.prompt-library.smart-fill.v1x': 'keep'
});
assert.deepEqual(api.clearSurface('smart-fill', store), { removed: 2, ok: true });
assert.deepEqual(Object.keys(store.dump()), ['hafize.prompt-library.smart-fill.v1x']);
console.log('privacy prefix contract ok');
