import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fixture, controllerOptions, FakeElement } from './conversation-fork-lifecycle-fixture.mjs';

const require = createRequire(import.meta.url);
const api = require('../public/conversation-fork.js');

function assistantArticle(id) {
  const article = new FakeElement('article');
  article.className = 'message assistant';
  article.dataset.messageId = id;
  const content = new FakeElement('div');
  content.className = 'content';
  article.append(content);
  return article;
}

{
  const f = fixture();
  const controller = api.createController(controllerOptions(f));
  assert.equal(controller.mount(), true);
  const late = assistantArticle('assistant-late');
  f.messages.append(late);
  f.getObserver().fire();
  assert.ok(late.querySelector('.conversation-fork-btn'), 'live observer decorates late assistant message');
  assert.equal(late.dataset.hafizeForkReady, '1');
  assert.equal(controller.getState().ownedDecorations, 2);
  controller.destroy();
  assert.equal(late.querySelector('.conversation-fork-btn'), null, 'late owned control removed on destroy');
  assert.equal(late.dataset.hafizeForkReady, undefined);
}

{
  const f = fixture();
  const controller = api.createController(controllerOptions(f));
  controller.mount();
  const late = assistantArticle('assistant-late');
  late.dataset.hafizeForkReady = 'foreign';
  f.messages.append(late);
  f.getObserver().fire();
  assert.equal(late.querySelector('.conversation-fork-btn'), null, 'foreign late marker is respected');
  assert.equal(late.dataset.hafizeForkReady, 'foreign');
  controller.destroy();
  assert.equal(late.dataset.hafizeForkReady, 'foreign');
}

{
  const f = fixture();
  const controller = api.createController(controllerOptions(f));
  controller.mount();
  const malformed = assistantArticle('bad id with spaces');
  f.messages.append(malformed);
  f.getObserver().fire();
  assert.equal(malformed.querySelector('.conversation-fork-btn'), null, 'invalid message id never gets a fork control');
  controller.destroy();
}

{
  const f = fixture();
  const controller = api.createController(controllerOptions(f));
  controller.mount();
  const nonAssistant = new FakeElement('article');
  nonAssistant.className = 'message user';
  nonAssistant.dataset.messageId = 'user-late';
  const content = new FakeElement('div');
  content.className = 'content';
  nonAssistant.append(content);
  f.messages.append(nonAssistant);
  f.getObserver().fire();
  assert.equal(nonAssistant.querySelector('.conversation-fork-btn'), null, 'user message never gets fork control');
  controller.destroy();
}

{
  const f = fixture();
  const controller = api.createController(controllerOptions(f));
  controller.mount();
  const observer = f.getObserver();
  controller.destroy();
  const afterDestroy = assistantArticle('assistant-after-destroy');
  f.messages.append(afterDestroy);
  observer.fire();
  observer.fire();
  assert.equal(afterDestroy.querySelector('.conversation-fork-btn'), null, 'repeated stale observer callbacks remain inert');
  assert.equal(controller.getState().ownedDecorations, 0);
}

console.log('conversation fork late DOM lifecycle tests passed');
