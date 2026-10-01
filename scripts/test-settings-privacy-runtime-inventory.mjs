import assert from 'node:assert/strict';
import { makeStorage, loadApi } from './settings-privacy-fixture.mjs';

const api=await loadApi();
const storage=makeStorage({
 'hafize.prompt-library.v1':'[]',
 'hafize.prompt-library.smart-fill.v1.demo':'[1]',
 'hafize.theme.v1':'dark',
 'third-party':'do not expose'
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
assert.equal(api.classifyKey('third-party'),null);
console.log('runtime inventory ok');
