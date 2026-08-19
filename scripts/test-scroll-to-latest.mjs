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
    for (const handler of this.listeners.get(type) || []) handler(event);
  }
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
    this.removed = false;
  }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  remove() { this.removed = true; }
}

const messages = new FakeElement('div');
messages.id = 'messages';
const head = {
  nodes: [],
  append(node) { this.nodes.push(node); }
};
const body = new FakeElement('body');
body.scrollHeight = 1200;
body.nodes = [];
body.append = (node) => body.nodes.push(node);
const documentElement = { scrollHeight: 1200 };
const documentRef = {
  head,
  body,
  documentElement,
  querySelector(selector) {
    if (selector === '#messages') return messages;
    if (selector === `#${scrollApi.BUTTON_ID}`) return body.nodes.find((node) => node.id === scrollApi.BUTTON_ID && !node.removed) || null;
    if (selector === `#${scrollApi.STYLE_ID}`) return head.nodes.find((node) => node.id === scrollApi.STYLE_ID) || null;
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
function requestAnimationFrameImpl(callback) {
  const id = nextFrame++;
  frameQueue.set(id, callback);
  return id;
}
function cancelAnimationFrameImpl(id) { frameQueue.delete(id); }
function flushFrames() {
  for (const [id, callback] of [...frameQueue]) {
    frameQueue.delete(id);
    callback();
  }
}

let mutationCallback = null;
let observeArgs = null;
let disconnected = false;
class FakeMutationObserver {
  constructor(callback) { mutationCallback = callback; }
  observe(target, options) { observeArgs = { target, options }; }
  disconnect() { disconnected = true; }
}

const controller = scrollApi.createController({
  documentRef,
  windowRef,
  MutationObserverImpl: FakeMutationObserver,
  requestAnimationFrameImpl,
  cancelAnimationFrameImpl,
  matchMediaImpl: () => ({ matches: false })
});
assert.equal(controller.mount(), true);
flushFrames();
const button = body.nodes.find((node) => node.id === scrollApi.BUTTON_ID);
assert.ok(button);
assert.equal(button.hidden, true, 'near-bottom mount should not show control');
assert.deepEqual(observeArgs, {
  target: messages,
  options: { childList: true, subtree: true, characterData: true }
});

mutationCallback();
flushFrames();
assert.equal(windowRef.scrollCalls.at(-1).behavior, 'auto', 'pinned streaming changes should follow without smooth animation');
assert.equal(button.hidden, true);

windowRef.scrollY = 200;
windowRef.emit('scroll');
flushFrames();
assert.equal(controller.snapshot().pinned, false);
assert.equal(button.hidden, false);
assert.equal(button.textContent, '↓ En alta git');
assert.equal(button.dataset.state, 'idle');

mutationCallback();
flushFrames();
assert.equal(controller.snapshot().unseen, true);
assert.equal(button.textContent, '↓ Yeni yanıt');
assert.equal(button.dataset.state, 'new');
assert.equal(windowRef.scrollCalls.length, 1, 'new content must not force-scroll a user who moved up');

button.emit('click');
flushFrames();
assert.equal(windowRef.scrollCalls.at(-1).top, 1200);
assert.equal(windowRef.scrollCalls.at(-1).behavior, 'smooth');
assert.equal(controller.snapshot().unseen, false);
assert.equal(button.hidden, true);

assert.equal(controller.destroy(), true);
assert.equal(disconnected, true);
assert.equal(button.removed, true);
const callsBefore = windowRef.scrollCalls.length;
windowRef.emit('scroll');
assert.equal(windowRef.scrollCalls.length, callsBefore, 'destroyed controller must detach scroll listener');
assert.equal(controller.destroy(), false);

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
  /\blocalStorage\b/,
  /\bsessionStorage\b/,
  /document\.cookie/,
  /\bfetch\s*\(/,
  /\bWebSocket\b/,
  /navigator\.clipboard/,
  /Authorization/i,
  /HAFIZE_.*(?:TOKEN|KEY|SECRET)/,
  /\.content\b/,
  /textContent.*message/i
]) {
  assert.equal(forbidden.test(source), false, `scroll controller must not cross data boundary: ${forbidden}`);
}

assert.equal(source.includes("documentRef.querySelector('#messages')"), true);
assert.equal(source.includes("observer.observe(messages, { childList: true, subtree: true, characterData: true })"), true);
assert.equal(source.includes("windowRef.addEventListener('scroll', handleScroll, { passive: true })"), true);
assert.equal(source.includes("windowRef.removeEventListener?.('scroll', handleScroll)"), true);
assert.equal(source.includes("button?.removeEventListener?.('click', handleButtonClick)"), true);
assert.equal(source.includes("if (buttonOwned) button?.remove?.()"), true);
assert.equal(source.includes('scheduledGeneration !== generation'), true);
assert.equal(source.includes("'(prefers-reduced-motion: reduce)'"), true);
assert.equal(loader.includes("loadShellEnhancement('HafizeScrollToLatest', '/scroll-to-latest.js', 'data-hafize-scroll-to-latest')"), true);
assert.equal(loader.split("'/scroll-to-latest.js'").length - 1, 1);
assert.equal(swPolicy.CURRENT_CACHE, 'hafize-shell-v112');
assert.equal(swPolicy.SHELL_ASSETS.includes('/scroll-to-latest.js'), true);
assert.equal(swPolicy.classifyRequest({
  method: 'GET', url: 'https://hafize.example/api/chat', headers: {}, mode: 'cors'
}, 'https://hafize.example'), 'network-only');
assert.equal(swPolicy.classifyRequest({
  method: 'GET', url: 'https://hafize.example/scroll-to-latest.js', headers: {}, mode: 'cors'
}, 'https://hafize.example'), 'shell');

assert.match(doc, /zorla.*kaydır/i);
assert.match(doc, /mesaj içeri/i);
assert.match(doc, /storage/i);
assert.match(doc, /96/);
assert.match(doc, /prefers-reduced-motion/i);
assert.match(doc, /sahipli/i);
assert.match(doc, /generation/i);

console.log('scroll-to-latest UX security tests passed');
