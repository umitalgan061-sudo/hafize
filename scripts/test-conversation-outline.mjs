import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const outline = require('../public/conversation-outline.js');

assert.equal(outline.MAX_OUTLINE_ITEMS, 100);
assert.equal(outline.MAX_PREVIEW_CHARS, 92);
assert.equal(outline.MAX_QUERY_CHARS, 120);
assert.equal(outline.MAX_MESSAGE_ID_CHARS, 160);

assert.equal(outline.normalizeMessageId('abc-123:_x.y'), 'abc-123:_x.y');
assert.equal(outline.normalizeMessageId('  abc  '), 'abc');
assert.equal(outline.normalizeMessageId(''), null);
assert.equal(outline.normalizeMessageId('a b'), null);
assert.equal(outline.normalizeMessageId('<script>'), null);
assert.equal(outline.normalizeMessageId('x'.repeat(161)), null);

assert.equal(outline.normalizeText('  Ankara\n  planı   hazır '), 'Ankara planı hazır');
assert.equal(outline.normalizeText(null), '');
assert.equal(outline.createPreview('kısa metin'), 'kısa metin');
assert.equal(outline.createPreview('x'.repeat(100)).length, 92);
assert.equal(outline.createPreview('x'.repeat(100)).endsWith('…'), true);
assert.equal(outline.normalizeQuery('  GİTHUB   Planı '), 'github planı');
assert.equal(outline.normalizeQuery('x'.repeat(121)), '');
assert.equal(outline.matchesQuery('GitHub güvenlik planı', 'GİTHUB'), true);
assert.equal(outline.matchesQuery('GitHub güvenlik planı', 'takvim'), false);
assert.equal(outline.matchesQuery('Her şey', ''), true);

function article(id, text, role = 'user') {
  return {
    dataset: { messageId: id },
    role,
    querySelector(selector) {
      if (selector === '.content') return { textContent: text };
      return null;
    }
  };
}

function messagesFrom(articles) {
  return {
    querySelectorAll(selector) {
      if (selector !== '.message.user[data-message-id]') return [];
      return articles.filter((item) => item.role === 'user');
    }
  };
}

let messages = messagesFrom([
  article('u1', 'İlk kullanıcı sorusu'),
  article('a1', 'Asistan yanıtı', 'assistant'),
  article('u2', '  İkinci\n kullanıcı   sorusu '),
  article('bad id', 'Geçersiz kimlik'),
  article('u3', '')
]);

assert.deepEqual(outline.collectOutlineItems(messages), [
  { id: 'u1', preview: 'İlk kullanıcı sorusu', turn: 1 },
  { id: 'u2', preview: 'İkinci kullanıcı sorusu', turn: 2 }
]);
assert.equal(outline.findMessageById(messages, 'u2')?.dataset?.messageId, 'u2');
assert.equal(outline.findMessageById(messages, 'missing'), null);
assert.equal(outline.findMessageById(messages, 'bad id'), null);

const many = Array.from({ length: 130 }, (_, index) => article(`u${index}`, `Soru ${index}`));
const bounded = outline.collectOutlineItems(messagesFrom(many));
assert.equal(bounded.length, 100);
assert.equal(bounded[0].turn, 1);
assert.equal(bounded.at(-1).turn, 100);
assert.equal(bounded.at(-1).id, 'u99');

console.log('conversation outline helper tests passed');
