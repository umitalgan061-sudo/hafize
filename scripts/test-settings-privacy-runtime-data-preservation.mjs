import assert from 'node:assert/strict';
import { makeStorage, loadApi } from './settings-privacy-fixture.mjs';
const api=await loadApi();
const storage=makeStorage({
 'hafize.conversations.v1':'conversation',
 'hafize.theme.v1':'dark',
 'hafize.model-preferences.v1':'model',
 'external.data':'keep'
});
api.clearDataSurfaces(storage);
assert.equal(storage.has('hafize.conversations.v1'),false);
assert.equal(storage.has('hafize.theme.v1'),true);
assert.equal(storage.has('hafize.model-preferences.v1'),true);
assert.equal(storage.has('external.data'),true);
console.log('runtime data preservation ok');
