import assert from 'node:assert/strict';
import { makeStorage, loadApi } from './settings-privacy-fixture.mjs';

const api=await loadApi();
const storage=makeStorage({'hafize.prompt-library.v1':'p','hafize.theme.v1':'dark','unknown':'u'});
const data=api.clearDataSurfaces(storage);
assert.equal(data.ok,true);
assert.equal(storage.has('hafize.prompt-library.v1'),false);
assert.equal(storage.has('hafize.theme.v1'),true);
assert.equal(storage.has('unknown'),true);
console.log('privacy runtime groups final ok');
