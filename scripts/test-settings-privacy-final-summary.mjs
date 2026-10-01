import assert from 'node:assert/strict';
import { makeStorage, loadApi } from './settings-privacy-fixture.mjs';
const api=await loadApi();
const secret='private-value';
const summary=api.privacySummary(api.inspectStorage(makeStorage({'hafize.prompt-library.v1':secret})),null);
assert.equal(summary.includes(secret),false);
assert.ok(summary.includes('Hafize yerel veri özeti'));
console.log('privacy final summary gate ok');
