import assert from 'node:assert/strict';
import { makeStorage, loadApi } from './settings-privacy-fixture.mjs';

const api=await loadApi();
const secret='TOP-SECRET-CONTENT';
const summary=api.privacySummary(api.inspectStorage(makeStorage({'hafize.conversations.v1':secret,'unknown':secret})),{usage:null,quota:null});
assert.equal(summary.includes(secret),false);
assert.ok(summary.includes('Tanınmayan alan'));
assert.ok(summary.includes('Hafize yerel veri özeti'));
console.log('runtime summary privacy ok');
