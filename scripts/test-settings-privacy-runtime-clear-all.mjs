import assert from 'node:assert/strict';
import { makeStorage, loadApi } from './settings-privacy-fixture.mjs';

const api=await loadApi();
const storage=makeStorage({
 'hafize.conversations.v1':'c',
 'hafize.prompt-library.v1':'p',
 'hafize.prompt-library.smart-fill.v1.one':'v',
 'hafize.theme.v1':'dark',
 'hafize.model-preferences.v1':'m',
 'unknown':'u',
 'auth.token':'secret'
});
const before=api.inspectStorage(storage);
assert.equal(before.unknownKeys,2);
const result=api.clearAllKnown(storage);
assert.equal(result.ok,true);
assert.ok(result.removed>=5);
for(const key of ['hafize.conversations.v1','hafize.prompt-library.v1','hafize.prompt-library.smart-fill.v1.one','hafize.theme.v1','hafize.model-preferences.v1']) assert.equal(storage.has(key),false,key);
assert.equal(storage.has('unknown'),true);
assert.equal(storage.has('auth.token'),true);
console.log('runtime clear all preservation ok');
