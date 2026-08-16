import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../public/mobile-sidebar-dismiss.js', import.meta.url), 'utf8');
const loader = fs.readFileSync(new URL('../public/chat-run-controller.js', import.meta.url), 'utf8');
const swPolicy = fs.readFileSync(new URL('../public/sw-policy.js', import.meta.url), 'utf8');
const module = { exports: {} };
vm.runInNewContext(source, { module, exports: module.exports, globalThis: {} });
const api = module.exports;

assert.equal(api.isMobile({ innerWidth: 900 }), true);
assert.equal(api.isMobile({ innerWidth: 901 }), false);
assert.equal(api.isMobile({ innerWidth: 'bad' }), false);

function node() {
  const listeners = new Map();
  const classes = new Set();
  return {
    id: '', type: '', className: '', hidden: false, parent: null, children: [], attrs: new Map(), focused: false,
    classList: { contains: (v) => classes.has(v), add: (v) => classes.add(v), remove: (v) => classes.delete(v) },
    append(...items) { for (const item of items) { item.parent = this; this.children.push(item); } },
    remove() { if (this.parent) this.parent.children = this.parent.children.filter((x) => x !== this); this.parent = null; },
    setAttribute(k, v) { this.attrs.set(k, String(v)); },
    addEventListener(k, fn) { listeners.set(k, fn); },
    removeEventListener(k, fn) { if (listeners.get(k) === fn) listeners.delete(k); },
    emit(k, event = {}) { listeners.get(k)?.(event); },
    focus() { this.focused = true; }
  };
}

const sidebar = node(); sidebar.id = 'sidebar';
const toggle = node(); toggle.id = 'sidebarToggle';
const body = node();
const head = node();
let backdrop = null;
let style = null;
const docListeners = new Map();
const documentRef = {
  body, head,
  createElement() { return node(); },
  querySelector(selector) {
    if (selector === '#sidebar') return sidebar;
    if (selector === '#sidebarToggle') return toggle;
    if (selector === '#sidebarBackdrop') return backdrop;
    if (selector === '#hafize-mobile-sidebar-dismiss-style') return style;
    return null;
  },
  addEventListener(k, fn) { docListeners.set(k, fn); },
  removeEventListener(k, fn) { if (docListeners.get(k) === fn) docListeners.delete(k); }
};
const bodyAppend = body.append.bind(body);
body.append = (...items) => { bodyAppend(...items); backdrop = items.find((x) => x.id === api.BACKDROP_ID) || backdrop; };
const headAppend = head.append.bind(head);
head.append = (...items) => { headAppend(...items); style = items.find((x) => x.id === api.STYLE_ID) || style; };
const winListeners = new Map();
const windowRef = {
  innerWidth: 390,
  addEventListener(k, fn) { winListeners.set(k, fn); },
  removeEventListener(k, fn) { if (winListeners.get(k) === fn) winListeners.delete(k); }
};

const controller = api.createController({ documentRef, windowRef });
assert.equal(controller.mount(), true);
assert.equal(backdrop.hidden, true);
sidebar.classList.add('open');
toggle.emit('click');
assert.equal(backdrop.hidden, false);
assert.equal(toggle.attrs.get('aria-expanded'), 'true');

let prevented = false;
docListeners.get('keydown')({ key: 'Escape', defaultPrevented: false, preventDefault() { prevented = true; } });
assert.equal(prevented, true);
assert.equal(sidebar.classList.contains('open'), false);
assert.equal(backdrop.hidden, true);
assert.equal(toggle.focused, true);

sidebar.classList.add('open'); toggle.emit('click');
backdrop.emit('click');
assert.equal(sidebar.classList.contains('open'), false);

sidebar.classList.add('open'); toggle.emit('click');
windowRef.innerWidth = 1200; winListeners.get('resize')();
assert.equal(sidebar.classList.contains('open'), false);
assert.equal(backdrop.hidden, true);
assert.equal(controller.mount(), true);
assert.equal(body.children.filter((x) => x.id === api.BACKDROP_ID).length, 1);
assert.equal(controller.destroy(), true);
assert.equal(controller.destroy(), false);
assert.equal(api.createController({ documentRef: { querySelector: () => null }, windowRef }).mount(), false);

assert.match(loader, /HafizeMobileSidebarDismiss/);
assert.match(loader, /\/mobile-sidebar-dismiss\.js/);
assert.match(swPolicy, /CURRENT_CACHE = `\$\{CACHE_PREFIX\}v25`/);
assert.match(swPolicy, /'\/mobile-sidebar-dismiss\.js'/);
for (const forbidden of ['fetch(', 'localStorage', 'sessionStorage', 'document.cookie', 'navigator.clipboard', 'Authorization', 'Bearer ', 'innerHTML']) {
  assert.equal(source.includes(forbidden), false, `forbidden surface: ${forbidden}`);
}
console.log('mobile sidebar dismiss tests passed');