import assert from 'node:assert/strict';
import { loadApi } from './settings-privacy-fixture.mjs';
const api=await loadApi();
assert.equal(api.formatBytes(0),'0 B');
assert.equal(api.formatBytes(1024),'1.0 KB');
assert.equal(api.formatBytes(1024*1024),'1.00 MB');
console.log('privacy runtime final format ok');
