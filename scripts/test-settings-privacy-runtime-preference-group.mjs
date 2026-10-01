import assert from 'node:assert/strict';
import { makeStorage, loadApi } from './settings-privacy-fixture.mjs';

const api=await loadApi();
const storage=makeStorage({
 'hafize.theme.v1':'dark',
 'hafize.reduced-motion.v1':'true',
 'hafize.model-preferences.v1':'models',
 'hafize.prompt-library.v1':'prompt'
});
const result=api.clearPreferences(storage);
assert.equal(result.ok,true);
assert.equal(storage.has('hafize.theme.v1'),false);
assert.equal(storage.has('hafize.reduced-motion.v1'),false);
assert.equal(storage.has('hafize.model-preferences.v1'),false);
assert.equal(storage.has('hafize.prompt-library.v1'),true);
console.log('runtime preference group boundary ok');
