import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { mountScreenAnalysisUi } = require('../public/screen-analysis-ui.js');

class FakeElement {
  constructor(value = '') {
    this.value = value;
    this.textContent = '';
    this.hidden = true;
    this.disabled = false;
    this.listeners = new Map();
  }
  addEventListener(type, handler) { this.listeners.set(type, handler); }
  click() { return this.listeners.get('click')?.({ type: 'click' }); }
}

const analyzeButton = new FakeElement();
const result = new FakeElement();
const status = new FakeElement();
const removeButton = new FakeElement();
const modelSelect = new FakeElement('nvidia/vision-test');
const messageInput = new FakeElement('Bu ekrandaki hatayı bul.');
const elements = new Map([
  ['#screenShareAnalyze', analyzeButton],
  ['#screenAnalysisResult', result],
  ['#screenShareStatus', status],
  ['#screenShareRemove', removeButton],
  ['#modelSelect', modelSelect],
  ['#messageInput', messageInput]
]);
const rootListeners = new Map();
const calls = [];
const root = {
  document: { querySelector: (selector) => elements.get(selector) || null },
  addEventListener(type, handler) { rootListeners.set(type, handler); },
  HafizeScreenAnalysisClient: {
    async analyzeCapture(options) {
      calls.push(options);
      return { content: 'Bir hata bildirimi var.', model: options.model };
    }
  }
};

const mounted = mountScreenAnalysisUi({ root });
assert.ok(mounted);
assert.equal(calls.length, 0);
await analyzeButton.click();
assert.equal(calls.length, 0);
assert.match(status.textContent, /Önce paylaşılacak/);

const capture = { blob: new Blob(['jpeg'], { type: 'image/jpeg' }), width: 10, height: 10 };
rootListeners.get('hafize:screen-capture-ready')?.({ detail: { capture } });
assert.equal(calls.length, 0);
await analyzeButton.click();
assert.equal(calls.length, 1);
assert.equal(calls[0].capture, capture);
assert.equal(calls[0].model, 'nvidia/vision-test');
assert.equal(calls[0].prompt, 'Bu ekrandaki hatayı bul.');
assert.equal(calls[0].explicitUserIntent, true);
assert.ok(calls[0].signal instanceof AbortSignal);
assert.equal(result.textContent, 'Bir hata bildirimi var.');
assert.equal(result.hidden, false);
assert.match(status.textContent, /geçici işlem/);

let aborted = false;
root.HafizeScreenAnalysisClient.analyzeCapture = ({ signal }) => new Promise((resolve, reject) => {
  signal.addEventListener('abort', () => {
    aborted = true;
    const error = new Error('cancelled');
    error.name = 'AbortError';
    reject(error);
  }, { once: true });
});
const pending = analyzeButton.click();
removeButton.click();
await pending;
assert.equal(aborted, true);
assert.equal(result.hidden, true);
assert.equal(analyzeButton.disabled, false);

rootListeners.get('hafize:screen-capture-cleared')?.({});
await analyzeButton.click();
assert.match(status.textContent, /Önce paylaşılacak/);
console.log('screen analysis UI tests passed');
