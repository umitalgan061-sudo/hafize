import assert from 'node:assert/strict';
import { makeStorage, loadApi } from './settings-privacy-fixture.mjs';
const api=await loadApi();
const storage=makeStorage({'unknown':'private','auth.token':'secret','hafize.theme.v1':'dark'});
const report=api.privacyReport(api.inspectStorage(storage),null);
// Parsed rather than substring-matched, so the gate survives a formatting change.
const parsed=JSON.parse(report);
assert.equal(parsed.totals.unknownKeys,2);
assert.equal(parsed.contentIncluded,false);
assert.equal(report.includes('private'),false);
assert.equal(report.includes('secret'),false);
assert.equal(report.includes('unknown'),true);
console.log('runtime unknown report boundary ok');
