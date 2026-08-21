import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fixture, controllerOptions, forkButton } from './conversation-fork-lifecycle-fixture.mjs';

const require = createRequire(import.meta.url);
const api = require('../public/conversation-fork.js');

{
  const f = fixture();
  const controller = api.createController(controllerOptions(f));
  assert.equal(controller.mount(), true);
  const button = forkButton(f);

  const beforeWrites = f.getWrites();
  button.dispatch('click');
  assert.equal(f.getWrites(), beforeWrites + 1, 'live click writes one canonical fork');
  assert.equal(f.getReloads(), 1);
  assert.equal(f.events.length, 1);
  assert.equal(f.events[0].type, api.BRANCH_EVENT);
  assert.equal(f.events[0].detail.parentConversationId, 'conversation-source');
  assert.equal(f.events[0].detail.sourceMessageId, 'assistant-1');
  assert.equal(f.events[0].detail.mode, 'fork');
  const persisted = JSON.parse(f.store.get(api.STORAGE_KEY));
  assert.equal(persisted.length, 2);
  assert.equal(persisted.some((item) => item.id === 'conversation-source'), true, 'source is retained');
  controller.destroy();
}

{
  const f = fixture();
  const controller = api.createController(controllerOptions(f));
  controller.mount();
  const button = forkButton(f);
  const staleClick = button.listeners.get('click')[0];
  const before = f.store.get(api.STORAGE_KEY);
  const writes = f.getWrites();
  controller.destroy();

  staleClick();
  assert.equal(f.store.get(api.STORAGE_KEY), before, 'captured stale callback cannot mutate canonical storage');
  assert.equal(f.getWrites(), writes);
  assert.equal(f.events.length, 0);
  assert.equal(f.getReloads(), 0);
}

{
  const f = fixture();
  const first = api.createController(controllerOptions(f));
  const second = api.createController(controllerOptions(f));
  first.mount();
  const staleButton = forkButton(f);
  const staleClick = staleButton.listeners.get('click')[0];
  first.destroy();
  second.mount();

  const before = f.store.get(api.STORAGE_KEY);
  staleClick();
  assert.equal(f.store.get(api.STORAGE_KEY), before, 'old controller stays inert after clean remount');
  assert.equal(f.getReloads(), 0);

  forkButton(f).dispatch('click');
  assert.notEqual(f.store.get(api.STORAGE_KEY), before, 'new owner can fork normally');
  assert.equal(f.getReloads(), 1);
  second.destroy();
}

{
  const f = fixture();
  f.input.value = 'Gönderilmemiş taslak';
  const controller = api.createController(controllerOptions(f));
  controller.mount();
  forkButton(f).dispatch('click');
  assert.equal(f.getWrites(), 0, 'draft prevents branch write');
  assert.equal(f.getReloads(), 0);
  assert.equal(forkButton(f).dataset.state, 'error');
  assert.match(forkButton(f).textContent, /Taslak/);
  controller.destroy();
}

{
  const f = fixture();
  f.send.className = 'streaming';
  const controller = api.createController(controllerOptions(f));
  controller.mount();
  forkButton(f).dispatch('click');
  assert.equal(f.getWrites(), 0, 'active response stream prevents branch write');
  assert.equal(f.getReloads(), 0);
  assert.match(forkButton(f).textContent, /Yanıt/);
  controller.destroy();
}

{
  const f = fixture();
  const originalSet = f.storage.setItem;
  f.storage.setItem = (key, value) => {
    originalSet(key, value);
    if (key === api.STORAGE_KEY) f.store.set(key, JSON.stringify([]));
  };
  const controller = api.createController(controllerOptions(f));
  controller.mount();
  forkButton(f).dispatch('click');
  assert.equal(f.getReloads(), 0, 'failed persistence verification never reloads');
  assert.equal(f.events.length, 0, 'failed persistence verification never publishes lineage');
  controller.destroy();
}

{
  const f = fixture();
  const modelWrites = [];
  const modelState = {
    readModelEntries() { return [{ conversationId: 'conversation-source', modelId: 'nvidia/test-model' }]; },
    writeModelEntries(_storage, entries) { modelWrites.push(entries); }
  };
  const controller = api.createController({ ...controllerOptions(f), modelState });
  controller.mount();
  forkButton(f).dispatch('click');
  assert.equal(modelWrites.length, 1, 'live owner may copy model preference');
  assert.equal(modelWrites[0][0].modelId, 'nvidia/test-model');
  controller.destroy();
}

console.log('conversation fork stale write boundary tests passed');
