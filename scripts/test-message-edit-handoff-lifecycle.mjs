import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fixture, editButton, FakeObserver } from './message-edit-lifecycle-fixture.mjs';

const require = createRequire(import.meta.url);
const api = require('../public/message-edit.js');

function handoff(conversationId = 'conversation-source', text = 'Düzenlenecek soru') {
  return JSON.stringify({ conversationId, text, createdAt: Date.now() });
}

{
  const f = fixture();
  f.handoffStorage.setItem(api.DRAFT_HANDOFF_KEY, handoff());
  f.handoffStorage.writes.length = 0;
  const controller = api.createController(f.options);
  assert.equal(controller.mount(), true);
  assert.equal(f.composerInput.value, 'Düzenlenecek soru', 'valid handoff restored during owned mount');
  assert.equal(f.composerInput.focused, true);
  assert.deepEqual(f.composerInput.selection, [17, 17]);
  assert.equal(f.handoffStorage.getItem(api.DRAFT_HANDOFF_KEY), null, 'restored handoff is one-shot');
  controller.destroy();
}

{
  const f = fixture();
  f.composerInput.value = 'mevcut taslak';
  f.handoffStorage.setItem(api.DRAFT_HANDOFF_KEY, handoff());
  const controller = api.createController(f.options);
  controller.mount();
  assert.equal(f.composerInput.value, 'mevcut taslak', 'existing draft is never overwritten by handoff');
  assert.ok(f.handoffStorage.getItem(api.DRAFT_HANDOFF_KEY), 'unconsumed handoff remains available');
  controller.destroy();
}

{
  const f = fixture();
  f.send.classList.add('streaming');
  f.handoffStorage.setItem(api.DRAFT_HANDOFF_KEY, handoff());
  const controller = api.createController(f.options);
  controller.mount();
  assert.equal(f.composerInput.value, '', 'streaming conversation does not accept handoff');
  assert.ok(f.handoffStorage.getItem(api.DRAFT_HANDOFF_KEY));
  f.send.classList.remove('streaming');
  FakeObserver.instances.at(-1).fire();
  assert.equal(f.composerInput.value, 'Düzenlenecek soru', 'observer can restore once stream is no longer active');
  assert.equal(f.handoffStorage.getItem(api.DRAFT_HANDOFF_KEY), null);
  controller.destroy();
}

{
  const f = fixture();
  f.handoffStorage.setItem(api.DRAFT_HANDOFF_KEY, JSON.stringify({
    conversationId: 'conversation-source',
    text: 'expired',
    createdAt: Date.now() - api.MAX_HANDOFF_AGE_MS - 1
  }));
  const controller = api.createController(f.options);
  controller.mount();
  assert.equal(f.composerInput.value, '');
  assert.equal(f.handoffStorage.getItem(api.DRAFT_HANDOFF_KEY), null, 'expired handoff is deleted fail-closed');
  controller.destroy();
}

{
  const f = fixture();
  f.handoffStorage.setItem(api.DRAFT_HANDOFF_KEY, handoff('conversation-other', 'başka sohbet taslağı'));
  const controller = api.createController(f.options);
  controller.mount();
  assert.equal(f.composerInput.value, '', 'handoff cannot cross active conversation boundary');
  assert.ok(f.handoffStorage.getItem(api.DRAFT_HANDOFF_KEY), 'different-conversation handoff is not consumed');
  controller.destroy();
}

{
  const f = fixture();
  const controller = api.createController(f.options);
  controller.mount();
  const observer = FakeObserver.instances.at(-1);
  controller.destroy();
  f.handoffStorage.setItem(api.DRAFT_HANDOFF_KEY, handoff());
  observer.fire();
  assert.equal(f.composerInput.value, '', 'stale observer cannot consume or apply handoff after destroy');
  assert.ok(f.handoffStorage.getItem(api.DRAFT_HANDOFF_KEY));
  assert.equal(controller.restoreHandoff(), false);
}

{
  const f = fixture();
  class ThrowingObserver {
    constructor(callback) { this.callback = callback; }
    observe() { throw new Error('observe failed'); }
    disconnect() { this.disconnected = true; }
  }
  const controller = api.createController({ ...f.options, MutationObserverImpl: ThrowingObserver });
  assert.equal(controller.mount(), false, 'observer installation failure rolls back whole controller mount');
  assert.equal(editButton(f.articles[0].article), null, 'rollback removes already-created edit button');
  assert.equal(Object.prototype.hasOwnProperty.call(f.articles[0].article.dataset, api.MARKER), false, 'rollback restores absent marker');
  assert.equal(controller.getState().mounted, false);
  assert.equal(controller.getState().ownsSurface, false);

  const retry = api.createController(f.options);
  assert.equal(retry.mount(), true, 'failed mount releases ownership for clean retry');
  retry.destroy();
}

console.log('message edit handoff lifecycle tests passed');
