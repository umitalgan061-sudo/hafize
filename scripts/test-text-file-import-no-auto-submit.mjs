import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const sourcePath = fileURLToPath(new URL('../public/text-file-import.js', import.meta.url));
const source = await readFile(sourcePath, 'utf8');

for (const forbidden of [
  /requestSubmit\s*\(/,
  /\.submit\s*\(/,
  /sendButton\?*\.click\s*\(/,
  /#sendBtn[^\n]*click\s*\(/,
  /dispatchEvent\([^)]*submit/i
]) {
  assert.equal(forbidden.test(source), false, `file import must never auto-submit: ${forbidden}`);
}

assert.equal(source.includes("documentRef.querySelector('#sendBtn')"), true, 'send button may be read only for streaming state');
assert.equal(source.includes("classList?.contains?.('streaming')"), true);
assert.equal(source.includes("composerInput.dispatchEvent(new EventImpl('input', { bubbles: true }))"), true, 'only composer input notification is allowed');
assert.equal(source.includes('composerInput.value = next;'), true);
assert.equal(source.includes('Mesajı göndermek için ayrıca sen onaylamalısın.'), true);

const confirmIndex = source.indexOf('function confirmStaged()');
const submitIndex = source.indexOf('requestSubmit');
assert.notEqual(confirmIndex, -1);
assert.equal(submitIndex, -1);

console.log('text file import no-auto-submit tests passed');
