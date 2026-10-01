import assert from 'node:assert/strict';
import { makeStorage, loadApi } from './settings-privacy-fixture.mjs';
const api=await loadApi();
const storage=makeStorage({'hafize.theme.v1':'dark','unknown':'keep'});
api.clearAllKnown(storage);
assert.equal(storage.has('hafize.theme.v1'),false);
assert.equal(storage.has('unknown'),true);
console.log('privacy final cleanup gate ok');
