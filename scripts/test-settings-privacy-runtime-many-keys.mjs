import assert from 'node:assert/strict';
import { makeStorage, loadApi } from './settings-privacy-fixture.mjs';

const api=await loadApi();
const entries={};
for(let i=0;i<500;i++) entries['unknown-'+i]='value';
entries['hafize.theme.v1']='dark';
const snapshot=api.inspectStorage(makeStorage(entries));
assert.equal(snapshot.totalKeys,300);
assert.ok(snapshot.unknownKeys<=300);
console.log('runtime bounded scan ok');
