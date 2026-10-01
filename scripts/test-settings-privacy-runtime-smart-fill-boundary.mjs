import assert from 'node:assert/strict';
import { makeStorage, loadApi } from './settings-privacy-fixture.mjs';
const api=await loadApi();
const storage=makeStorage({
 'hafize.prompt-library.smart-fill.v1.alpha':'one',
 'hafize.prompt-library.smart-fill.v1.beta':'two',
 'hafize.prompt-library.smart-fill.v1x':'three'
});
const summary=api.inspectStorage(storage);
const surface=summary.surfaces.find((s)=>s.id==='smart-fill');
assert.equal(surface.keys,2);
assert.equal(surface.present,true);
assert.equal(summary.unknownKeys,1);
console.log('runtime smart fill boundary ok');
