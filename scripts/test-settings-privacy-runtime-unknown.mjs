import assert from 'node:assert/strict';
import { makeStorage, loadApi } from './settings-privacy-fixture.mjs';

const api=await loadApi();
const storage=makeStorage({
 'auth.token':'SECRET',
 'oauth.secret':'SECRET2',
 'random.future':'future',
 'hafize.theme.v1':'dark'
});
const snapshot=api.inspectStorage(storage);
assert.equal(snapshot.unknownKeys,3);
const result=api.clearAllKnown(storage);
assert.equal(result.ok,true);
assert.equal(result.removed,1);
assert.equal(storage.has('auth.token'),true);
assert.equal(storage.has('oauth.secret'),true);
assert.equal(storage.has('random.future'),true);
console.log('runtime unknown-key preservation ok');
