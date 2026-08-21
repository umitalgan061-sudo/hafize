import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { makeButton, makeDocument, makeList, eventFor } from './conversation-keyboard-nav-fixture.mjs';

const require = createRequire(import.meta.url);
const api = require('../public/conversation-keyboard-nav.js');
const source = fs.readFileSync(new URL('../public/conversation-keyboard-nav.js', import.meta.url), 'utf8');

assert.doesNotMatch(source, /fetch\s*\(|XMLHttpRequest|WebSocket|EventSource/);
assert.doesNotMatch(source, /localStorage|sessionStorage|indexedDB|document\.cookie/);
assert.doesNotMatch(source, /navigator\.clipboard|requestSubmit\s*\(|\.click\s*\(/);
assert.doesNotMatch(source, /location\.(?:assign|replace|reload)|window\.open/);
assert.match(source, /ACTIVE_DOCUMENTS\s*=\s*new WeakSet/);
assert.match(source, /generation\s*!==\s*installGeneration/);
assert.match(source, /documentRef\.querySelector\('#conversationList'\)\s*===\s*list/);

{
  const buttons = [makeButton('a'), makeButton('b')];
  const list = makeList(buttons);
  const documentRef = makeDocument(list);
  const controller = api.createController({ documentRef });
  controller.mount();
  const listener = list.listener();

  const hostileTarget = new Proxy({}, {
    get(_target, key) {
      if (key === 'tagName') return 'BUTTON';
      if (key === 'isContentEditable') return false;
      if (key === 'classList') throw new Error('hostile classList');
      return undefined;
    }
  });
  assert.throws(() => listener(eventFor(hostileTarget, 'ArrowDown')), /hostile classList/,
    'unexpected host property traps are not silently reinterpreted as navigation');

  const safeEvent = eventFor(buttons[0], 'ArrowDown');
  assert.equal(listener(safeEvent), true, 'controller remains usable after unrelated caller catches hostile host error');
  controller.destroy();
}

{
  const buttons = [makeButton('a'), makeButton('b')];
  const list = makeList(buttons);
  const documentRef = makeDocument(list);
  const controller = api.createController({ documentRef });
  controller.mount();
  const listener = list.listener();

  for (const malformed of [
    {},
    { key: 'ArrowDown' },
    { key: 'ArrowDown', target: null },
    { key: 'ArrowDown', target: { tagName: 'BUTTON' } },
    { key: null, target: buttons[0] }
  ]) {
    assert.equal(listener(malformed), false);
  }
  controller.destroy();
}

{
  const buttons = [makeButton('a'), makeButton('b')];
  const list = makeList(buttons);
  const documentRef = makeDocument(list);
  const controller = api.createController({ documentRef });
  controller.mount();
  const listener = list.listener();

  const fakeConversation = makeButton('fake');
  const event = eventFor(fakeConversation, 'ArrowDown');
  assert.equal(listener(event), false, 'matching CSS shape is insufficient without membership in the owned list');
  assert.equal(event.prevented, 0);
  assert.equal(buttons[0].focused + buttons[1].focused, 0);
  controller.destroy();
}

{
  const buttons = [makeButton('a'), makeButton('b'), makeButton('c')];
  const list = makeList(buttons);
  const documentRef = makeDocument(list);
  const controller = api.createController({ documentRef });
  controller.mount();
  const listener = list.listener();

  buttons[1].disabled = true;
  buttons[2].hidden = true;
  const event = eventFor(buttons[0], 'ArrowDown');
  assert.equal(listener(event), false, 'unavailable rows cannot become implicit side-effect targets');
  assert.equal(event.prevented, 0);
  controller.destroy();
}

{
  const list = makeList([makeButton('a'), makeButton('b')]);
  const documentRef = makeDocument(list);
  const first = api.createController({ documentRef });
  assert.equal(first.mount(), true);
  const captured = list.listener();
  first.destroy();

  const second = api.createController({ documentRef });
  assert.equal(second.mount(), true);
  const current = list.listener();
  assert.notEqual(captured, current);

  const stale = eventFor(list.buttons[0], 'ArrowDown');
  assert.equal(captured(stale), false);
  assert.equal(stale.prevented, 0);

  const live = eventFor(list.buttons[0], 'ArrowDown');
  assert.equal(current(live), true);
  assert.equal(live.prevented, 1);
  second.destroy();
}

console.log('conversation keyboard navigation security-contract tests passed');
