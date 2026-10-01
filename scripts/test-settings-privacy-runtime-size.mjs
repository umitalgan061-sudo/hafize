import assert from 'node:assert/strict';
import { makeStorage, loadApi } from './settings-privacy-fixture.mjs';

const api=await loadApi();
const storage=makeStorage({
 'hafize.prompt-library.v1':'ü'.repeat(100),
 'hafize.theme.v1':'dark'
});
const snapshot=api.inspectStorage(storage);
const prompt=snapshot.surfaces.find((item)=>item.id==='prompts');
assert.ok(prompt.bytes>100);
assert.ok(snapshot.knownBytes>=prompt.bytes);
assert.ok(snapshot.totalKeys===2);
console.log('runtime byte accounting ok');
