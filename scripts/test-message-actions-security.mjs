import assert from 'node:assert/strict';
import fs from 'node:fs';

const files = ['public/message-actions.js', 'public/message-outline.js'].map((path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'));
const source = files.join('\n');
assert.ok(source.includes('createObjectURL'));
assert.ok(source.includes('revokeObjectURL'));
assert.ok(source.includes('navigator'));
for (const forbidden of ['fetch(', 'XMLHttpRequest', 'WebSocket', 'sendBeacon', 'innerHTML', 'document.write', 'eval(', 'new Function(']) {
  assert.equal(source.includes(forbidden), false, `forbidden action API: ${forbidden}`);
}
console.log('assistant message action security contract ok');
