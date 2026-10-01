import assert from 'node:assert/strict';
import { makeStorage, loadApi } from './settings-privacy-fixture.mjs';

const api=await loadApi();
const report=JSON.parse(api.privacyReport(api.inspectStorage(makeStorage({'hafize.prompt-library.v1':'private'})),{usage:100,quota:1000}));
assert.deepEqual(Object.keys(report).sort(),['contentIncluded','format','generatedAt','localOnly','surfaces','totals','version'].sort());
assert.equal(report.localOnly,true);
assert.equal(report.contentIncluded,false);
assert.equal(report.version,1);
console.log('runtime report flags ok');
