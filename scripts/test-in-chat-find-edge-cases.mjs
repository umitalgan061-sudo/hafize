import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const api = require('../public/in-chat-find.js');

function article(text, isMessage = true) {
  return {
    classList: { contains: (name) => isMessage && name === 'message' },
    querySelector: (selector) => selector === '.content' ? { textContent: text } : null
  };
}

assert.equal(api.normalizeQuery(null), null);
assert.equal(api.normalizeQuery('   '), '');
assert.equal(api.normalizeQuery('İSTANBUL'), 'istanbul');
const real = article('abc');
const fake = article('abc', false);
assert.deepEqual(api.matchingMessages([real, fake], 'abc'), [real]);

const one = article('aynı kelime');
const two = article('aynı başka');
assert.equal(api.matchingMessages([one, two], 'aynı').length, 2);
assert.equal(api.matchingMessages([one, two], 'yok').length, 0);

assert.equal(api.mount({ documentRef: { querySelector: () => null } }), null);
assert.throws(() => api.createController({ documentRef: null }), /INVALID_IN_CHAT_FIND_DOCUMENT/);

const source = fs.readFileSync(path.resolve('public/in-chat-find.js'), 'utf8');
assert.match(source, /event\?\.shiftKey \? -1 : 1/);
assert.match(source, /\(index \+ delta \+ matches\.length\) % matches\.length/);
assert.match(source, /returnFocus\?\.focus/);
assert.match(source, /removeEventListener/);
assert.match(source, /observer\?\.disconnect/);
assert.match(source, /control\?\.remove/);
assert.equal(/innerHTML\s*=/.test(source), false);
assert.equal(/eval\s*\(/.test(source), false);
assert.equal(/Function\s*\(/.test(source), false);
assert.equal(/trace[_-]?id/i.test(source), false);
assert.equal(/tool-activities/.test(source), false);
assert.equal(/messageId/.test(source), false);
console.log('in-chat find edge tests passed');
