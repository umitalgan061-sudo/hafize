import assert from 'node:assert/strict';
import { loadApi } from './settings-privacy-fixture.mjs';

const api=await loadApi();
assert.equal(api.formatBytes(0),'0 B');
assert.equal(api.formatBytes(1024),'1.0 KB');
assert.equal(api.formatBytes(1024*1024),'1.00 MB');
assert.equal(api.formatBytes(-10),'0 B');
assert.equal(api.formatBytes(NaN),'0 B');
console.log('runtime byte formatting ok');
