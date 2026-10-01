import assert from 'node:assert/strict';
import { makeStorage, loadApi } from './settings-privacy-fixture.mjs';
const api=await loadApi();
const secret='sensitive-prompt';
const report=api.privacyReport(api.inspectStorage(makeStorage({'hafize.prompt-library.v1':secret})),null);
assert.equal(report.includes(secret),false);
assert.equal(report.includes('contentIncluded'),true);
console.log('privacy report content final gate ok');
