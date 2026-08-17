import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const consent = await readFile(new URL('../public/hands-free-consent.js', import.meta.url), 'utf8');
const handsFree = await readFile(new URL('../public/hands-free.js', import.meta.url), 'utf8');
const app = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');

for (const source of [consent, handsFree]) {
  assert.doesNotMatch(source, /requestSubmit\(/);
  assert.doesNotMatch(source, /composer\.submit|submitMessage\(/);
  assert.doesNotMatch(source, /sendButton|sendBtn/);
  assert.doesNotMatch(source, /dispatchEvent\([^\n]*submit/);
  assert.doesNotMatch(source, /KeyboardEvent\(/);
}

// Existing application submit remains attached only to explicit composer interactions.
assert.match(app, /ui\.composer\.addEventListener\('submit'/);
assert.match(app, /submitMessage\(ui\.messageInput\.value\)/);
assert.match(app, /ui\.sendButton\.addEventListener\('click'/);

// Consent copy must accurately describe the no-auto-submit boundary.
assert.match(consent, /otomatik gönderilmez/);

console.log('hands-free consent no-auto-submit tests passed');
