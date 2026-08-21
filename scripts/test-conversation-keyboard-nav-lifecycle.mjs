import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { makeButton, makeDocument, makeHarness, makeList, eventFor, assertMoved } from './conversation-keyboard-nav-fixture.mjs';

const require = createRequire(import.meta.url);
const api = require('../public/conversation-keyboard-nav.js');

{
  const h = makeHarness();
  const first = api.createController({ documentRef: h.documentRef });
  const second = api.createController({ documentRef: h.documentRef });

  assert.equal(first.mount(), true);
  assert.equal(first.isMounted(), true);
  assert.equal(second.mount(), false, 'same document has only one keyboard navigation owner');
  assert.equal(h.list.listenerCount(), 1);

  const event = eventFor(h.buttons[0], 'ArrowDown');
  assert.equal(h.list.listener()(event), true);
  assertMoved(event, h.buttons[0], h.buttons[1]);

  assert.equal(first.destroy(), true);
  assert.equal(first.isMounted(), false);
  assert.equal(h.list.listenerCount(), 0);
  assert.equal(second.mount(), true, 'ownership is released for a clean controller remount');
  second.destroy();
}

{
  const h = makeHarness({ listOptions: { addThrows: true } });
  const failed = api.createController({ documentRef: h.documentRef });
  assert.equal(failed.mount(), false, 'listener install failure fails closed');
  assert.equal(failed.isMounted(), false);
  assert.equal(h.list.listenerCount(), 0);

  const healthy = makeList(h.buttons);
  h.documentRef.replaceList(healthy);
  const retry = api.createController({ documentRef: h.documentRef });
  assert.equal(retry.mount(), true, 'failed install does not leak document ownership');
  assert.equal(healthy.listenerCount(), 1);
  retry.destroy();
}

{
  const h = makeHarness();
  const controller = api.createController({ documentRef: h.documentRef });
  assert.equal(controller.mount(), true);
  const staleListener = h.list.listener();
  assert.equal(typeof staleListener, 'function');
  assert.equal(controller.destroy(), true);

  const staleEvent = eventFor(h.buttons[0], 'ArrowDown');
  assert.equal(staleListener(staleEvent), false, 'captured listener is inert after destroy');
  assert.equal(staleEvent.prevented, 0);
  assert.equal(h.buttons[1].focused, 0);

  assert.equal(controller.onKeyDown(eventFor(h.buttons[0], 'ArrowDown')), false, 'public handler is inert after destroy');
  assert.equal(controller.hasCurrentList(), false);
}

{
  const h = makeHarness();
  const controller = api.createController({ documentRef: h.documentRef });
  controller.mount();
  const firstGeneration = h.list.listener();
  controller.destroy();
  assert.equal(controller.mount(), true, 'same controller can be mounted again without API regression');
  const secondGeneration = h.list.listener();
  assert.notEqual(firstGeneration, secondGeneration, 'each mount gets a fresh generation-bound listener');

  const staleEvent = eventFor(h.buttons[0], 'ArrowDown');
  assert.equal(firstGeneration(staleEvent), false, 'old generation stays inert after remount');
  assert.equal(staleEvent.prevented, 0);

  const liveEvent = eventFor(h.buttons[0], 'ArrowDown');
  assert.equal(secondGeneration(liveEvent), true);
  assertMoved(liveEvent, h.buttons[0], h.buttons[1]);
  controller.destroy();
}

{
  const h = makeHarness();
  const controller = api.createController({ documentRef: h.documentRef });
  controller.mount();
  const staleRootListener = h.list.listener();
  const replacementButtons = [makeButton('x'), makeButton('y')];
  const replacement = makeList(replacementButtons);
  h.documentRef.replaceList(replacement);

  const event = eventFor(h.buttons[0], 'ArrowDown');
  assert.equal(staleRootListener(event), false, 'controller refuses navigation after conversation list root replacement');
  assert.equal(event.prevented, 0);
  assert.equal(h.buttons[1].focused, 0);
  assert.equal(controller.hasCurrentList(), false);

  controller.destroy();
  const replacementController = api.createController({ documentRef: h.documentRef });
  assert.equal(replacementController.mount(), true);
  const replacementEvent = eventFor(replacementButtons[0], 'ArrowDown');
  assert.equal(replacement.listener()(replacementEvent), true);
  assertMoved(replacementEvent, replacementButtons[0], replacementButtons[1]);
  replacementController.destroy();
}

{
  const h = makeHarness();
  const controller = api.createController({ documentRef: h.documentRef });
  controller.mount();
  h.documentRef.setQueryThrows(true);

  const event = eventFor(h.buttons[0], 'ArrowDown');
  assert.equal(h.list.listener()(event), false, 'document query failures fail closed');
  assert.equal(event.prevented, 0);
  assert.equal(h.buttons[1].focused, 0);

  h.documentRef.setQueryThrows(false);
  assert.equal(controller.hasCurrentList(), true);
  controller.destroy();
}

{
  const buttons = [makeButton('a'), makeButton('b')];
  const list = makeList(buttons, { removeThrows: true });
  const documentRef = makeDocument(list);
  const controller = api.createController({ documentRef });
  assert.equal(controller.mount(), true);
  const staleListener = list.listener();
  assert.equal(controller.destroy(), true, 'removeEventListener failure cannot retain controller ownership');
  assert.equal(controller.isMounted(), false);

  const staleEvent = eventFor(buttons[0], 'ArrowDown');
  assert.equal(staleListener(staleEvent), false, 'generation guard keeps leaked host listener inert');
  assert.equal(staleEvent.prevented, 0);

  const second = api.createController({ documentRef });
  assert.equal(second.mount(), true, 'teardown releases ownership even if host listener removal throws');
  second.destroy();
}

console.log('conversation keyboard navigation lifecycle tests passed');
