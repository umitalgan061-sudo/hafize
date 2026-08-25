import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const scrollApi = require('../public/scroll-to-latest.js');
const swPolicy = require('../public/sw-policy.js');

assert.equal(scrollApi.NEAR_BOTTOM_PX, 96);
assert.equal(scrollApi.distanceToBottom({ scrollY: 100, innerHeight: 500, scrollHeight: 1000 }), 400);
assert.equal(scrollApi.distanceToBottom({ scrollY: 900, innerHeight: 500, scrollHeight: 1000 }), 0);
assert.equal(scrollApi.distanceToBottom({ scrollY: -1, innerHeight: 'bad', scrollHeight: 200 }), 200);
assert.equal(scrollApi.isNearBottom({ scrollY: 404, innerHeight: 500, scrollHeight: 1000 }), true);
assert.equal(scrollApi.isNearBottom({ scrollY: 403, innerHeight: 500, scrollHeight: 1000 }), false);
assert.equal(scrollApi.isNearBottom({ scrollY: 0, innerHeight: 500, scrollHeight: 1000 }, -1), false);

class FakeTarget {
  constructor() { this.listeners = new Map(); }
  addEventListener(type, handler) {
    const values = this.listeners.get(type) || [];
    values.push(handler);
    this.listeners.set(type, values);
  }
  removeEventListener(type, handler) {
    this.listeners.set(type, (this.listeners.get(type) || []).filter((value) => value !== handler));
  }
  emit(type, event = {}) {
    for (const handler of [...(this.listeners.get(type) || [])]) handler(event);
  }
  count(type) { return (this.listeners.get(type) || []).length; }
}

class FakeElement extends FakeTarget {
  constructor(tag = 'div') {
    super();
    this.tagName = tag.toUpperCase();
    this.id = '';
    this.type = '';
    this.className = '';
    this.hidden = false;
    this.dataset = {};
    this.textContent = '';
    this.attributes = new Map();
    this.parentNode = null;
    this.children = [];
  }
  append(...nodes) {
    for (const node of nodes) {
      node.parentNode = this;
      this.children.push(node);
    }
  }
  remove() {
    if (!this.parentNode) return;
    this.parentNode.children = this.parentNode.children.filter((node) => node !== this);
    this.parentNode = null;
  }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.has(name) ? this.attributes.get(name) : null; }
  removeAttribute(name) { this.attributes.delete(name); }
}

function fixture({ existingButton = null, reducedMotion = false } = {}) {
  const messages = new FakeElement('div');
  messages.id = 'messages';
  const head = new FakeElement('head');
  const body = new FakeElement('body');
  body.scrollHeight = 1200;
  const documentElement = { scrollHeight: 1200 };
  body.append(messages);
  if (existingButton) body.append(existingButton);

  const documentRef = {
    head,
    body,
    documentElement,
    querySelector(selector) {
      if (selector === '#messages') return messages;
      if (selector === `#${scrollApi.BUTTON_ID}`) {
        return body.children.find((node) => node.id === scrollApi.BUTTON_ID) || null;
      }
      if (selector === `#${scrollApi.STYLE_ID}`) {
        return head.children.find((node) => node.id === scrollApi.STYLE_ID) || null;
      }
      return null;
    },
    createElement(tag) { return new FakeElement(tag); }
  };

  const windowRef = new FakeTarget();
  windowRef.scrollY = 800;
  windowRef.innerHeight = 400;
  windowRef.scrollCalls = [];
  windowRef.scrollTo = (options) => {
    windowRef.scrollCalls.push(options);
    windowRef.scrollY = options.top;
  };

  const frameQueue = new Map();
  let nextFrame = 1;
  const requestAnimationFrameImpl = (callback) => {
    const id = nextFrame++;
    frameQueue.set(id, callback);
    return id;
  };
  const cancelAnimationFrameImpl = (id) => frameQueue.delete(id);
  const flushFrames = () => {
    for (const [id, callback] of [...frameQueue]) {
      frameQueue.delete(id);
      callback();
    }
  };

  let mutationCallback = null;
  let observeArgs = null;
  let disconnectCount = 0;
  class FakeMutationObserver {
    constructor(callback) { mutationCallback = callback; }
    observe(target, options) { observeArgs = { target, options }; }
    disconnect() { disconnectCount += 1; }
  }

  const options = {
    documentRef,
    windowRef,
    MutationObserverImpl: FakeMutationObserver,
    requestAnimationFrameImpl,
    cancelAnimationFrameImpl,
    matchMediaImpl: () => ({ matches: reducedMotion })
  };
  return {
    messages, head, body, documentRef, windowRef, options, frameQueue,
    flushFrames,
    mutation: () => mutationCallback?.(),
    observeArgs: () => observeArgs,
    disconnectCount: () => disconnectCount
  };
}

{
  const f = fixture();
  const controller = scrollApi.createController(f.options);
  assert.equal(controller.mount(), true);
  f.flushFrames();
  const button = f.documentRef.querySelector(`#${scrollApi.BUTTON_ID}`);
  assert.ok(button);
  assert.equal(button.hidden, true, 'near-bottom mount should hide the control');
  assert.deepEqual(f.observeArgs(), {
    target: f.messages,
    options: { childList: true, subtree: true, characterData: true }
  });

  f.mutation();
  f.flushFrames();
  assert.equal(f.windowRef.scrollCalls.at(-1).behavior, 'auto', 'pinned streaming follows without smooth animation');

  f.windowRef.scrollY = 200;
  f.windowRef.emit('scroll');
  f.flushFrames();
  assert.equal(controller.snapshot().pinned, false);
  assert.equal(button.hidden, false);
  assert.equal(button.textContent, '↓ En alta git');

  f.mutation();
  f.flushFrames();
  assert.equal(controller.snapshot().unseen, true);
  assert.equal(button.textContent, '↓ Yeni yanıt');
  assert.equal(button.dataset.state, 'new');
  const callsBeforeClick = f.windowRef.scrollCalls.length;
  button.emit('click');
  f.flushFrames();
  assert.equal(f.windowRef.scrollCalls.length, callsBeforeClick + 1);
  assert.equal(f.windowRef.scrollCalls.at(-1).behavior, 'smooth');
  assert.equal(button.hidden, true);

  const staleMutation = f.mutation;
  assert.equal(controller.destroy(), true);
  assert.equal(controller.snapshot().destroyed, true);
  assert.equal(f.documentRef.querySelector(`#${scrollApi.BUTTON_ID}`), null, 'owned button removed on teardown');
  assert.equal(f.documentRef.querySelector(`#${scrollApi.STYLE_ID}`), null, 'owned style removed on teardown');
  const callsAfterDestroy = f.windowRef.scrollCalls.length;
  staleMutation();
  f.windowRef.emit('scroll');
  assert.equal(f.windowRef.scrollCalls.length, callsAfterDestroy, 'stale callbacks are inert after destroy');
  assert.equal(controller.scrollToBottom({ smooth: true }), false);
  assert.equal(controller.mount(), false, 'destroyed controller cannot remount');
  assert.equal(controller.destroy(), false, 'destroy is idempotent');
}

{
  const existing = new FakeElement('button');
  existing.id = scrollApi.BUTTON_ID;
  existing.hidden = false;
  existing.textContent = 'Host control';
  existing.dataset.state = 'host';
  existing.setAttribute('aria-label', 'Host label');
  const f = fixture({ existingButton: existing, reducedMotion: true });
  const controller = scrollApi.createController(f.options);
  assert.equal(controller.mount(), true);
  f.flushFrames();
  f.windowRef.scrollY = 100;
  f.windowRef.emit('scroll');
  f.flushFrames();
  existing.emit('click');
  f.flushFrames();
  assert.equal(f.windowRef.scrollCalls.at(-1).behavior, 'auto', 'reduced motion disables smooth scrolling');
  assert.equal(controller.destroy(), true);
  assert.equal(existing.parentNode, f.body, 'host button remains owned by host');
  assert.equal(existing.hidden, false);
  assert.equal(existing.textContent, 'Host control');
  assert.equal(existing.dataset.state, 'host');
  assert.equal(existing.getAttribute('aria-label'), 'Host label');
  assert.equal(existing.count('click'), 0);
}

{
  const existing = new FakeElement('button');
  existing.id = scrollApi.BUTTON_ID;
  existing.dataset = {};
  existing.textContent = 'Bare host';
  const snapshot = scrollApi.snapshotButtonState(existing);
  existing.hidden = true;
  existing.dataset.state = 'new';
  existing.textContent = 'Changed';
  existing.setAttribute('aria-label', 'Changed label');
  assert.equal(scrollApi.restoreButtonState(existing, snapshot), true);
  assert.equal(existing.hidden, false);
  assert.equal(existing.textContent, 'Bare host');
  assert.equal(Object.prototype.hasOwnProperty.call(existing.dataset, 'state'), false);
  assert.equal(existing.getAttribute('aria-label'), null);
}

const sourcePath = fileURLToPath(new URL('../public/scroll-to-latest.js', import.meta.url));
const loaderPath = fileURLToPath(new URL('../public/chat-run-controller.js', import.meta.url));
const policyPath = fileURLToPath(new URL('../public/sw-policy.js', import.meta.url));
const docPath = fileURLToPath(new URL('../docs/SCROLL_TO_LATEST_SECURITY.md', import.meta.url));
const [source, loader, policy, doc] = await Promise.all([
  readFile(sourcePath, 'utf8'),
  readFile(loaderPath, 'utf8'),
  readFile(policyPath, 'utf8'),
  readFile(docPath, 'utf8')
]);

for (const path of [sourcePath, loaderPath, policyPath]) {
  const syntax = spawnSync(process.execPath, ['--check', path], { encoding: 'utf8' });
  assert.equal(syntax.status, 0, syntax.stderr || syntax.stdout || `${path} syntax check failed`);
}

for (const forbidden of [
  /\blocalStorage\b/, /\bsessionStorage\b/, /document\.cookie/, /\bfetch\s*\(/,
  /\bWebSocket\b/, /navigator\.clipboard/, /Authorization/i, /HAFIZE_.*(?:TOKEN|KEY|SECRET)/,
  /\.content\b/, /textContent.*message/i
]) {
  assert.equal(forbidden.test(source), false, `scroll controller must not cross data boundary: ${forbidden}`);
}

assert.equal(source.includes('const ACTIVE_DOCUMENTS = new WeakSet()'), true);
assert.equal(source.includes('ACTIVE_DOCUMENTS.has(documentRef)'), true);
assert.equal(source.includes('rollbackMount()'), true);
assert.equal(source.includes('scheduledGeneration !== generation'), true);
assert.equal(source.includes("observer.observe(messages, { childList: true, subtree: true, characterData: true })"), true);
assert.equal(source.includes("'(prefers-reduced-motion: reduce)'"), true);
assert.equal(loader.includes("loadShellEnhancement('HafizeScrollToLatest', '/scroll-to-latest.js', 'data-hafize-scroll-to-latest')"), true);
assert.match(swPolicy.CURRENT_CACHE, /^hafize-shell-v\d+$/);
assert.equal(swPolicy.SHELL_ASSETS.includes('/scroll-to-latest.js'), true);
assert.equal(swPolicy.classifyRequest({ method: 'GET', url: 'https://hafize.example/api/chat', headers: {}, mode: 'cors' }, 'https://hafize.example'), 'network-only');
assert.equal(swPolicy.classifyRequest({ method: 'GET', url: 'https://hafize.example/scroll-to-latest.js', headers: {}, mode: 'cors' }, 'https://hafize.example'), 'shell');

assert.match(doc, /96/);
assert.match(doc, /prefers-reduced-motion/i);
assert.match(doc, /ownership|sahipli/i);
assert.match(doc, /rollback/i);
assert.match(doc, /stale|eski callback/i);
assert.match(doc, /storage/i);

console.log('scroll-to-latest UX lifecycle tests passed');
