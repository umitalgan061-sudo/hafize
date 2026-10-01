import assert from 'node:assert/strict';
import { makeStorage, loadApi } from './settings-privacy-fixture.mjs';
const api=await loadApi();
const storage=makeStorage({'hafize.theme.v1':'dark','third.party':'keep'});
api.clearPreferences(storage);
assert.equal(storage.has('third.party'),true);
assert.equal(storage.has('hafize.theme.v1'),false);
console.log('privacy unknown preservation final ok');
