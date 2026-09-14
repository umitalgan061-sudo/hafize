import assert from 'node:assert/strict';
import { scanInline } from '../public/chat-markdown.js';

function types(value) { return scanInline(value).map((item) => item.type); }

assert.deepEqual(types('**kalın**'), ['strong']);
assert.deepEqual(types('*eğik*'), ['emphasis']);
assert.deepEqual(types('~~üstü~~'), ['strike']);
assert.deepEqual(types('`kod`'), ['code']);
assert.equal(scanInline('**kalın**')[0].text, 'kalın');
assert.equal(scanInline('*eğik*')[0].text, 'eğik');
assert.equal(scanInline('~~üstü~~')[0].text, 'üstü');
assert.equal(scanInline('`a * b`')[0].text, 'a * b');

const mixed = scanInline('önce **güçlü** sonra *ince* ve `code` bitti');
assert.deepEqual(mixed.map((item) => item.type), ['text', 'strong', 'text', 'emphasis', 'text', 'code', 'text']);

const marked = scanInline('[etiket](https://example.com)');
assert.equal(marked[0].type, 'link');
assert.equal(marked[0].text, 'etiket');

const auto = scanInline('bak https://example.com/path?x=1');
assert.equal(auto[1].type, 'link');
assert.match(auto[1].href, /^https:\/\//);

const unsafe = scanInline('[x](javascript:alert(1))');
assert.equal(unsafe.every((item) => item.type !== 'link'), true);
assert.match(unsafe.map((item) => item.text).join(''), /javascript/);

const punctuation = scanInline('https://example.com).');
assert.equal(punctuation[0].type, 'link');
assert.match(punctuation[0].href, /^https:\/\//);

const underscores = scanInline('a_b_not_word');
assert.equal(underscores.some((item) => item.type === 'emphasis'), false);

const empty = scanInline('');
assert.equal(empty.length, 0);
const nullish = scanInline(null);
assert.equal(nullish.length, 0);

console.log('test-chat-markdown-inline: ok');
