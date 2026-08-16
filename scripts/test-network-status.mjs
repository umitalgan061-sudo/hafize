import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../public/network-status.js', import.meta.url), 'utf8');
const loaderSource = fs.readFileSync(new URL('../public/chat-run-controller.js', import.meta.url), 'utf8');
const swSource = fs.readFileSync(new URL('../public/sw-policy.js', import.meta.url), 'utf8');

const module = { exports: {} };
vm.runInNewContext(source, { module, exports: module.exports, globalThis: {} });
const api = module.exports;

assert.equal(api.readOnline({ onLine: true }), true);
assert.equal(api.readOnline({ onLine: false }), false);
assert.equal(api.readOnline({}), true);
assert.equal(api.readOnline(null), true);
assert.equal(api.ONLINE_NOTICE_MS, 2200);

function node(tag = 'div') {
  const attrs = new Map();
  const children = [];
  const item = {
    tagName: tag.toUpperCase(),
    children,
    dataset: {},
    hidden: false,
    textContent: '',
    className: '',
    id: '',
    parentNode: null,
    append(child) { child.parentNode = item; children.push(child); },
    insertBefore(child, before) {
      child.parentNode = item;
      const index = children.indexOf(before);
      if (index < 0) children.push(child); else children.splice(index, 0, child);
    },
    remove() {
      if (!item.parentNode) return;
      const index = item.parentNode.children.indexOf(item);
      if (index >= 0) item.parentNode.children.splice(index, 1);
      item.parentNode = null;
    },
    setAttribute(name, value) { attrs.set(name, String(value)); },
    getAttribute(name) { return attrs.get(name); },
    querySelector(selector) {
      if (selector === '.top-spacer') return children.find((child) => child.className === 'top-spacer') || null;
      return null;
    }
  };
  return item;
}

const head = node('head');
const body = node('body');
const topbar = node('header');
topbar.className = 'topbar';
const spacer = node('div');
spacer.className = 'top-spacer';
topbar.append(spacer);
body.append(topbar);
const documentRef = {
  head,
  body,
  createElement: node,
  querySelector(selector) {
    const all = [];
    const walk = (current) => { all.push(current); for (const child of current.children || []) walk(child); };
    walk(head); walk(body);
    if (selector === '.topbar') return topbar;
    if (selector.startsWith('#')) return all.find((item) => item.id === selector.slice(1)) || null;
    return null;
  }
};

const listeners = new Map();
const rootRef = {
  addEventListener(type, handler) { listeners.set(type, handler); },
  removeEventListener(type, handler) { if (listeners.get(type) === handler) listeners.delete(type); }
};
const navigatorRef = { onLine: true };
let timerId = 0;
const timers = new Map();
const setTimeoutImpl = (fn, ms) => { timerId += 1; timers.set(timerId, { fn, ms }); return timerId; };
const clearTimeoutImpl = (id) => timers.delete(id);

const controller = api.createController({ rootRef, documentRef, navigatorRef, setTimeoutImpl, clearTimeoutImpl });
assert.equal(controller.mount(), true);
assert.equal(controller.mount(), true, 'mount is idempotent');
const status = documentRef.querySelector(`#${api.STATUS_ID}`);
assert.ok(status);
assert.equal(status.hidden, true);
assert.equal(status.dataset.state, 'online');
assert.equal(listeners.has('online'), true);
assert.equal(listeners.has('offline'), true);

navigatorRef.onLine = false;
listeners.get('offline')();
assert.equal(status.hidden, false);
assert.equal(status.dataset.state, 'offline');
assert.match(status.textContent, /Çevrimdışı/);

navigatorRef.onLine = true;
listeners.get('online')();
assert.equal(status.hidden, false);
assert.equal(status.dataset.state, 'restored');
assert.match(status.textContent, /geri geldi/);
assert.equal(timers.size, 1);
const [restoreTimer] = timers.values();
assert.equal(restoreTimer.ms, api.ONLINE_NOTICE_MS);
restoreTimer.fn();
assert.equal(status.hidden, true);
assert.equal(status.dataset.state, 'online');

navigatorRef.onLine = false;
controller.sync();
assert.equal(status.dataset.state, 'offline');
controller.destroy();
controller.destroy();
assert.equal(documentRef.querySelector(`#${api.STATUS_ID}`), null);
assert.equal(listeners.size, 0);

assert.match(loaderSource, /HafizeNetworkStatus/);
assert.match(loaderSource, /\/network-status\.js/);
assert.match(swSource, /hafize-shell-v31/);
assert.match(swSource, /'\/network-status\.js'/);
assert.match(swSource, /pathname\.startsWith\('\/api\/'\).*network-only/s);

for (const forbidden of ['fetch(', 'localStorage', 'sessionStorage', 'document.cookie', 'navigator.clipboard', 'WebSocket', 'innerHTML', 'eval(']) {
  assert.equal(source.includes(forbidden), false, `network status must not use ${forbidden}`);
}
assert.match(source, /addEventListener\('offline'/);
assert.match(source, /addEventListener\('online'/);
assert.match(source, /aria-live/);
assert.match(source, /aria-atomic/);

console.log('network status tests passed');
