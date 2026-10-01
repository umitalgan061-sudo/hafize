import assert from 'node:assert/strict';
import { makeStorage, loadApi } from './settings-privacy-fixture.mjs';

const api=await loadApi();
const storage=makeStorage({
 'hafize.prompt-library.v1':'payload',
 'hafize.theme.v1':'dark',
 'hafize.reduced-motion.v1':'true',
 'unknown':'keep'
});
const data=api.clearDataSurfaces(storage);
assert.equal(data.ok,true);
assert.equal(storage.has('hafize.prompt-library.v1'),false);
assert.equal(storage.has('hafize.theme.v1'),true);
assert.equal(storage.has('hafize.reduced-motion.v1'),true);
assert.equal(storage.has('unknown'),true);
const prefs=api.clearPreferences(storage);
assert.equal(prefs.ok,true);
assert.equal(storage.has('hafize.theme.v1'),false);
assert.equal(storage.has('hafize.reduced-motion.v1'),false);
assert.equal(storage.has('unknown'),true);
console.log('runtime clear groups ok');
