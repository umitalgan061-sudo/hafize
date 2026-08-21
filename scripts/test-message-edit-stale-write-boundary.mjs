import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fixture, editButton } from './message-edit-lifecycle-fixture.mjs';

const require = createRequire(import.meta.url);
const api = require('../public/message-edit.js');

{
  const f = fixture();
  const controller = api.createController(f.options);
  assert.equal(controller.mount(), true);
  const button = editButton(f.articles[0].article);
  assert.ok(button);
  button.click();

  assert.equal(f.storage.writes.length, 1, 'exact edit creates one canonical conversation write');
  assert.equal(f.handoffStorage.writes.length, 1, 'draft handoff is staged before canonical write');
  assert.equal(f.reloads.length, 1, 'successful branch edit reloads once');
  assert.equal(f.events.length, 1, 'successful branch edit emits one lineage event');
  assert.equal(f.events[0].type, api.BRANCH_EVENT);
  assert.equal(f.events[0].detail.parentConversationId, 'conversation-source');
  assert.equal(f.events[0].detail.sourceMessageId, 'msg-user-2');
  assert.equal(f.events[0].detail.mode, 'edit');

  const persisted = JSON.parse(f.storage.getItem(api.STORAGE_KEY));
  assert.equal(persisted.length, 2);
  assert.equal(persisted[1].id, 'conversation-source', 'source conversation is retained');
  assert.equal(persisted[0].messages.length, 2, 'branch keeps only messages before edited user message');
  controller.destroy();
}

{
  const f = fixture();
  const controller = api.createController(f.options);
  controller.mount();
  const button = editButton(f.articles[0].article);
  const staleHandler = button.listeners.get('click')[0];
  assert.equal(typeof staleHandler, 'function');
  controller.destroy();

  const storageWrites = f.storage.writes.length;
  const handoffWrites = f.handoffStorage.writes.length;
  staleHandler({ type: 'click', isTrusted: true });
  assert.equal(f.storage.writes.length, storageWrites, 'captured stale callback cannot write canonical storage');
  assert.equal(f.handoffStorage.writes.length, handoffWrites, 'captured stale callback cannot stage handoff');
  assert.equal(f.reloads.length, 0);
  assert.equal(f.events.length, 0);
  assert.equal(controller.editMessage(button, f.articles[0].article, f.articles[0].content), false, 'public method stays inert after destroy');
}

{
  const f = fixture();
  const controller = api.createController(f.options);
  controller.mount();
  const button = editButton(f.articles[0].article);
  const staleHandler = button.listeners.get('click')[0];

  delete f.messages[api.INSTALL_MARKER];
  staleHandler({ type: 'click', isTrusted: true });
  assert.equal(f.storage.writes.length, 0, 'lost ownership blocks old controller storage mutation');
  assert.equal(f.handoffStorage.writes.length, 0, 'lost ownership blocks old controller handoff mutation');
  assert.equal(f.reloads.length, 0);
  assert.equal(f.events.length, 0);
  assert.equal(controller.getState().ownsSurface, false);
  controller.destroy();
}

{
  const f = fixture();
  const controller = api.createController(f.options);
  controller.mount();
  const button = editButton(f.articles[0].article);
  f.composerInput.value = 'korunacak taslak';
  button.click();
  assert.equal(f.storage.writes.length, 0, 'existing composer draft prevents branch write');
  assert.equal(f.handoffStorage.writes.length, 0);
  assert.equal(f.composerInput.focused, true);
  assert.equal(button.dataset.state, 'error');
  assert.equal(button.textContent, 'Taslak korunuyor');
  controller.destroy();
}

{
  const f = fixture();
  const controller = api.createController(f.options);
  controller.mount();
  const button = editButton(f.articles[0].article);
  f.send.classList.add('streaming');
  button.click();
  assert.equal(f.storage.writes.length, 0, 'active stream prevents edit branch write');
  assert.equal(f.handoffStorage.writes.length, 0);
  assert.equal(button.textContent, 'Yanıt sürüyor');
  controller.destroy();
}

{
  const f = fixture();
  const originalSet = f.storage.setItem.bind(f.storage);
  f.storage.setItem = (key, value) => {
    originalSet(key, value);
    if (key === api.STORAGE_KEY) f.storage.map.set(key, '[]');
  };
  const controller = api.createController(f.options);
  controller.mount();
  const button = editButton(f.articles[0].article);
  button.click();
  assert.equal(f.reloads.length, 0, 'failed persistence verification never reloads');
  assert.equal(f.events.length, 0, 'failed persistence verification emits no lineage event');
  assert.equal(f.handoffStorage.getItem(api.DRAFT_HANDOFF_KEY), null, 'failed write clears staged handoff');
  assert.equal(controller.getState().busy, false, 'failed write releases busy state');
  controller.destroy();
}

console.log('message edit stale write boundary tests passed');
