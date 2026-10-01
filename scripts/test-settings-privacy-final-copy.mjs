import assert from 'node:assert/strict';
import { makeStorage, loadApi } from './settings-privacy-fixture.mjs';
const api=await loadApi();
const surface=api.inspectStorage(makeStorage({'hafize.theme.v1':'dark'})).surfaces.find((x)=>x.id==='theme');
assert.ok(api.surfaceSummary(surface).includes('Tema tercihi'));
assert.equal(api.surfaceSummary(surface).includes('dark'),false);
console.log('privacy final copy gate ok');
