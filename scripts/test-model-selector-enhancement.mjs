import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const modelUi = require('../public/model-selector-enhancement.js');

assert.equal(modelUi.normalizeModelId(' meta/llama '), 'meta/llama');
assert.equal(modelUi.normalizeModelId(''), '');
assert.equal(modelUi.normalizeModelId('bad\nmodel'), '');
assert.equal(modelUi.normalizeModelId('x'.repeat(241)), '');
assert.deepEqual(modelUi.classifyModel('local:qwen2.5'), {
  id: 'local:qwen2.5', provider: 'local', displayId: 'qwen2.5', providerLabel: 'Yerel sağlayıcı'
});
assert.deepEqual(modelUi.classifyModel('meta/llama-3.1'), {
  id: 'meta/llama-3.1', provider: 'nvidia', displayId: 'meta/llama-3.1', providerLabel: 'NVIDIA NIM'
});
assert.equal(modelUi.optionLabel('local:qwen'), 'Yerel · qwen');
assert.equal(modelUi.optionLabel('meta/llama'), 'NVIDIA · meta/llama');

class FakeClassList {
  constructor(values = []) { this.values = new Set(values); }
  contains(value) { return this.values.has(value); }
}

class FakeElement {
  constructor(tagName = 'div') {
    this.tagName = tagName.toUpperCase();
    this.id = '';
    this.textContent = '';
    this.title = '';
    this.hidden = false;
    this.disabled = false;
    this.dataset = {};
    this.attributes = new Map();
    this.listeners = new Map();
    this.children = [];
    this.parentNode = null;
    this.options = [];
    this.classList = new FakeClassList();
    this.clickCount = 0;
    this.focusCount = 0;
  }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  removeAttribute(name) { this.attributes.delete(name); }
  addEventListener(name, fn, capture = false) { this.listeners.set(`${name}:${capture}`, fn); }
  removeEventListener(name, fn, capture = false) {
    if (this.listeners.get(`${name}:${capture}`) === fn) this.listeners.delete(`${name}:${capture}`);
  }
  append(...nodes) { for (const node of nodes) { node.parentNode = this; this.children.push(node); } }
  remove() {
    if (!this.parentNode) return;
    this.parentNode.children = this.parentNode.children.filter((node) => node !== this);
    this.parentNode = null;
  }
  closest(selector) { return selector === '.model-wrap' ? this.modelWrap || null : null; }
  focus() { this.focusCount += 1; }
  click() {
    this.clickCount += 1;
    const capture = this.listeners.get('click:true');
    const event = fakeEvent(this);
    capture?.(event);
    if (!event.defaultPrevented && typeof this.onAppClick === 'function') this.onAppClick();
  }
}

class FakeObserver {
  static instances = [];
  constructor(callback) { this.callback = callback; this.targets = []; this.disconnected = false; FakeObserver.instances.push(this); }
  observe(target, options) { this.targets.push({ target, options }); }
  disconnect() { this.disconnected = true; }
}

function fakeEvent(target) {
  return {
    target,
    defaultPrevented: false,
    stopped: false,
    preventDefault() { this.defaultPrevented = true; },
    stopImmediatePropagation() { this.stopped = true; }
  };
}

function option(value, label = value) {
  const node = new FakeElement('option');
  node.value = value;
  node.textContent = label;
  return node;
}

function fixture({ selected = 'meta/llama', tools = false } = {}) {
  FakeObserver.instances = [];
  const head = new FakeElement('head');
  const modelWrap = new FakeElement('label');
  const select = new FakeElement('select');
  select.id = 'modelSelect';
  select.value = selected;
  select.options = [option('', 'Yükleniyor'), option('meta/llama'), option('local:qwen')];
  select.modelWrap = modelWrap;
  modelWrap.append(select);
  const tool = new FakeElement('button');
  tool.id = 'toolModeBtn';
  tool.setAttribute('aria-pressed', String(tools));
  tool.onAppClick = () => tool.setAttribute('aria-pressed', tool.getAttribute('aria-pressed') === 'true' ? 'false' : 'true');
  const composer = new FakeElement('form');
  composer.id = 'composer';
  const byId = new Map([['modelSelect', select], ['toolModeBtn', tool], ['composer', composer]]);
  const documentListeners = new Map();
  const documentRef = {
    head,
    createElement: (tag) => new FakeElement(tag),
    querySelector(selector) {
      if (selector.startsWith('#')) {
        const id = selector.slice(1);
        if (id === modelUi.STYLE_ID) return head.children.find((node) => node.id === id) || null;
        if (id === modelUi.STATUS_ID) return modelWrap.children.find((node) => node.id === id) || null;
        return byId.get(id) || null;
      }
      return null;
    },
    addEventListener(name, fn, capture = false) { documentListeners.set(`${name}:${capture}`, fn); },
    removeEventListener(name, fn, capture = false) {
      if (documentListeners.get(`${name}:${capture}`) === fn) documentListeners.delete(`${name}:${capture}`);
    }
  };
  return { documentRef, documentListeners, head, modelWrap, select, tool, composer };
}

{
  const f = fixture();
  const controller = modelUi.createController({ documentRef: f.documentRef, MutationObserverImpl: FakeObserver });
  assert.equal(controller.mount(), true);
  assert.equal(f.select.options[1].textContent, 'NVIDIA · meta/llama');
  assert.equal(f.select.options[2].textContent, 'Yerel · qwen');
  const status = f.documentRef.querySelector(`#${modelUi.STATUS_ID}`);
  assert.equal(status.textContent, 'NVIDIA NIM');
  assert.equal(status.dataset.provider, 'nvidia');
  assert.equal(FakeObserver.instances.length, 1);
  assert.equal(FakeObserver.instances[0].targets.length, 2);
  assert.equal(controller.destroy(), true);
  assert.equal(f.select.options[1].textContent, 'meta/llama');
  assert.equal(f.documentRef.querySelector(`#${modelUi.STATUS_ID}`), null);
  assert.equal(FakeObserver.instances[0].disconnected, true);
}

{
  const f = fixture({ selected: 'local:qwen', tools: false });
  const controller = modelUi.createController({ documentRef: f.documentRef, MutationObserverImpl: FakeObserver });
  controller.mount();
  const event = fakeEvent(f.tool);
  f.tool.listeners.get('click:true')(event);
  assert.equal(event.defaultPrevented, true);
  assert.equal(event.stopped, true);
  assert.match(f.documentRef.querySelector(`#${modelUi.STATUS_ID}`).textContent, /Yerel/);
}

{
  const f = fixture({ selected: 'local:qwen', tools: true });
  const controller = modelUi.createController({ documentRef: f.documentRef, MutationObserverImpl: FakeObserver });
  controller.mount();
  assert.equal(f.tool.clickCount, 1, 'mount should turn off an already-active tool mode through the app click path');
  assert.equal(f.tool.getAttribute('aria-pressed'), 'false');
}

{
  const f = fixture({ selected: 'local:qwen', tools: true });
  f.tool.disabled = true;
  const controller = modelUi.createController({ documentRef: f.documentRef, MutationObserverImpl: FakeObserver });
  controller.mount();
  assert.equal(f.tool.getAttribute('aria-pressed'), 'true');
  const submit = fakeEvent(f.composer);
  assert.equal(controller.blockUnsafeSend(submit), true);
  assert.equal(submit.defaultPrevented, true);
  assert.equal(submit.stopped, true);
  assert.equal(f.select.focusCount, 1);
}

{
  const fakeTool = new FakeElement('button');
  fakeTool.setAttribute('aria-pressed', 'true');
  assert.equal(modelUi.localToolModeConflict('local:test', fakeTool), true);
  assert.equal(modelUi.localToolModeConflict('meta/test', fakeTool), false);
  fakeTool.setAttribute('aria-pressed', 'false');
  assert.equal(modelUi.localToolModeConflict('local:test', fakeTool), false);
}

console.log('model selector enhancement tests passed');
