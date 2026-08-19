import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const modelState = require('../public/conversation-model-state.js');

function classList(active = false) {
  return { contains(name) { return name === 'active' && active; } };
}

function row({ active = false, tagged = false, id = '' } = {}) {
  const dataset = {};
  if (tagged) dataset.conversationOrganizeId = id;
  return { classList: classList(active), dataset };
}

function documentFor(rows) {
  const list = { querySelectorAll(selector) { return selector === '.conversation-row' ? rows : []; } };
  return { querySelector(selector) { return selector === '#conversationList' ? list : null; } };
}

const conversations = [{ id: 'alpha' }, { id: 'beta' }];

assert.equal(modelState.activeConversationId(documentFor([
  row({ active: true }),
  row()
]), conversations), 'alpha', 'source-order fallback is valid before organizer identities exist');

assert.equal(modelState.activeConversationId(documentFor([
  row({ tagged: true, id: 'alpha' }),
  row({ active: true, tagged: true, id: 'beta' })
]), conversations), 'beta', 'organizer identity must remain authoritative');

assert.equal(modelState.activeConversationId(documentFor([
  row({ active: true }),
  row({ tagged: true, id: 'beta' })
]), conversations), '', 'mixed tagged/untagged rows must fail closed instead of using stale row index');

assert.equal(modelState.activeConversationId(documentFor([
  row({ active: true, tagged: true, id: 'missing' }),
  row({ tagged: true, id: 'beta' })
]), conversations), '', 'unknown organizer identity must fail closed');

assert.equal(modelState.activeConversationId(documentFor([
  row({ active: true, tagged: true, id: 'alpha' }),
  row({ active: true, tagged: true, id: 'beta' })
]), conversations), '', 'multiple active rows must fail closed');

assert.equal(modelState.activeConversationId(documentFor([
  row({ active: true, tagged: true, id: 'alpha' }),
  row({ tagged: true, id: 'alpha' })
]), conversations), '', 'duplicate organizer row identity must fail closed');

assert.equal(modelState.activeConversationId(documentFor([
  row({ active: true, tagged: true, id: '' }),
  row({ tagged: true, id: 'beta' })
]), conversations), '', 'present but invalid organizer identity must not fall back to row order');

console.log('conversation model-state identity tests passed');
