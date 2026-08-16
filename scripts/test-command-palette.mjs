import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const palette = require('../public/command-palette.js');

assert.equal(palette.COMMANDS.length, 6);
assert.equal(new Set(palette.COMMANDS.map((command) => command.id)).size, palette.COMMANDS.length);
assert.equal(palette.isOpenShortcut({ key: 'p', ctrlKey: true, shiftKey: true }), true);
assert.equal(palette.isOpenShortcut({ key: 'P', metaKey: true, shiftKey: true }), true);
assert.equal(palette.isOpenShortcut({ key: 'p', ctrlKey: true, shiftKey: false }), false);
assert.equal(palette.isOpenShortcut({ key: 'p', ctrlKey: true, shiftKey: true, altKey: true }), false);

assert.equal(palette.normalizeQuery('  YENİ SOHBET '), 'yeni sohbet');
assert.deepEqual(palette.filterCommands('tema').map((command) => command.id), ['toggle-theme']);
assert.deepEqual(palette.filterCommands('mesaj').map((command) => command.id), ['focus-composer', 'scroll-latest']);
assert.equal(palette.filterCommands('olmayan-komut').length, 0);
assert.equal(palette.filterCommands('').length, palette.COMMANDS.length);

const state = {
  focused: 0,
  clicked: 0,
  scrolled: [],
  disabled: false
};
const input = {
  disabled: false,
  focus() { state.focused += 1; }
};
const newChat = {
  disabled: false,
  click() { state.clicked += 1; }
};
const messages = {
  lastElementChild: {
    scrollIntoView(options) { state.scrolled.push(options); }
  }
};
const nodes = new Map([
  ['#messageInput', input],
  ['#newChatBtn', newChat],
  ['#messages', messages]
]);
const documentRef = {
  querySelector(selector) { return nodes.get(selector) || null; }
};

const focusCommand = palette.COMMANDS.find((command) => command.id === 'focus-composer');
const newChatCommand = palette.COMMANDS.find((command) => command.id === 'new-chat');
const scrollCommand = palette.COMMANDS.find((command) => command.id === 'scroll-latest');

assert.equal(palette.executeCommand(documentRef, focusCommand), true);
assert.equal(state.focused, 1);
assert.equal(palette.executeCommand(documentRef, newChatCommand), true);
assert.equal(state.clicked, 1);
assert.equal(palette.executeCommand(documentRef, scrollCommand), true);
assert.deepEqual(state.scrolled, [{ block: 'end', behavior: 'smooth' }]);

input.disabled = true;
assert.equal(palette.executeCommand(documentRef, focusCommand), false, 'disabled target must fail closed');
newChat.disabled = true;
assert.equal(palette.executeCommand(documentRef, newChatCommand), false, 'disabled click target must fail closed');
assert.equal(palette.executeCommand(documentRef, { id: 'forged', selector: '#newChatBtn', action: 'click' }), false, 'forged command object must not execute');
assert.equal(palette.executeCommand({ querySelector: () => null }, focusCommand), false);

const allowedActions = new Set(['focus', 'click', 'scroll-end']);
for (const command of palette.COMMANDS) {
  assert.ok(command.id);
  assert.ok(command.label);
  assert.ok(command.selector.startsWith('#'));
  assert.ok(allowedActions.has(command.action));
  assert.equal(Object.isFrozen(command), true);
}
assert.equal(Object.isFrozen(palette.COMMANDS), true);

const serialized = JSON.stringify(palette.COMMANDS);
for (const forbidden of ['/api/', 'http://', 'https://', 'toolModeBtn', 'sendBtn', 'clearHistoryBtn']) {
  assert.equal(serialized.includes(forbidden), false, `command allowlist must exclude ${forbidden}`);
}

console.log('command palette policy passed: local-only immutable command allowlist');
