import assert from 'node:assert/strict';
import { makeStorage, loadApi } from './settings-privacy-fixture.mjs';

const api=await loadApi();
const storage=makeStorage({
 'hafize.prompt-library.smart-fill.v1.a':'A',
 'hafize.prompt-library.smart-fill.v1.b':'B',
 'hafize.prompt-library.smart-fill.v1extra':'KEEP',
 'hafize.prompt-library.v1':'[]'
});
const before=api.inspectStorage(storage);
assert.equal(before.surfaces.find((s)=>s.id==='smart-fill').keys,2);
const result=api.clearSurface('smart-fill',storage);
assert.equal(result.ok,true);
assert.equal(result.removed,2);
assert.equal(storage.has('hafize.prompt-library.smart-fill.v1.a'),false);
assert.equal(storage.has('hafize.prompt-library.smart-fill.v1.b'),false);
assert.equal(storage.has('hafize.prompt-library.smart-fill.v1extra'),true);
assert.equal(storage.has('hafize.prompt-library.v1'),true);
console.log('runtime prefix clear ok');
