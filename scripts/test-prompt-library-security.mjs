import assert from 'node:assert/strict';
import { normalizeItem, replaceVariables, exportPayload } from '../public/prompt-library.js';

const malicious = normalizeItem({
  title: '<img src=x onerror=alert(1)>',
  body: '<script>alert(1)</script> {{name}}',
  tags: ['<b>bad</b>', 'ok']
});
assert.ok(malicious);
assert.match(malicious.title, /<img/);
assert.match(malicious.body, /<script>/);
assert.equal(replaceVariables(malicious.body, { name: '<img onerror=alert(1)>' }).includes('{{'), false);
assert.equal(malicious.tags[0], '<b>bad</b>');
const payload = JSON.parse(exportPayload([malicious]));
assert.equal(payload.items[0].body, malicious.body);
assert.equal(payload.source, 'hafize-prompt-library');
assert.equal(typeof payload.items[0].id, 'string');
console.log('test-prompt-library-security: ok');
