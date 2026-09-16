// Boundaries around the stop / regenerate work.
//
// The behaviour is covered by the runtime and panel suites; what those cannot
// see is a boundary quietly moving — a second copy of the stop rules inside the
// runtime, a control module that starts talking to the network, a policy module
// that starts reaching for the DOM, or a load order that leaves the runtime
// without its policy. Those are what this suite pins.
import assert from 'node:assert/strict';
import {
  assertAnchors,
  assertCalls,
  assertClassDeclared,
  assertCssIncludes,
  assertDeclaresFunction,
  readSource
} from './source-contract.mjs';

const app = readSource('public/app.js');
const control = readSource('public/chat-stream-control.js');
const policy = readSource('public/chat-stream-policy.js');
const css = readSource('public/chat-stream-control.css');
const html = readSource('public/index.html');
const sw = readSource('public/sw-policy.js');

// --- the runtime owns the network and the transcript -----------------------

assertDeclaresFunction(app, 'stopStreaming');
assertDeclaresFunction(app, 'regenerateLastAnswer');
assertDeclaresFunction(app, 'runAssistantTurn');
assertDeclaresFunction(app, 'emitStreamState');
assertDeclaresFunction(app, 'markAnswerStopped');
assertAnchors(app, [
  ['an abort controller per turn', /new AbortController\(\)/],
  ['the chat stream carries the signal', /body: JSON\.stringify\([^\n]*\),\n\s*signal\n/],
  ['stop command', /addEventListener\('hafize:stop-stream'/],
  ['regenerate command', /addEventListener\('hafize:regenerate-answer'/],
  ['state broadcast', /dispatchEvent\(new CustomEvent\('hafize:stream-state'/],
  ['the turn is released in a finally', /finally \{\n\s*isStreaming = false;\n\s*activeStream = null;/]
], 'runtime contract');

// Both streaming endpoints are abortable; a signal on only one of them would
// leave tool mode running past a stop.
assert.equal((app.match(/\n\s*signal\n\s*\}\);/g) ?? []).length, 2, 'both /api/chat and /api/agent/run are abortable');

// The rules themselves live in one place.
assertCalls(app, 'streamPolicy');
assertAnchors(app, [
  ['policy lookup', /root\.HafizeChatStreamPolicy|window\.HafizeChatStreamPolicy/],
  ['regenerate truncation comes from the policy', /streamPolicy\(\)\?\.truncateForRegenerate/],
  ['stop state comes from the policy', /streamPolicy\(\)\?\.describeState/]
], 'policy boundary');
assert.doesNotMatch(app, /function (canRegenerate|truncateForRegenerate|describeState)\b/, 'the runtime keeps no second copy of the rules');

// --- the control module is UI only -----------------------------------------

assertDeclaresFunction(control, 'mount');
assert.doesNotMatch(control, /fetch\s*\(/, 'the controls never call the network');
assert.doesNotMatch(control, /XMLHttpRequest|WebSocket|sendBeacon/);
assert.doesNotMatch(control, /localStorage|sessionStorage|indexedDB/i, 'the controls store nothing');
assert.doesNotMatch(control, /innerHTML|outerHTML|insertAdjacentHTML/, 'the controls build DOM nodes, not markup');
assert.doesNotMatch(control, /conversations|messages\.push/, 'the controls never touch the transcript');
assertAnchors(control, [
  ['stop command', /hafize:stop-stream/],
  ['regenerate command', /hafize:regenerate-answer/],
  ['state subscription', /addEventListener\('hafize:stream-state'/],
  ['escape shortcut', /key !== 'Escape'/],
  ['dialogs keep Escape', /\[role="dialog"\]/],
  ['teardown', /removeEventListener\('hafize:stream-state'/]
], 'control contract');
assert.match(control, /aria-label/, 'the controls carry accessible names');
assert.match(control, /aria-live/, 'the status region is announced');
assert.match(control, /node\.type = 'button'/, 'the controls never submit the composer');

// --- the policy module is pure ---------------------------------------------

for (const forbidden of [/document/, /window\./, /fetch\s*\(/, /localStorage/]) {
  assert.doesNotMatch(policy, forbidden, `the policy stays free of ${forbidden}`);
}
assertAnchors(policy, [
  ['frozen surface', /Object\.freeze\(\{/],
  ['abort detection', /AbortError/],
  ['stopped note', /STOPPED_NOTE/]
], 'policy contract');

// --- styles -----------------------------------------------------------------

for (const selector of ['.chat-stream-control', '.chat-stream-status', '.chat-stream-stop', '.chat-stream-regenerate']) {
  assertClassDeclared(control, selector, `the module uses ${selector}`);
  assertCssIncludes(css, selector, `the stylesheet defines ${selector}`);
}
assertCssIncludes(css, '.message-stopped', 'a stopped answer is styled');
assertClassDeclared(app, '.message-stopped', 'the runtime marks a stopped answer');
assertCssIncludes(css, '@media (max-width: 560px)', 'the controls are considered on a phone');
assertCssIncludes(css, '[hidden]', 'hidden controls are hidden');

// --- load order and offline shell ------------------------------------------

const order = ['/chat-stream-policy.js', '/app.js', '/chat-stream-control.js'].map((file) => html.indexOf(file));
assert.ok(order.every((index) => index >= 0), 'index.html loads the runtime, its policy and its controls');
assert.deepEqual([...order].sort((a, b) => a - b), order, 'the policy loads before the runtime, the controls after it');
assert.match(html, /<link rel="stylesheet" href="\/chat-stream-control\.css"/, 'the stylesheet is linked');

for (const asset of ['/chat-stream-policy.js', '/chat-stream-control.js', '/chat-stream-control.css']) {
  assert.ok(sw.includes(`'${asset}'`), `${asset} is cached for offline use`);
}

console.log('chat stream source contracts: ok');
