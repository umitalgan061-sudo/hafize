import assert from 'node:assert/strict';
import { makeStorage, loadApi } from './settings-privacy-fixture.mjs';

const api=await loadApi();
const longValue='x'.repeat(200000);
const storage=makeStorage({'hafize.prompt-library.v1':longValue});
const report=api.privacyReport(api.inspectStorage(storage),null);
assert.ok(report.length<120000);
assert.equal(report.includes(longValue),false);
assert.match(report,/contentIncluded/);
console.log('runtime report bound ok');
