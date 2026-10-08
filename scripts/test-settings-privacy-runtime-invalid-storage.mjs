import assert from 'node:assert/strict';
import { loadApi } from './settings-privacy-fixture.mjs';

const api=await loadApi();
const broken={get length(){throw new Error('broken');},key(){throw new Error('broken');},getItem(){throw new Error('broken');},removeItem(){throw new Error('broken');}};
const snapshot=api.inspectStorage(broken);
// A storage whose accessors all throw is reported as unavailable rather than as
// an empty inventory: claiming "no local data" would be misleading when the
// user's data may simply be unreadable.
assert.equal(snapshot.available,false);
assert.equal(snapshot.totalKeys,0);
assert.deepEqual(snapshot.surfaces,[]);
const result=api.clearSurface('theme',broken);
assert.equal(result.ok,false);
assert.equal(result.removed,0);
console.log('runtime invalid storage handling ok');
