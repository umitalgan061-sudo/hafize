import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { makeButton, makeDocument, makeList, eventFor } from './conversation-keyboard-nav-fixture.mjs';

const require = createRequire(import.meta.url);
const api = require('../public/conversation-keyboard-nav.js');

function run(buttons, sourceIndex, key) {
  const list = makeList(buttons);
  const documentRef = makeDocument(list);
  const controller = api.createController({ documentRef });
  assert.equal(controller.mount(), true);
  const event = eventFor(buttons[sourceIndex], key);
  const handled = list.listener()(event);
  controller.destroy();
  return { event, handled };
}

{
  const buttons = [makeButton('a'), makeButton('b'), makeButton('c'), makeButton('d')];
  let result = run(buttons, 1, 'Home');
  assert.equal(result.handled, true);
  assert.equal(buttons[0].focused, 1);

  buttons.forEach((button) => { button.focused = 0; });
  result = run(buttons, 1, 'End');
  assert.equal(result.handled, true);
  assert.equal(buttons[3].focused, 1);
}

{
  const buttons = [makeButton('a'), makeButton('hidden', { hidden: true }), makeButton('c')];
  const { event, handled } = run(buttons, 0, 'ArrowDown');
  assert.equal(handled, true);
  assert.equal(event.prevented, 1);
  assert.equal(buttons[1].focused, 0);
  assert.equal(buttons[2].focused, 1);
}

{
  const buttons = [makeButton('a'), makeButton('row-hidden', { rowHidden: true }), makeButton('c')];
  const { handled } = run(buttons, 2, 'ArrowUp');
  assert.equal(handled, true);
  assert.equal(buttons[1].focused, 0);
  assert.equal(buttons[0].focused, 1);
}

{
  const buttons = [makeButton('a'), makeButton('disabled', { disabled: true }), makeButton('c')];
  const { handled } = run(buttons, 0, 'End');
  assert.equal(handled, true);
  assert.equal(buttons[2].focused, 1);
}

{
  const buttons = [makeButton('only')];
  for (const key of api.SUPPORTED_KEYS) {
    const { event, handled } = run(buttons, 0, key);
    assert.equal(handled, false, `${key} stays a no-op when focus cannot move`);
    assert.equal(event.prevented, 0);
  }
}

{
  assert.equal(api.nextIndex(2, 'ArrowDown', 5), 3);
  assert.equal(api.nextIndex(2, 'ArrowUp', 5), 1);
  assert.equal(api.nextIndex(2, 'Home', 5), 0);
  assert.equal(api.nextIndex(2, 'End', 5), 4);
  assert.equal(api.nextIndex(2, 'Other', 5), 2);
  assert.equal(api.nextIndex(Number.NaN, 'Home', 5), -1);
  assert.equal(api.nextIndex(0, 'Home', -1), -1);
}

{
  for (const tagName of ['INPUT', 'textarea', 'Select']) {
    assert.equal(api.isEditableTarget({ tagName }), true);
  }
  assert.equal(api.isEditableTarget({ tagName: 'DIV', isContentEditable: true }), true);
  assert.equal(api.isEditableTarget({ tagName: 'BUTTON' }), false);
  assert.equal(api.isEditableTarget(null), false);
}

console.log('conversation keyboard navigation accessibility tests passed');
