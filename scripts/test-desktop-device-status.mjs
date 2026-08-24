import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../public/desktop-device-status.js', import.meta.url), 'utf8');

function element(tagName) {
  return {
    tagName: tagName.toUpperCase(), children: [], attributes: new Map(), listeners: new Map(), textContent: '',
    className: '', hidden: false, disabled: false, type: '', title: '', parent: null,
    append(...nodes) { for (const node of nodes) { node.parent = this; this.children.push(node); } },
    appendChild(node) { this.append(node); return node; }, replaceChildren(...nodes) { this.children = []; this.append(...nodes); },
    setAttribute(name, value) { this.attributes.set(name, String(value)); }, getAttribute(name) { return this.attributes.get(name) ?? null; },
    addEventListener(name, fn) { this.listeners.set(name, fn); }, removeEventListener(name, fn) { if (this.listeners.get(name) === fn) this.listeners.delete(name); },
    focus() { this.focused = true; },
    remove() { if (!this.parent) return; this.parent.children = this.parent.children.filter((node) => node !== this); this.parent = null; }
  };
}

const head = element('head');
const rail = element('aside');
const byId = new Map();
const documentListeners = new Map();
const documentRef = {
  head,
  createElement(tag) {
    const node = element(tag);
    Object.defineProperty(node, 'id', { get() { return this._id || ''; }, set(value) { this._id = value; if (value) byId.set(value, this); } });
    return node;
  },
  getElementById(id) { return byId.get(id) || null; },
  querySelector(selector) { return selector === '.utility-rail' ? rail : null; },
  addEventListener(name, fn) { documentListeners.set(name, fn); },
  removeEventListener(name, fn) { if (documentListeners.get(name) === fn) documentListeners.delete(name); }
};

const context = { module: { exports: {} }, exports: {}, console, URL, globalThis: {} };
vm.createContext(context);
vm.runInContext(source, context, { filename: 'desktop-device-status.js' });
const api = context.module.exports;

assert.deepEqual(JSON.parse(JSON.stringify(api.normalizeCapabilities({
  browserOrigins: ['https://github.com', 'http://unsafe.test', 'https://github.com'],
  appIds: ['calculator', 'bad id', 'calculator']
}))), { browserOrigins: ['https://github.com'], appIds: ['calculator'] });
assert.deepEqual(JSON.parse(JSON.stringify(api.normalizeCapabilities(null))), { browserOrigins: [], appIds: [] });
assert.equal(api.formatMemory(32768), '32 GB');
assert.equal(api.formatMemory(1536), '1.5 GB');

let infoCalls = 0;
let capabilityCalls = 0;
const opened = [];
const bridge = {
  async getSystemInfo() { infoCalls += 1; return { ok: true, value: { platform: 'linux', arch: 'x64', appVersion: '0.1.0', cpuCount: 8, totalMemoryMb: 16384 } }; },
  async getCapabilities() { capabilityCalls += 1; return { ok: true, value: { browserOrigins: ['https://github.com'], appIds: ['calculator'] } }; },
  async openBrowser(url) { opened.push(['browser', url]); return { ok: true }; },
  async openApp(appId) { opened.push(['app', appId]); return { ok: true }; }
};
const controller = api.createController({ documentRef, bridge });
assert.equal(controller.mount(), true);
await new Promise((resolve) => setImmediate(resolve));
assert.equal(infoCalls, 1);
assert.equal(capabilityCalls, 1);
const card = rail.children[0];
assert.equal(card.getAttribute('aria-busy'), 'false');
assert.match(card.children[1].textContent, /ayrıca onay ister/);
assert.equal(card.children[2].children.length, 5);
const launchers = card.children[3];
const review = card.children[4];
const reviewText = review.children[0];
const [confirmButton, cancelButton] = review.children[1].children;
assert.equal(launchers.hidden, false);
assert.equal(launchers.children.length, 2);
assert.equal(launchers.children[0].textContent, 'github.com');
assert.equal(launchers.children[1].textContent, 'Uygulama · calculator');
assert.equal(review.hidden, true);

launchers.children[0].listeners.get('click')();
assert.deepEqual(opened, []);
assert.equal(review.hidden, false);
assert.match(reviewText.textContent, /github\.com/);
assert.equal(confirmButton.disabled, false);
assert.equal(confirmButton.focused, true);
await confirmButton.listeners.get('click')();
assert.deepEqual(opened, [['browser', 'https://github.com/']]);
assert.equal(review.hidden, true);

launchers.children[1].listeners.get('click')();
assert.deepEqual(opened, [['browser', 'https://github.com/']]);
assert.match(reviewText.textContent, /calculator/);
await confirmButton.listeners.get('click')();
assert.deepEqual(opened, [['browser', 'https://github.com/'], ['app', 'calculator']]);

launchers.children[0].listeners.get('click')();
cancelButton.listeners.get('click')();
assert.equal(review.hidden, true);
assert.equal(controller.getPendingAction(), null);

const refresh = card.children[5].children[0];
await refresh.listeners.get('click')();
assert.equal(infoCalls, 2);
assert.equal(capabilityCalls, 2);
assert.equal(controller.destroy(), true);
assert.equal(documentListeners.has('keydown'), false);
assert.equal(rail.children.length, 0);

const failingBridge = {
  async getSystemInfo() { return { ok: false, error: 'DEVICE_ACTION_FAILED' }; },
  async getCapabilities() { return { ok: true, value: { browserOrigins: ['https://example.com'] } }; }
};
const failing = api.createController({ documentRef, bridge: failingBridge });
assert.equal(failing.mount(), true);
await new Promise((resolve) => setImmediate(resolve));
assert.match(rail.children[0].children[1].textContent, /alınamadı/);
assert.equal(rail.children[0].children[3].hidden, true);
failing.destroy();

console.log('desktop device status tests passed');
