import assert from 'node:assert/strict';
import { makeStorage, loadApi } from './settings-privacy-fixture.mjs';

const api=await loadApi();
const storage=makeStorage({
 'hafize.prompt-library.v1':'p',
 'hafize.prompt-library.v1.state':'state',
 'hafize.theme.v1':'dark',
 'hafize.reduced-motion.v1':'true',
 'hafize.prompt-library.smart-fill.v1.x':'x'
});
const result=api.clearDataSurfaces(storage);
assert.equal(result.ok,true);
assert.equal(storage.has('hafize.prompt-library.v1'),false);
assert.equal(storage.has('hafize.prompt-library.smart-fill.v1.x'),false);
assert.equal(storage.has('hafize.prompt-library.v1.state'),true);
assert.equal(storage.has('hafize.theme.v1'),true);
assert.equal(storage.has('hafize.reduced-motion.v1'),true);
console.log('runtime data group boundary ok');
