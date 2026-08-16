import assert from 'node:assert/strict';
import {
  DRAFT_BLOCKED,
  MAX_PROMPT_CHARS,
  PROMPT_UNAVAILABLE,
  hasDraft,
  isStreaming,
  lastRetryPair,
  normalizePrompt
} from '../public/response-retry.js';

assert.equal(MAX_PROMPT_CHARS, 12000);
assert.match(DRAFT_BLOCKED, /taslağ/i);
assert.match(PROMPT_UNAVAILABLE, /bulunamadı/i);
assert.equal(normalizePrompt('  tekrar sor  '), 'tekrar sor');
assert.equal(normalizePrompt('   '), '');
assert.equal(normalizePrompt(null), '');
assert.equal(normalizePrompt('x'.repeat(MAX_PROMPT_CHARS + 1)), '');
assert.equal(hasDraft(' taslak '), true);
assert.equal(hasDraft(''), false);
assert.equal(isStreaming({ classList: { contains: (name) => name === 'streaming' } }), true);
assert.equal(isStreaming({ classList: { contains: () => false } }), false);

assert.deepEqual(lastRetryPair([
  { id: 'u1', role: 'user', content: 'ilk soru' },
  { id: 'a1', role: 'assistant', content: 'ilk yanıt' }
]), { assistantId: 'a1', prompt: 'ilk soru' });

assert.deepEqual(lastRetryPair([
  { id: 'u1', role: 'user', content: 'ilk soru' },
  { id: 'a1', role: 'assistant', content: 'ilk yanıt' },
  { id: 'u2', role: 'user', content: 'ikinci soru' },
  { id: 'a2', role: 'assistant', content: 'ikinci yanıt' }
]), { assistantId: 'a2', prompt: 'ikinci soru' });

assert.equal(lastRetryPair([{ role: 'assistant', content: 'tek' }]), null);
assert.equal(lastRetryPair([
  { role: 'assistant', content: 'yanıt' },
  { role: 'user', content: 'soru' }
]), null);
assert.equal(lastRetryPair([
  { role: 'user', content: '' },
  { role: 'assistant', content: 'yanıt' }
]), null);

console.log('response retry pure tests passed');
