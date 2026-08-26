import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const api = require('../public/message-edit.js');

function node(className = '') {
  return {
    className,
    dataset: {},
    children: [],
    classList: { contains(name) { return className.split(/\s+/).includes(name); } },
    querySelector(selector) {
      if (selector === '.content') return this.content || null;
      if (selector === '.message-copy-actions') return this.actions || null;
      return null;
    }
  };
}

const assistant = node('message assistant');
assistant.content = { textContent: 'assistant' };
assistant.actions = { prepend() { throw new Error('assistant must not be decorated'); } };
const documentRef = { querySelector() { return null; }, createElement() { return {}; } };
const storage = { getItem() { return '[]'; }, setItem() {} };
const handoffStorage = { getItem() { return null; }, setItem() {}, removeItem() {} };
const guard = { sanitizeStoredValue() { return { value: [] }; }, normalizeConversations(value) { return value; } };
const controller = api.createController({ documentRef, storage, handoffStorage, guard, MutationObserverImpl: null, EventImpl: null });
assert.equal(controller.decorate(assistant), false, 'assistant messages must never get edit-to-draft control');

assert.equal(api.editableText('\nmesaj\n'), '\nmesaj\n', 'visible whitespace is preserved for user editing');
assert.equal(api.editableText('x'.repeat(api.MAX_COMPOSER_CHARS)), 'x'.repeat(api.MAX_COMPOSER_CHARS));
assert.equal(api.editableText('x'.repeat(api.MAX_COMPOSER_CHARS + 1)), null);

const missingActions = node('message user');
missingActions.content = { textContent: 'user' };
assert.equal(controller.decorate(missingActions), false, 'controller waits for canonical action row instead of creating a competing surface');
assert.equal(missingActions.dataset[api.MARKER], undefined);

console.log('message edit edge-case tests passed');
