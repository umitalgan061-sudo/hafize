import assert from 'node:assert/strict';
import { makeStorage, loadApi } from './settings-privacy-fixture.mjs';

const api=await loadApi();
assert.equal(api.classifyKey('hafize.theme.v1').id,'theme');
assert.equal(api.classifyKey('hafize.prompt-library.smart-fill.v1.alpha').id,'smart-fill');
assert.equal(api.classifyKey('hafize.prompt-library.smart-fill.v1').id,'smart-fill');
assert.equal(api.classifyKey('hafize.prompt-library.smart-fill.v1x'),null);
assert.equal(api.classifyKey('unknown'),null);
console.log('runtime classification ok');
