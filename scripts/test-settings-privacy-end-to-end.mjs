import assert from 'node:assert/strict';
import { makeStorage, loadApi } from './settings-privacy-fixture.mjs';

const api=await loadApi();
const storage=makeStorage({
  'hafize.prompt-library.v1':'prompt',
  'hafize.prompt-library.smart-fill.v1.profile':'values',
  'hafize.theme.v1':'dark',
  'third-party':'keep'
});

const snapshot=api.inspectStorage(storage);
assert.equal(snapshot.available,true);
assert.equal(snapshot.totalKeys,4);
assert.equal(snapshot.unknownKeys,1);

const prompts=snapshot.surfaces.find((item)=>item.id==='prompts');
const smart=snapshot.surfaces.find((item)=>item.id==='smart-fill');
const theme=snapshot.surfaces.find((item)=>item.id==='theme');

assert.equal(prompts.present,true);
assert.equal(smart.present,true);
assert.equal(theme.present,true);
assert.ok(prompts.bytes>0);
assert.ok(smart.bytes>0);
assert.ok(theme.bytes>0);

const report=JSON.parse(api.privacyReport(snapshot,{usage:1000,quota:10000}));
assert.equal(report.contentIncluded,false);
assert.equal(report.localOnly,true);

const summary=api.privacySummary(snapshot,{usage:1000,quota:10000});
assert.ok(summary.includes('Hafize yerel veri özeti'));
assert.equal(summary.includes('prompt'),false);
assert.equal(summary.includes('values'),false);

const clear=api.clearDataSurfaces(storage);
assert.equal(clear.ok,true);
assert.equal(storage.has('hafize.prompt-library.v1'),false);
assert.equal(storage.has('hafize.prompt-library.smart-fill.v1.profile'),false);
assert.equal(storage.has('hafize.theme.v1'),true);
assert.equal(storage.has('third-party'),true);

const preference=api.clearPreferences(storage);
assert.equal(preference.ok,true);
assert.equal(storage.has('hafize.theme.v1'),false);
assert.equal(storage.has('third-party'),true);

console.log('privacy end-to-end local data lifecycle smoke ok');
