import assert from 'node:assert/strict';
import { makeStorage, loadApi } from './settings-privacy-fixture.mjs';

const api=await loadApi();
const secret='raw-secret';
const storage=makeStorage({'hafize.prompt-library.v1':secret,'unknown':secret});
const report=JSON.stringify(JSON.parse(api.privacyReport(api.inspectStorage(storage),null)));
assert.equal(report.includes(secret),false);
assert.ok(report.includes('contentIncluded'));
assert.ok(report.includes('unknownKeys'));
console.log('privacy runtime report final ok');
