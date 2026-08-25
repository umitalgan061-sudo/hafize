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
    getAttribute(name) { return attrs.has(name) ? attrs.get(name) : null; },
    removeAttribute(name) { attrs.delete(name); },
    querySelector(selector) {
      if (selector === '.top-spacer') return children.find((child) => child.className === 'top-spacer') || null;
      return null;
    }
  };
  return item;
}

function fixture({ existingStatus = null, online = true } = {}) {
  const head = node('head');
  const body = node('body');
  const topbar = node('header');
  topbar.className = 'topbar';
  const spacer = node('div');
  spacer.className = 'top-spacer';
  topbar.append(spacer);
  if (existingStatus) topbar.insertBefore(existingStatus, spacer);
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
  const navigatorRef = { onLine: online };
  let timerId = 0;
  const timers = new Map();
  const setTimeoutImpl = (fn, ms) => { timerId += 1; timers.set(timerId, { fn, ms }); return timerId; };
  const clearTimeoutImpl = (id) => timers.delete(id);
  return { documentRef, topbar, listeners, navigatorRef, timers, setTimeoutImpl, clearTimeoutImpl };
}

{
  const f = fixture();
  const controller = api.createController(f);
  assert.equal(controller.mount(), true);
  assert.equal(controller.mount(), true, 'mount is idempotent');
  const status = f.documentRef.querySelector(`#${api.STATUS_ID}`);
  assert.ok(status);
  assert.equal(controller.snapshot().ownsNode, true);
  assert.equal(status.hidden, true);
  assert.equal(status.dataset.state, 'online');
  assert.equal(f.listeners.has('online'), true);
  assert.equal(f.listeners.has('offline'), true);

  f.navigatorRef.onLine = false;
  f.listeners.get('offline')();
  assert.equal(status.hidden, false);
  assert.equal(status.dataset.state, 'offline');
  assert.match(status.textContent, /Çevrimdışı/);

  f.navigatorRef.onLine = true;
  f.listeners.get('online')();
  assert.equal(status.hidden, false);
  assert.equal(status.dataset.state, 'restored');
  assert.match(status.textContent, /geri geldi/);
  assert.equal(f.timers.size, 1);
  const [restoreTimer] = f.timers.values();
  assert.equal(restoreTimer.ms, api.ONLINE_NOTICE_MS);
  restoreTimer.fn();
  assert.equal(status.hidden, true);
  assert.equal(status.dataset.state, 'online');

  f.navigatorRef.onLine = false;
  controller.sync();
  assert.equal(status.dataset.state, 'offline');
  assert.equal(controller.destroy(), true);
  assert.equal(controller.destroy(), false);
  assert.equal(f.documentRef.querySelector(`#${api.STATUS_ID}`), null);
  assert.equal(f.listeners.size, 0);
  assert.equal(controller.sync(), false, 'public sync is inert after destroy');
  assert.equal(controller.showOffline(), false);
  assert.equal(controller.showOnline(), false);
}

{
  const host = node('span');
  host.id = api.STATUS_ID;
  host.hidden = false;
  host.textContent = 'Host ağ durumu';
  host.dataset.state = 'custom';
  host.setAttribute('data-state', 'custom');
  host.setAttribute('title', 'Host title');
  host.setAttribute('role', 'note');
  const f = fixture({ existingStatus: host, online: false });
  const controller = api.createController(f);
  assert.equal(controller.mount(), true);
  assert.equal(controller.snapshot().ownsNode, false);
  assert.match(host.textContent, /Çevrimdışı/);
  assert.equal(host.getAttribute('role'), 'note', 'host accessibility metadata is preserved');
  assert.equal(controller.destroy(), true);
  assert.equal(host.parentNode, f.topbar, 'host-owned node survives teardown');
  assert.equal(host.hidden, false);
  assert.equal(host.textContent, 'Host ağ durumu');
  assert.equal(host.dataset.state, 'custom');
  assert.equal(host.getAttribute('data-state'), 'custom');
  assert.equal(host.getAttribute('title'), 'Host title');
  assert.equal(host.getAttribute('role'), 'note');
}

{
  const host = node('span');
  host.id = api.STATUS_ID;
  host.hidden = true;
  host.textContent = 'Başlangıç';
  const f = fixture({ existingStatus: host, online: false });
  const controller = api.createController(f);
  controller.mount();
  assert.equal(host.getAttribute('data-state'), 'offline');
  controller.destroy();
  assert.equal(host.getAttribute('data-state'), null);
  assert.equal('state' in host.dataset, false);
  assert.equal(host.getAttribute('title'), null);
  assert.equal(host.textContent, 'Başlangıç');
}

{
  const f = fixture({ online: false });
  const controller = api.createController(f);
  controller.mount();
  f.navigatorRef.onLine = true;
  f.listeners.get('online')();
  const staleTimer = [...f.timers.values()][0];
  const firstStatus = f.documentRef.querySelector(`#${api.STATUS_ID}`);
  assert.equal(firstStatus.dataset.state, 'restored');
  controller.destroy();

  assert.equal(controller.mount(), true);
  const secondStatus = f.documentRef.querySelector(`#${api.STATUS_ID}`);
  assert.notEqual(secondStatus, firstStatus);
  assert.equal(secondStatus.dataset.state, 'online');
  staleTimer.fn();
  assert.equal(secondStatus.dataset.state, 'online', 'stale generation timer cannot mutate remounted node');
  assert.equal(controller.destroy(), true);
}

assert.match(loaderSource, /HafizeNetworkStatus/);
assert.match(loaderSource, /\/network-status\.js/);
assert.match(swSource, /const CURRENT_CACHE = `\$\{CACHE_PREFIX\}v\d+`;/);
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
