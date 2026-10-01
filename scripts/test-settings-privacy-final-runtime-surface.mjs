import assert from 'node:assert/strict';
import { makeStorage, loadApi } from './settings-privacy-fixture.mjs';

const api=await loadApi();
const storage=makeStorage({'hafize.theme.v1':'dark'});
const snapshot=api.inspectStorage(storage);
const surface=snapshot.surfaces.find((item)=>item.id==='theme');
assert.equal(surface.present,true);
assert.ok(api.surfaceSummary(surface).startsWith('Tema tercihi:'));
assert.equal(api.classifyKey('not-hafize'),null);
console.log('privacy runtime surface final ok');
