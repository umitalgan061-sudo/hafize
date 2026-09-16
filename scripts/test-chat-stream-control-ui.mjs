// Stop / regenerate controls, exercised through the composer they mount on.
//
// The contract that matters is behavioural: the right button is reachable in
// each state, clicking it sends the runtime a command, Escape stops a running
// answer without stealing the key from an open dialog, and focus never lands on
// a control that was just hidden. So the suite mounts the real module on a
// stand-in composer and clicks the real buttons.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { click, createDocument, createWindow, installDomGlobals, keydown } from './dom-harness.mjs';

const require = createRequire(import.meta.url);

installDomGlobals();
const policy = require('../public/chat-stream-policy.js');
globalThis.HafizeChatStreamPolicy = policy;
const control = require('../public/chat-stream-control.js');
assert.ok(control?.mount, 'the control module exposes its mount');

function setup() {
  const documentRef = createDocument();
  const composer = documentRef.createElement('form');
  composer.id = 'composer';
  const input = documentRef.createElement('textarea');
  input.id = 'messageInput';
  const actions = documentRef.createElement('div');
  actions.className = 'composer-actions';
  const send = documentRef.createElement('button');
  send.className = 'send-btn';
  send.type = 'submit';
  actions.append(send);
  composer.append(input, actions);
  documentRef.body.append(composer);

  const view = createWindow(documentRef);
  const commands = [];
  view.addEventListener('hafize:stop-stream', (event) => commands.push(['stop', event.detail?.source]));
  view.addEventListener('hafize:regenerate-answer', (event) => commands.push(['regenerate', event.detail?.source]));

  const mounted = control.mount(documentRef, view);
  assert.ok(mounted?.mounted, 'mounting returns the control surface');
  const broadcast = (state) => view.dispatchEvent(new view.CustomEvent('hafize:stream-state', { detail: state }));
  return { documentRef, view, commands, mounted, send, input, broadcast };
}

const user = { id: 'u1', role: 'user', content: 'Merhaba' };
const answer = (extra = {}) => ({ id: 'a1', role: 'assistant', content: 'Selam', ...extra });

// --- idle: nothing to stop, nothing yet to regenerate ----------------------

{
  const { mounted, send, commands } = setup();
  assert.equal(mounted.stopButton.hidden, true, 'stop stays out of the way when no answer is running');
  assert.equal(mounted.regenerateButton.hidden, true);
  assert.equal(send.hidden, false, 'send is the only action on an idle composer');
  assert.equal(mounted.statusElement.textContent, '');
  click(mounted.stopButton);
  click(mounted.regenerateButton);
  assert.deepEqual(commands, [], 'a disabled control sends nothing even if something clicks it');
}

// --- streaming: stop replaces send ----------------------------------------

{
  const { mounted, send, commands, broadcast, documentRef } = setup();
  broadcast(policy.describeState({ streaming: true, hasActiveStream: true, messages: [user, answer({ content: '' })] }));
  assert.equal(mounted.stopButton.hidden, false);
  assert.equal(mounted.stopButton.disabled, false);
  assert.equal(send.hidden, true, 'send is replaced while the answer streams');
  assert.equal(mounted.regenerateButton.hidden, true, 'regenerating mid-answer would race the open turn');
  assert.equal(mounted.statusElement.textContent, control.STREAMING_LABEL);
  assert.equal(mounted.statusElement.getAttribute('aria-live'), 'polite');
  assert.equal(mounted.statusElement.getAttribute('role'), 'status');

  click(mounted.stopButton);
  assert.deepEqual(commands, [['stop', control.CONTROL_ID]], 'the click asks the runtime to stop');

  const escape = keydown(documentRef.body, 'Escape');
  assert.equal(escape, false, 'Escape is consumed while an answer is running');
  assert.deepEqual(commands.map(([name]) => name), ['stop', 'stop']);
}

// --- streaming before the request opens ------------------------------------

{
  const { mounted, commands, broadcast } = setup();
  broadcast(policy.describeState({ streaming: true, hasActiveStream: false, messages: [user] }));
  assert.equal(mounted.stopButton.hidden, false, 'the control is visible as soon as the turn starts');
  assert.equal(mounted.stopButton.disabled, true, 'but there is nothing to abort yet');
  click(mounted.stopButton);
  assert.deepEqual(commands, [], 'and clicking it sends nothing');
}

// --- Escape belongs to an open dialog --------------------------------------

{
  const { mounted, commands, broadcast, documentRef } = setup();
  const dialog = documentRef.createElement('div');
  dialog.setAttribute('role', 'dialog');
  documentRef.body.append(dialog);
  broadcast(policy.describeState({ streaming: true, hasActiveStream: true, messages: [user, answer()] }));
  keydown(documentRef.body, 'Escape');
  assert.deepEqual(commands, [], 'a panel that owns Escape keeps it');
  click(mounted.stopButton);
  assert.equal(commands.length, 1, 'the button still works while a dialog is open');
}

// --- after the answer: regenerate becomes available ------------------------

{
  const { mounted, send, commands, broadcast } = setup();
  broadcast(policy.describeState({ streaming: false, hasActiveStream: false, messages: [user, answer()] }));
  assert.equal(mounted.stopButton.hidden, true);
  assert.equal(send.hidden, false, 'send comes back when the turn ends');
  assert.equal(mounted.regenerateButton.hidden, false);
  assert.equal(mounted.regenerateButton.disabled, false);
  assert.equal(mounted.statusElement.textContent, '');
  click(mounted.regenerateButton);
  assert.deepEqual(commands, [['regenerate', control.CONTROL_ID]]);
}

// --- a stopped answer says so ----------------------------------------------

{
  const { mounted, broadcast } = setup();
  broadcast(policy.describeState({
    streaming: false,
    hasActiveStream: false,
    messages: [user, answer({ content: 'yarım', stopped: true })]
  }));
  assert.equal(mounted.statusElement.textContent, policy.STOPPED_BADGE);
  assert.equal(mounted.regenerateButton.hidden, false, 'a stopped answer is the one most worth retrying');
}

// --- focus follows the control that replaced the one being hidden ----------

{
  const { mounted, send, input, broadcast, documentRef } = setup();
  send.focus();
  assert.equal(documentRef.activeElement, send);
  broadcast(policy.describeState({ streaming: true, hasActiveStream: true, messages: [user, answer()] }));
  assert.equal(documentRef.activeElement, mounted.stopButton, 'focus moves to stop when send is hidden');
  broadcast(policy.describeState({ streaming: false, hasActiveStream: false, messages: [user, answer()] }));
  assert.equal(documentRef.activeElement, send, 'and back again when the turn ends');

  input.focus();
  broadcast(policy.describeState({ streaming: true, hasActiveStream: true, messages: [user, answer()] }));
  assert.equal(documentRef.activeElement, input, 'focus elsewhere is left alone');
}

// --- accessible names and teardown -----------------------------------------

{
  const { mounted, send, documentRef } = setup();
  assert.equal(mounted.stopButton.getAttribute('aria-label'), 'Akan yanıtı durdur');
  assert.equal(mounted.regenerateButton.getAttribute('aria-label'), 'Son yanıtı yeniden üret');
  assert.equal(mounted.stopButton.type, 'button', 'the controls never submit the composer');
  assert.equal(mounted.regenerateButton.type, 'button');
  assert.equal(control.mount(documentRef, createWindow(documentRef)), mounted, 'mounting twice reuses the control');

  mounted.destroy();
  assert.equal(documentRef.getElementById(control.CONTROL_ID), null);
  assert.equal(send.hidden, false, 'teardown gives the composer its send button back');
}

// --- a composer without the actions row is left alone ----------------------

{
  const documentRef = createDocument();
  assert.equal(control.mount(documentRef, createWindow(documentRef)), null, 'nothing to mount on, nothing mounted');
}

console.log('chat stream control ui: ok');
