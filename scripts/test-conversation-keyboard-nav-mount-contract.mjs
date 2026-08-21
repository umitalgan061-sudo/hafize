import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { makeButton, makeDocument, makeList, eventFor } from './conversation-keyboard-nav-fixture.mjs';

const require = createRequire(import.meta.url);
const api = require('../public/conversation-keyboard-nav.js');

{
  const buttons = [makeButton('a'), makeButton('b')];
  const list = makeList(buttons);
  const documentRef = makeDocument(list);

  const first = api.mount({ documentRef });
  assert.ok(first, 'module-level mount returns the owning controller');
  assert.equal(first.isMounted(), true);
  assert.equal(list.listenerCount(), 1);

  const duplicate = api.mount({ documentRef });
  assert.equal(duplicate, null, 'module-level duplicate mount fails closed');
  assert.equal(list.listenerCount(), 1, 'duplicate mount cannot install a second key handler');

  const event = eventFor(buttons[0], 'ArrowDown');
  assert.equal(list.listener()(event), true);
  assert.equal(event.prevented, 1);
  assert.equal(buttons[1].focused, 1);

  first.destroy();
  const remount = api.mount({ documentRef });
  assert.ok(remount, 'destroyed owner releases module-level mount capacity');
  assert.equal(list.listenerCount(), 1);
  remount.destroy();
}

{
  const documentRef = makeDocument(null);
  assert.equal(api.mount({ documentRef }), null, 'missing conversation list is a bounded no-op');
}

{
  const documentRef = makeDocument(makeList(), { queryThrows: true });
  assert.equal(api.mount({ documentRef }), null, 'host query failures do not escape module mount');
}

{
  const list = makeList([makeButton('a'), makeButton('b')], { addThrows: true });
  const documentRef = makeDocument(list);
  assert.equal(api.mount({ documentRef }), null, 'listener installation failures do not escape module mount');

  const healthy = makeList([makeButton('x'), makeButton('y')]);
  documentRef.replaceList(healthy);
  const recovery = api.mount({ documentRef });
  assert.ok(recovery, 'failed module mount leaves no hidden ownership behind');
  recovery.destroy();
}

{
  const noRemove = {
    querySelectorAll: () => [],
    addEventListener() {}
  };
  const documentRef = makeDocument(noRemove);
  assert.equal(api.mount({ documentRef }), null, 'mount requires symmetric listener teardown support');
}

console.log('conversation keyboard navigation mount-contract tests passed');
