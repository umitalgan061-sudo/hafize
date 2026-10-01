import assert from 'node:assert/strict';
import { makeStorage, loadApi } from './settings-privacy-fixture.mjs';

const api=await loadApi();
const storage=makeStorage({
 'hafize.prompt-library.v1':'12345',
 'hafize.theme.v1':'dark'
});
const summary=api.privacySummary(api.inspectStorage(storage),{usage:2048,quota:8192});
assert.match(summary,/Hafize yerel veri özeti/);
assert.match(summary,/Bilinen veri/);
assert.match(summary,/Depolama kullanımı|Tarayıcı kullanımı/);
assert.match(summary,/İstem kütüphanesi|Tema tercihi/);
assert.equal(summary.includes('12345'),false);
console.log('runtime privacy summary ok');
