import assert from 'node:assert/strict';

const expectedBase='dc699e55531d762732d4ec086ef7294c9a8b7d5c';
const branch='hafize/auto-model-preferences-0929';

assert.equal(expectedBase.length,40);
assert.equal(branch.startsWith('hafize/auto-'),true);
assert.equal(branch.includes('model-preferences'),true);
console.log('model preferences merge safety identifiers ok');
