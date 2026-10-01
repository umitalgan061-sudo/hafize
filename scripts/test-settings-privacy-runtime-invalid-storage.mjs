import assert from 'node:assert/strict';
import { loadApi } from './settings-privacy-fixture.mjs';

const api=await loadApi();
const broken={get length(){throw new Error('broken');},key(){throw new Error('broken');},getItem(){throw new Error('broken');},removeItem(){throw new Error('broken');}};
const snapshot=api.inspectStorage(broken);
assert.equal(snapshot.available,true);
assert.equal(snapshot.totalKeys,0);
const result=api.clearSurface('theme',broken);
assert.equal(result.ok,false);
console.log('runtime invalid storage handling ok');
