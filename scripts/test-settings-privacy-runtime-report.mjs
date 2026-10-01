import assert from 'node:assert/strict';
import { makeStorage, loadApi } from './settings-privacy-fixture.mjs';

const api=await loadApi();
const storage=makeStorage({
 'hafize.prompt-library.v1':'VERY-SENSITIVE-PROMPT',
 'hafize.conversations.v1':'PRIVATE-MESSAGE',
 'random':'PRIVATE-UNKNOWN'
});
const report=JSON.parse(api.privacyReport(api.inspectStorage(storage),{usage:1234,quota:9999}));
assert.equal(report.localOnly,true);
assert.equal(report.contentIncluded,false);
assert.equal(report.totals.unknownKeys,1);
const serialized=JSON.stringify(report);
assert.equal(serialized.includes('VERY-SENSITIVE-PROMPT'),false);
assert.equal(serialized.includes('PRIVATE-MESSAGE'),false);
assert.equal(serialized.includes('PRIVATE-UNKNOWN'),false);
console.log('runtime privacy report ok');
