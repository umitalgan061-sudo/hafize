import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fixture, controllerOptions, forkButton } from './conversation-fork-lifecycle-fixture.mjs';

const require = createRequire(import.meta.url);
const api = require('../public/conversation-fork.js');

{
  const f = fixture();
  const controller = api.createController(controllerOptions(f));
  assert.equal(controller.mount(), true);
  assert.ok(controller.readCanonical());
  assert.equal(controller.publishLineage({ mode: 'test' }), true);
  assert.equal(f.events.length, 1);

  const button = forkButton(f);
  const writes = f.getWrites();
  controller.destroy();

  assert.equal(controller.readCanonical(), null, 'destroyed controller cannot read canonical state through public API');
  assert.equal(controller.rollbackOrphanFork('conversation-any'), false, 'destroyed controller cannot rewrite storage through rollback API');
  assert.equal(controller.publishLineage({ mode: 'stale' }), false, 'destroyed controller cannot publish lineage');
  assert.equal(controller.forkFromMessage(button, 'assistant-1'), false, 'destroyed controller cannot fork directly');
  assert.equal(controller.decorate(f.article), false, 'destroyed controller cannot decorate directly');
  assert.equal(controller.decorateAll(f.messages), 0, 'destroyed controller cannot decorate a subtree');
  assert.equal(f.getWrites(), writes);
  assert.equal(f.events.length, 1);
  assert.equal(f.getReloads(), 0);
}

{
  const f = fixture();
  const first = api.createController(controllerOptions(f));
  const second = api.createController(controllerOptions(f));
  first.mount();
  const oldButton = forkButton(f);
  first.destroy();
  second.mount();

  assert.equal(first.forkFromMessage(oldButton, 'assistant-1'), false, 'superseded controller public method remains inert');
  assert.equal(first.readCanonical(), null);
  assert.equal(first.publishLineage({ mode: 'stale-owner' }), false);
  assert.equal(f.getWrites(), 0);
  assert.equal(f.events.length, 0);

  assert.ok(second.readCanonical(), 'new owner retains normal API access');
  assert.equal(second.forkFromMessage(forkButton(f), 'assistant-1'), true);
  assert.equal(f.getWrites(), 1);
  assert.equal(f.events.length, 1);
  assert.equal(f.getReloads(), 1);
  second.destroy();
}

{
  const f = fixture();
  const controller = api.createController(controllerOptions(f));
  assert.equal(controller.mount(), true);
  assert.equal(controller.decorateAll(f.messages), 0, 'already-owned messages are not redecorated');
  assert.equal(controller.decorate(f.article), false);
  assert.equal(f.article.querySelectorAll('.conversation-fork-btn').length, 1);
  assert.equal(controller.getState().ownedDecorations, 1);
  controller.destroy();
}

console.log('conversation fork controller API boundary tests passed');
