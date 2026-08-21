import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fixture, editButton, FakeObserver } from './message-edit-lifecycle-fixture.mjs';

const require = createRequire(import.meta.url);
const api = require('../public/message-edit.js');

assert.equal(typeof api.INSTALL_MARKER, 'symbol');

{
  const f = fixture();
  const first = api.createController(f.options);
  const second = api.createController(f.options);
  assert.equal(first.mount(), true);
  assert.equal(first.getState().mounted, true);
  assert.equal(first.getState().ownsSurface, true);
  assert.equal(first.getState().decorations, 1);
  const firstButton = editButton(f.articles[0].article);
  assert.ok(firstButton);
  assert.equal(f.articles[0].article.dataset.hafizeEditReady, '1');

  assert.equal(second.mount(), false, 'duplicate controller cannot claim same messages surface');
  assert.equal(editButton(f.articles[0].article), firstButton, 'duplicate mount does not replace owned button');

  assert.equal(first.destroy(), true);
  assert.equal(first.destroy(), false, 'destroy is idempotent');
  assert.equal(first.getState().destroyed, true);
  assert.equal(editButton(f.articles[0].article), null, 'owned button removed on destroy');
  assert.equal(Object.prototype.hasOwnProperty.call(f.articles[0].article.dataset, 'hafizeEditReady'), false, 'owned marker removed on destroy');
  assert.equal(FakeObserver.instances[0].disconnected, true);

  assert.equal(second.mount(), true, 'ownership released for clean remount');
  assert.ok(editButton(f.articles[0].article));
  assert.notEqual(editButton(f.articles[0].article), firstButton);
  second.destroy();
}

{
  const f = fixture({ markerValue: 'host-owned' });
  const controller = api.createController(f.options);
  assert.equal(controller.mount(), true);
  assert.equal(controller.getState().decorations, 1, 'non-conflicting host marker value can be snapshotted');
  assert.equal(f.articles[0].article.dataset.hafizeEditReady, '1');
  controller.destroy();
  assert.equal(f.articles[0].article.dataset.hafizeEditReady, 'host-owned', 'host marker restored exactly');
}

{
  const f = fixture({ markerValue: '1' });
  const foreign = f.documentRef.createElement('button');
  foreign.className = 'message-copy-btn message-edit-btn';
  foreign.classList.add('message-copy-btn');
  foreign.classList.add('message-edit-btn');
  f.articles[0].actions.prepend(foreign);
  const controller = api.createController(f.options);
  assert.equal(controller.mount(), true);
  assert.equal(controller.getState().decorations, 0, 'pre-existing edit control is treated as foreign');
  assert.equal(editButton(f.articles[0].article), foreign);
  controller.destroy();
  assert.equal(editButton(f.articles[0].article), foreign, 'foreign control survives teardown');
  assert.equal(f.articles[0].article.dataset.hafizeEditReady, '1', 'foreign marker survives teardown');
}

{
  const f = fixture({ throwOnButtonListener: true });
  const controller = api.createController(f.options);
  assert.equal(controller.mount(), true, 'individual decoration failure does not corrupt controller installation');
  assert.equal(controller.getState().decorations, 0);
  assert.equal(editButton(f.articles[0].article), null);
  assert.equal(Object.prototype.hasOwnProperty.call(f.articles[0].article.dataset, 'hafizeEditReady'), false);
  controller.destroy();
}

{
  const f = fixture({ articleCount: 2 });
  const controller = api.createController(f.options);
  assert.equal(controller.mount(), true);
  assert.equal(controller.getState().decorations, 1, 'invalid canonical message id is not decorated');
  const firstButton = editButton(f.articles[0].article);
  assert.ok(firstButton);

  const extra = f.articles[1].article;
  extra.dataset.messageId = 'msg-user-extra-valid';
  assert.equal(controller.decorate(extra), true, 'late valid user message can be decorated');
  assert.equal(controller.getState().decorations, 2);
  assert.ok(editButton(extra));

  controller.destroy();
  assert.equal(editButton(f.articles[0].article), null);
  assert.equal(editButton(extra), null);
}

{
  const f = fixture();
  const controller = api.createController(f.options);
  controller.mount();
  const observer = FakeObserver.instances.at(-1);
  assert.ok(observer);
  controller.destroy();
  observer.fire();
  assert.equal(editButton(f.articles[0].article), null, 'stale observer callback stays inert after destroy');
  assert.equal(controller.decorateAll(f.messages), 0);
  assert.equal(controller.decorate(f.articles[0].article), false);
  assert.equal(controller.mount(), false, 'destroyed controller cannot be resurrected');
}

console.log('message edit installation lifecycle tests passed');
