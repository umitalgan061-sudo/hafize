import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fixture, controllerOptions, forkButton, FakeElement } from './conversation-fork-lifecycle-fixture.mjs';

const require = createRequire(import.meta.url);
const api = require('../public/conversation-fork.js');

{
  const f = fixture();
  const first = api.createController(controllerOptions(f));
  const second = api.createController(controllerOptions(f));

  assert.equal(first.mount(), true);
  assert.equal(first.getState().mounted, true);
  assert.equal(first.getState().ownedDecorations, 1);
  assert.equal(second.mount(), false, 'duplicate controller must fail closed on the same messages root');
  assert.equal(f.article.querySelectorAll('.conversation-fork-btn').length, 1);

  const stale = forkButton(f);
  assert.equal(first.destroy(), true);
  assert.equal(first.destroy(), false, 'destroy is idempotent');
  assert.equal(f.article.querySelector('.conversation-fork-btn'), null, 'owned control removed on destroy');
  assert.equal(f.article.dataset.hafizeForkReady, undefined, 'owned marker removed on destroy');
  assert.equal(first.getState().destroyed, true);

  assert.equal(second.mount(), true, 'ownership released for clean remount');
  const fresh = forkButton(f);
  assert.notEqual(fresh, stale);
  assert.equal(f.article.querySelectorAll('.conversation-fork-btn').length, 1);
  second.destroy();
}

{
  const f = fixture({ existingMarker: 'host-value' });
  const controller = api.createController(controllerOptions(f));
  assert.equal(controller.mount(), true);
  assert.equal(f.article.querySelector('.conversation-fork-btn'), null, 'foreign marker prevents takeover');
  assert.equal(f.article.dataset.hafizeForkReady, 'host-value');
  controller.destroy();
  assert.equal(f.article.dataset.hafizeForkReady, 'host-value', 'foreign marker survives teardown exactly');
}

{
  const f = fixture();
  const foreignActions = new FakeElement('div');
  foreignActions.className = 'conversation-fork-actions';
  const foreignButton = new FakeElement('button');
  foreignButton.className = 'conversation-fork-btn';
  foreignActions.append(foreignButton);
  f.article.append(foreignActions);

  const controller = api.createController(controllerOptions(f));
  assert.equal(controller.mount(), true);
  assert.equal(f.article.querySelectorAll('.conversation-fork-btn').length, 1, 'foreign control is not duplicated');
  controller.destroy();
  assert.equal(f.article.querySelector('.conversation-fork-btn'), foreignButton, 'foreign control is preserved');
}

{
  const f = fixture({ throwOnButtonListener: true });
  const controller = api.createController(controllerOptions(f));
  assert.equal(controller.mount(), true, 'individual decoration failure does not corrupt root ownership');
  assert.equal(controller.getState().ownedDecorations, 0);
  assert.equal(f.article.querySelector('.conversation-fork-btn'), null);
  assert.equal(f.article.dataset.hafizeForkReady, undefined);
  controller.destroy();
}

{
  const f = fixture({ throwOnObserve: true });
  const controller = api.createController(controllerOptions(f));
  assert.equal(controller.mount(), false, 'observer install failure rolls back entire controller');
  assert.equal(controller.getState().mounted, false);
  assert.equal(controller.getState().ownedDecorations, 0);
  assert.equal(f.article.querySelector('.conversation-fork-btn'), null);
  assert.equal(f.article.dataset.hafizeForkReady, undefined);

  const retryFixture = fixture();
  const retry = api.createController(controllerOptions(retryFixture));
  assert.equal(retry.mount(), true);
  retry.destroy();
}

{
  const f = fixture();
  const controller = api.createController(controllerOptions(f));
  assert.equal(controller.mount(), true);
  const observer = f.getObserver();
  controller.destroy();

  const late = new FakeElement('article');
  late.className = 'message assistant';
  late.dataset.messageId = 'assistant-late';
  const content = new FakeElement('div');
  content.className = 'content';
  late.append(content);
  f.messages.append(late);
  observer.fire();
  assert.equal(late.querySelector('.conversation-fork-btn'), null, 'stale observer cannot decorate after destroy');
}

console.log('conversation fork installation lifecycle tests passed');
