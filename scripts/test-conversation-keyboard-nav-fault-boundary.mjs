import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { makeButton, makeDocument, makeHarness, makeList, eventFor } from './conversation-keyboard-nav-fixture.mjs';

const require = createRequire(import.meta.url);
const api = require('../public/conversation-keyboard-nav.js');

{
  const blocked = makeButton('blocked', { focusThrows: true });
  const buttons = [makeButton('source'), blocked];
  const list = makeList(buttons);
  const documentRef = makeDocument(list);
  const controller = api.createController({ documentRef });
  controller.mount();

  const event = eventFor(buttons[0], 'ArrowDown');
  assert.equal(list.listener()(event), false, 'focus failure is not reported as handled');
  assert.equal(event.prevented, 0, 'browser default is preserved when focus could not move');
  assert.equal(blocked.focused, 0);
  controller.destroy();
}

{
  const target = makeButton('target', { scrollThrows: true });
  const buttons = [makeButton('source'), target];
  const list = makeList(buttons);
  const documentRef = makeDocument(list);
  const controller = api.createController({ documentRef });
  controller.mount();

  const event = eventFor(buttons[0], 'ArrowDown');
  assert.equal(list.listener()(event), true, 'scroll failure does not undo successful focus movement');
  assert.equal(event.prevented, 1);
  assert.equal(target.focused, 1);
  controller.destroy();
}

{
  const h = makeHarness({ listOptions: { queryThrows: true } });
  const controller = api.createController({ documentRef: h.documentRef });
  controller.mount();
  const event = eventFor(h.buttons[0], 'ArrowDown');
  assert.equal(h.list.listener()(event), false, 'button enumeration failure fails closed');
  assert.equal(event.prevented, 0);
  assert.equal(h.buttons[1].focused, 0);
  controller.destroy();
}

{
  const malformed = {
    name: 'malformed',
    hidden: false,
    disabled: false,
    classList: { contains: () => true },
    closest() { throw new Error('bad host node'); }
  };
  const good = makeButton('good');
  const visible = api.visibleConversationButtons({ querySelectorAll: () => [malformed, good] });
  assert.deepEqual(visible.map((button) => button.name), ['good'], 'one malformed row cannot poison the visible-button set');
}

{
  const h = makeHarness();
  const controller = api.createController({ documentRef: h.documentRef });
  controller.mount();
  const listener = h.list.listener();

  for (const extras of [
    { altKey: true },
    { ctrlKey: true },
    { metaKey: true },
    { shiftKey: true },
    { defaultPrevented: true }
  ]) {
    const event = eventFor(h.buttons[0], 'ArrowDown', extras);
    assert.equal(listener(event), false);
    assert.equal(event.prevented, 0);
  }

  for (const key of ['Enter', 'Escape', 'PageUp', 'Tab', 'x']) {
    const event = eventFor(h.buttons[0], key);
    assert.equal(listener(event), false);
    assert.equal(event.prevented, 0);
  }

  const editable = makeButton('editable', { editable: true });
  editable.classList = { contains: () => true };
  const editableEvent = eventFor(editable, 'ArrowDown');
  assert.equal(listener(editableEvent), false);
  assert.equal(editableEvent.prevented, 0);
  controller.destroy();
}

{
  const h = makeHarness();
  const controller = api.createController({ documentRef: h.documentRef });
  controller.mount();
  const listener = h.list.listener();

  const outsider = makeButton('outsider');
  const event = eventFor(outsider, 'ArrowDown');
  assert.equal(listener(event), false, 'conversation-looking nodes outside the owned list are ignored');
  assert.equal(event.prevented, 0);

  const noClassList = eventFor({ tagName: 'BUTTON' }, 'ArrowDown');
  assert.equal(listener(noClassList), false);
  assert.equal(noClassList.prevented, 0);

  assert.equal(listener(null), false);
  controller.destroy();
}

{
  const h = makeHarness();
  const controller = api.createController({ documentRef: h.documentRef });
  controller.mount();
  const listener = h.list.listener();

  h.buttons[1].hidden = true;
  const skipHidden = eventFor(h.buttons[0], 'ArrowDown');
  assert.equal(listener(skipHidden), true);
  assert.equal(h.buttons[2].focused, 1, 'hidden conversations are skipped');

  h.buttons[2].disabled = true;
  const noTarget = eventFor(h.buttons[0], 'ArrowDown');
  assert.equal(listener(noTarget), false, 'no movement occurs when every later target is unavailable');
  assert.equal(noTarget.prevented, 0);
  controller.destroy();
}

assert.throws(() => api.createController({ documentRef: null }), /INVALID_CONVERSATION_KEYBOARD_NAV_DOCUMENT/);
assert.throws(() => api.createController({ documentRef: {} }), /INVALID_CONVERSATION_KEYBOARD_NAV_DOCUMENT/);

console.log('conversation keyboard navigation fault-boundary tests passed');
