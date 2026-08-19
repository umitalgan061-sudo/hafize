import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { mountScreenAnalysisUi } = require('../public/screen-analysis-ui.js');

class FakeElement {
  constructor(tag = 'div', value = '') {
    this.tagName = tag.toUpperCase();
    this.value = value;
    this.textContent = '';
    this.hidden = true;
    this.disabled = false;
    this.dataset = {};
    this.children = [];
    this.listeners = new Map();
    this.attributes = new Map();
    this.removed = false;
  }
  addEventListener(type, handler) {
    const list = this.listeners.get(type) || [];
    list.push(handler);
    this.listeners.set(type, list);
  }
  removeEventListener(type, handler) {
    const list = this.listeners.get(type) || [];
    this.listeners.set(type, list.filter((entry) => entry !== handler));
  }
  setAttribute(name, value) {
    this.attributes.set(name, String(value));
    if (name === 'data-stage') this.dataset.stage = String(value);
  }
  removeAttribute(name) {
    this.attributes.delete(name);
    if (name === 'data-stage') delete this.dataset.stage;
  }
  getAttribute(name) { return this.attributes.has(name) ? this.attributes.get(name) : null; }
  append(...children) { this.children.push(...children); }
  remove() { this.removed = true; }
  focus() {}
  async emit(type, event = {}) {
    for (const handler of [...(this.listeners.get(type) || [])]) {
      await handler({ type, target: this, ...event });
    }
  }
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function createHarness({ existingStyle = null, analyzeCapture } = {}) {
  const analyzeButton = new FakeElement('button');
  const result = new FakeElement('p');
  const status = new FakeElement('span');
  const removeButton = new FakeElement('button');
  const modelSelect = new FakeElement('select', 'nvidia/vision-test');
  const previewPanel = new FakeElement('div');
  const head = new FakeElement('head');
  const elements = new Map([
    ['#screenShareAnalyze', analyzeButton],
    ['#screenAnalysisResult', result],
    ['#screenShareStatus', status],
    ['#screenShareRemove', removeButton],
    ['#modelSelect', modelSelect],
    ['#screenSharePreview', previewPanel]
  ]);
  const documentListeners = new Map();
  const rootListeners = new Map();
  const document = {
    head,
    querySelector(selector) {
      if (selector === 'link[data-hafize-screen-analysis-consent-style]') return existingStyle;
      return elements.get(selector) || null;
    },
    createElement(tag) { return new FakeElement(tag); },
    addEventListener(type, handler) {
      const list = documentListeners.get(type) || [];
      list.push(handler);
      documentListeners.set(type, list);
    },
    removeEventListener(type, handler) {
      const list = documentListeners.get(type) || [];
      documentListeners.set(type, list.filter((entry) => entry !== handler));
    }
  };
  const root = {
    document,
    HafizeScreenAnalysisClient: {
      analyzeCapture: analyzeCapture || (async () => ({ content: 'ok' }))
    },
    addEventListener(type, handler) {
      const list = rootListeners.get(type) || [];
      list.push(handler);
      rootListeners.set(type, list);
    },
    removeEventListener(type, handler) {
      const list = rootListeners.get(type) || [];
      rootListeners.set(type, list.filter((entry) => entry !== handler));
    }
  };
  async function emitRoot(type, event = {}) {
    for (const handler of [...(rootListeners.get(type) || [])]) await handler(event);
  }
  return {
    root,
    analyzeButton,
    result,
    status,
    removeButton,
    modelSelect,
    previewPanel,
    head,
    documentListeners,
    rootListeners,
    emitRoot
  };
}

function seedHostState(h) {
  h.analyzeButton.textContent = 'Host analyze';
  h.analyzeButton.disabled = true;
  h.analyzeButton.setAttribute('aria-label', 'Host label');
  h.analyzeButton.setAttribute('data-stage', 'host-stage');
  h.modelSelect.disabled = true;
  h.result.textContent = 'Host result';
  h.result.hidden = false;
  h.status.textContent = 'Host status';
}

{
  const h = createHarness();
  seedHostState(h);
  const mounted = mountScreenAnalysisUi({ root: h.root });
  assert.ok(mounted);
  assert.equal(h.head.children.length, 1, 'controller should add its missing style');
  const ownedStyle = h.head.children[0];
  const consent = h.previewPanel.children[0];

  mounted.destroy();
  assert.equal(consent.removed, true);
  assert.equal(ownedStyle.removed, true, 'controller-owned style must be removed');
  assert.equal(h.analyzeButton.textContent, 'Host analyze');
  assert.equal(h.analyzeButton.disabled, true);
  assert.equal(h.analyzeButton.getAttribute('aria-label'), 'Host label');
  assert.equal(h.analyzeButton.getAttribute('data-stage'), 'host-stage');
  assert.equal(h.modelSelect.disabled, true);
  assert.equal(h.result.textContent, 'Host result');
  assert.equal(h.result.hidden, false);
  assert.equal(h.status.textContent, 'Host status');
  assert.equal((h.analyzeButton.listeners.get('click') || []).length, 0);
  assert.equal((h.removeButton.listeners.get('click') || []).length, 0);
  assert.equal((h.documentListeners.get('keydown') || []).length, 0);
  assert.equal((h.rootListeners.get('pagehide') || []).length, 0);
  assert.equal(mounted.prepareReview(), false);
  assert.equal(mounted.resetResult(), false);
  assert.equal(mounted.invalidateReview(), false);
  assert.equal(await mounted.analyze(), false);
  assert.equal(mounted.getReviewSnapshot(), null);
  mounted.destroy();
}

{
  const hostStyle = new FakeElement('link');
  const h = createHarness({ existingStyle: hostStyle });
  h.analyzeButton.textContent = 'Analiz';
  h.analyzeButton.disabled = false;
  h.modelSelect.disabled = false;
  h.result.hidden = true;
  h.status.textContent = 'idle';

  const mounted = mountScreenAnalysisUi({ root: h.root });
  assert.ok(mounted);
  assert.equal(h.head.children.length, 0, 'existing host style must be reused');
  mounted.destroy();
  assert.equal(hostStyle.removed, false, 'host-owned style must survive teardown');
}

{
  const gate = deferred();
  let requestSignal = null;
  const h = createHarness({
    analyzeCapture({ signal }) {
      requestSignal = signal;
      return gate.promise;
    }
  });
  h.analyzeButton.textContent = 'Analiz';
  h.analyzeButton.disabled = false;
  h.modelSelect.disabled = false;
  h.result.textContent = '';
  h.result.hidden = true;
  h.status.textContent = 'idle';

  const mounted = mountScreenAnalysisUi({ root: h.root });
  const capture = { blob: new Blob(['jpeg'], { type: 'image/jpeg' }), width: 20, height: 10 };
  await h.emitRoot('hafize:screen-capture-ready', { detail: { capture } });
  assert.equal(await mounted.analyze(), true, 'first action prepares explicit review');
  const pending = mounted.analyze();
  assert.ok(requestSignal instanceof AbortSignal);
  assert.equal(requestSignal.aborted, false);
  assert.equal(h.analyzeButton.disabled, true);
  assert.equal(h.result.hidden, false);

  mounted.destroy();
  assert.equal(requestSignal.aborted, true, 'destroy must abort the active NVIDIA request');
  assert.equal(h.analyzeButton.textContent, 'Analiz');
  assert.equal(h.analyzeButton.disabled, false);
  assert.equal(h.result.textContent, '');
  assert.equal(h.result.hidden, true);
  assert.equal(h.status.textContent, 'idle');

  gate.resolve({ content: 'stale response must not appear' });
  assert.equal(await pending, false);
  assert.equal(h.result.textContent, '', 'stale completion must not mutate restored host UI');
  assert.equal(h.status.textContent, 'idle');
}

{
  const gate = deferred();
  const h = createHarness({ analyzeCapture: () => gate.promise });
  h.analyzeButton.textContent = 'Analiz';
  h.analyzeButton.disabled = false;
  h.modelSelect.disabled = false;
  h.result.hidden = true;
  h.status.textContent = 'idle';

  const mounted = mountScreenAnalysisUi({ root: h.root });
  const capture = { blob: new Blob(['jpeg'], { type: 'image/jpeg' }), width: 30, height: 20 };
  await h.emitRoot('hafize:screen-capture-ready', { detail: { capture } });
  await mounted.analyze();
  const pending = mounted.analyze();
  for (const handler of [...(h.rootListeners.get('pagehide') || [])]) handler({ type: 'pagehide' });
  gate.resolve({ content: 'late pagehide result' });
  assert.equal(await pending, false);
  assert.notEqual(h.result.textContent, 'late pagehide result');
  mounted.destroy();
}

console.log('screen analysis lifecycle tests passed');
