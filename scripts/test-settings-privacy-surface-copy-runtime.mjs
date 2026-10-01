import assert from 'node:assert/strict';
import { makeStorage, loadApi } from './settings-privacy-fixture.mjs';
const api=await loadApi();
const snapshot=api.inspectStorage(makeStorage({'hafize.theme.v1':'dark'}));
const theme=snapshot.surfaces.find((item)=>item.id==='theme');
assert.equal(api.surfaceSummary(theme),'Tema tercihi: 1 alan · 19 B');
assert.equal(api.surfaceSummary(null),'');
console.log('surface summary runtime ok');
