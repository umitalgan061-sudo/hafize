import assert from 'node:assert/strict';
import { makeStorage, loadApi } from './settings-privacy-fixture.mjs';

const api=await loadApi();
const snapshot=api.inspectStorage(makeStorage());
assert.equal(snapshot.available,true);
assert.equal(snapshot.totalKeys,0);
assert.equal(snapshot.knownBytes,0);
assert.equal(snapshot.unknownKeys,0);
assert.equal(api.clearAllKnown(makeStorage()).removed,0);
console.log('runtime empty storage ok');
