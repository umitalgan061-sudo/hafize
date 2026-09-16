// Stopping and regenerating an answer, exercised against the real chat runtime.
//
// The interesting part of a stop is not the button — it is what happens to the
// half-written answer when the request is aborted mid-stream. Asserting that
// from the source text proves nothing, so this suite mounts `public/app.js` on
// a stand-in chat shell, serves it a controllable SSE body, aborts it partway
// through, and reads the transcript that survives. The regenerate path is
// checked the same way, including the request it actually sends.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createStorageStub } from './browser-storage-stub.mjs';
import { click, createDocument, createWindow, FakeEvent, installDomGlobals } from './dom-harness.mjs';

const require = createRequire(import.meta.url);
const encoder = new TextEncoder();

installDomGlobals();

const documentRef = createDocument();
const view = createWindow(documentRef, { scrollTo: () => {}, innerWidth: 1280 });

function element(tag, id, className) {
  const node = documentRef.createElement(tag);
  if (id) node.id = id;
  if (className) node.className = className;
  return node;
}

// The chat shell `app.js` queries on load, reduced to the nodes it touches.
const composer = element('form', 'composer');
const messageInput = element('textarea', 'messageInput');
const composerRow = element('div', null, 'composer-row');
const composerActions = element('div', null, 'composer-actions');
const sendButton = element('button', null, 'send-btn');
sendButton.type = 'submit';
composerActions.append(sendButton);
composerRow.append(composerActions);
composer.append(messageInput, composerRow);

const messages = element('div', 'messages');
const welcome = element('div', 'welcome');
const toast = element('div', 'toast');
const modelSelect = element('select', 'modelSelect');
const agentSelect = element('select', 'agentSelect');
const toolModeBtn = element('button', 'toolModeBtn');
const conversationList = element('div', 'conversationList');

documentRef.body.append(
  element('aside', 'sidebar'),
  element('button', 'sidebarToggle'),
  element('button', 'newChatBtn'),
  element('button', 'clearHistoryBtn'),
  conversationList,
  messages,
  welcome,
  element('button', 'installBtn'),
  toast,
  modelSelect,
  agentSelect,
  toolModeBtn,
  element('button', 'attachBtn'),
  element('button', 'micBtn'),
  composer
);

// --- browser globals the runtime reads -------------------------------------

const storage = createStorageStub();
globalThis.document = documentRef;
globalThis.window = view;
globalThis.localStorage = storage;
// Node's own `navigator` has no `serviceWorker`, which is the branch the
// runtime takes in a browser that cannot register one.
globalThis.requestAnimationFrame = (callback) => { callback(); return 0; };
globalThis.CSS = { escape: (value) => String(value) };
globalThis.Option = function Option(label, value) {
  const option = documentRef.createElement('option');
  option.textContent = label;
  option.value = value ?? '';
  return option;
};

// --- a controllable SSE body -----------------------------------------------

function createBody(signal) {
  const chunks = [];
  let waiting = null;
  let closed = false;
  let failure = null;

  function settle() {
    if (!waiting) return;
    if (failure) {
      const { reject } = waiting;
      waiting = null;
      reject(failure);
      return;
    }
    if (chunks.length) {
      const { resolve } = waiting;
      waiting = null;
      resolve({ value: encoder.encode(chunks.shift()), done: false });
      return;
    }
    if (closed) {
      const { resolve } = waiting;
      waiting = null;
      resolve({ value: undefined, done: true });
    }
  }

  signal?.addEventListener?.('abort', () => {
    failure = Object.assign(new Error('The operation was aborted.'), { name: 'AbortError' });
    settle();
  });

  return {
    delta(text) {
      chunks.push(`data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`);
      settle();
    },
    close() { closed = true; settle(); },
    body: { getReader: () => ({ read: () => new Promise((resolve, reject) => { waiting = { resolve, reject }; settle(); }) }) }
  };
}

const turns = [];
let openBody = null;

globalThis.fetch = async (url, options = {}) => {
  if (url === '/api/models') return { ok: true, json: async () => ({ models: ['meta/llama-3.3'] }) };
  if (url === '/api/agents') {
    return {
      ok: true,
      json: async () => ({ agents: [{ id: 'hafize', name: 'Hafize', kind: 'general' }], defaultAgent: 'hafize' })
    };
  }
  turns.push({ url, payload: JSON.parse(options.body) });
  openBody = createBody(options.signal);
  return { ok: true, body: openBody.body, statusText: 'OK' };
};

// --- mount ------------------------------------------------------------------

const policy = require('../public/chat-stream-policy.js');
globalThis.HafizeChatStreamPolicy = policy;
view.HafizeChatStreamPolicy = policy;
const control = require('../public/chat-stream-control.js');
require('../public/app.js');
const panel = control.mount(documentRef, view);
assert.ok(panel?.mounted, 'the composer controls mount on the runtime shell');

const settle = async (rounds = 8) => {
  for (let index = 0; index < rounds; index += 1) await new Promise((resolve) => setImmediate(resolve));
};

await settle();
modelSelect.value = 'meta/llama-3.3';

const conversation = () => JSON.parse(storage.getItem('hafize.conversations.v1') || '[]')[0] ?? null;
const answerNodes = () => messages.querySelectorAll('.message.assistant');

function send(text) {
  messageInput.value = text;
  composer.dispatchEvent(new FakeEvent('submit', { bubbles: true, cancelable: true }));
}

// --- a stopped answer keeps what already arrived ---------------------------

send('Uzun bir özet yaz');
await settle();
assert.equal(turns.length, 1, 'sending opens one turn');
assert.equal(turns[0].url, '/api/chat');
assert.deepEqual(turns[0].payload.messages, [{ role: 'user', content: 'Uzun bir özet yaz' }]);
assert.equal(panel.state().streaming, true, 'the controls learn the turn started');
assert.equal(panel.stopButton.hidden, false);
assert.equal(sendButton.hidden, true, 'send is out of reach while the answer streams');

openBody.delta('Özet: ilk cümle. ');
openBody.delta('İkinci cümle');
await settle();
assert.match(messages.textContent, /Özet: ilk cümle\. İkinci cümle/, 'deltas paint as they arrive');

click(panel.stopButton);
await settle();

const stoppedTurn = conversation();
assert.equal(stoppedTurn.messages.length, 2, 'the stopped answer stays in the transcript');
assert.equal(stoppedTurn.messages[1].role, 'assistant');
assert.equal(stoppedTurn.messages[1].content, 'Özet: ilk cümle. İkinci cümle', 'the partial answer is kept verbatim');
assert.equal(stoppedTurn.messages[1].stopped, true, 'and is flagged as stopped');
assert.equal(answerNodes()[0].dataset.stopped, 'true');
assert.match(answerNodes()[0].textContent, /durduruldu/i, 'the transcript says the answer was stopped');
assert.equal(messageInput.disabled, false, 'the composer is usable again');
assert.equal(panel.state().streaming, false);
assert.equal(panel.stopButton.hidden, true);
assert.equal(sendButton.hidden, false);

// Nothing else arrives after a stop: the aborted body is done with.
assert.equal(turns.length, 1);

// --- regenerating replaces that answer, and does not send it back ----------

assert.equal(panel.regenerateButton.hidden, false, 'a stopped answer can be regenerated');
click(panel.regenerateButton);
await settle();

assert.equal(turns.length, 2, 'regenerating opens a new turn');
assert.equal(turns[1].url, '/api/chat');
assert.deepEqual(
  turns[1].payload.messages,
  [{ role: 'user', content: 'Uzun bir özet yaz' }],
  'the answer being replaced is not shown to the model'
);

openBody.delta('Tam yanıt.');
openBody.close();
await settle();

const finished = conversation();
assert.equal(finished.messages.length, 2);
assert.equal(finished.messages[1].content, 'Tam yanıt.');
assert.equal(finished.messages[1].stopped, undefined, 'the replacement is not marked stopped');
assert.equal(answerNodes().length, 1, 'the replaced answer is gone from the transcript');
assert.equal(panel.state().canRegenerate, true, 'a finished answer can be regenerated too');

// --- stopping before a single byte arrives ---------------------------------

send('İkinci soru');
await settle();
assert.equal(turns.length, 3);
click(panel.stopButton);
await settle();

const early = conversation();
assert.equal(early.messages.at(-1).role, 'assistant');
assert.equal(early.messages.at(-1).stopped, true);
assert.equal(early.messages.at(-1).content, policy.STOPPED_NOTE, 'an answer with no content falls back to the note');
assert.equal(panel.state().streaming, false);

// --- regenerating is refused while a turn is open --------------------------

send('Üçüncü soru');
await settle();
assert.equal(turns.length, 4);
view.dispatchEvent(new FakeEvent('hafize:regenerate-answer', { detail: {} }));
await settle();
assert.equal(turns.length, 4, 'a regenerate during a streaming turn is ignored');
assert.match(toast.textContent, /Yanıt sürerken/, 'and says why');

openBody.delta('Bitti.');
openBody.close();
await settle();
assert.equal(conversation().messages.at(-1).content, 'Bitti.');

console.log('chat stream runtime: ok');
