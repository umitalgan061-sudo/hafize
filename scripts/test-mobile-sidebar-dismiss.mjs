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
    getAttribute(k) { return this.attrs.has(k) ? this.attrs.get(k) : null; },
    hasAttribute(k) { return this.attrs.has(k); },
    removeAttribute(k) { this.attrs.delete(k); },
    addEventListener(k, fn) { listeners.set(k, fn); },
    removeEventListener(k, fn) { if (listeners.get(k) === fn) listeners.delete(k); },
    emit(k, event = {}) { listeners.get(k)?.(event); },
    listener(k) { return listeners.get(k) || null; },
    focus() { this.focused = true; }
  };
}

function harness({ hostBackdrop = null, hostStyle = null, toggleExpanded = null } = {}) {
  const sidebar = node(); sidebar.id = 'sidebar';
  const toggle = node(); toggle.id = 'sidebarToggle';
  if (toggleExpanded !== null) toggle.setAttribute('aria-expanded', toggleExpanded);
  const body = node();
  const head = node();
  let backdrop = hostBackdrop;
  let style = hostStyle;
  if (backdrop) { backdrop.id = api.BACKDROP_ID; body.append(backdrop); }
  if (style) { style.id = api.STYLE_ID; head.append(style); }
  const docListeners = new Map();
  const documentRef = {
    body, head,
    createElement() { return node(); },
    querySelector(selector) {
      if (selector === '#sidebar') return sidebar;
      if (selector === '#sidebarToggle') return toggle;
      if (selector === '#sidebarBackdrop') return backdrop?.parent === body ? backdrop : null;
      if (selector === '#hafize-mobile-sidebar-dismiss-style') return style?.parent === head ? style : null;
      return null;
    },
    addEventListener(k, fn) { docListeners.set(k, fn); },
    removeEventListener(k, fn) { if (docListeners.get(k) === fn) docListeners.delete(k); }
  };
  const bodyAppend = body.append.bind(body);
  body.append = (...items) => {
    bodyAppend(...items);
    backdrop = items.find((x) => x.id === api.BACKDROP_ID) || backdrop;
  };
  const headAppend = head.append.bind(head);
  head.append = (...items) => {
    headAppend(...items);
    style = items.find((x) => x.id === api.STYLE_ID) || style;
  };
  const winListeners = new Map();
  const windowRef = {
    innerWidth: 390,
    addEventListener(k, fn) { winListeners.set(k, fn); },
    removeEventListener(k, fn) { if (winListeners.get(k) === fn) winListeners.delete(k); }
  };
  return {
    sidebar, toggle, body, head, documentRef, windowRef, docListeners, winListeners,
    backdrop: () => backdrop,
    style: () => style
  };
}

{
  const h = harness();
  const controller = api.createController({ documentRef: h.documentRef, windowRef: h.windowRef });
  assert.equal(controller.mount(), true);
  assert.equal(h.backdrop().hidden, true);
  assert.ok(h.style());
  h.sidebar.classList.add('open');
  h.toggle.emit('click');
  assert.equal(h.backdrop().hidden, false);
  assert.equal(h.toggle.attrs.get('aria-expanded'), 'true');

  let prevented = false;
  h.docListeners.get('keydown')({ key: 'Escape', defaultPrevented: false, preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(h.sidebar.classList.contains('open'), false);
  assert.equal(h.backdrop().hidden, true);
  assert.equal(h.toggle.focused, true);

  h.sidebar.classList.add('open'); h.toggle.emit('click');
  h.backdrop().emit('click');
  assert.equal(h.sidebar.classList.contains('open'), false);

  h.sidebar.classList.add('open'); h.toggle.emit('click');
  h.windowRef.innerWidth = 1200; h.winListeners.get('resize')();
  assert.equal(h.sidebar.classList.contains('open'), false);
  assert.equal(h.backdrop().hidden, true);
  assert.equal(controller.mount(), true);
  assert.equal(h.body.children.filter((x) => x.id === api.BACKDROP_ID).length, 1);
  const oldBackdrop = h.backdrop();
  const oldClick = oldBackdrop.listener('click');
  assert.equal(controller.destroy(), true);
  assert.equal(controller.destroy(), false);
  assert.equal(oldBackdrop.listener('click'), null);
  assert.equal(oldBackdrop.parent, null);
  assert.equal(h.style().parent, null);
  assert.equal(h.toggle.hasAttribute('aria-expanded'), false);
  assert.equal(controller.sync(), false);
  assert.equal(controller.close(), false);
  oldClick?.();
  assert.equal(h.toggle.focused, true);

  h.windowRef.innerWidth = 390;
  assert.equal(controller.mount(), true);
  assert.notEqual(h.backdrop(), oldBackdrop);
  assert.equal(h.body.children.filter((x) => x.id === api.BACKDROP_ID).length, 1);
  assert.equal(controller.destroy(), true);
}

{
  const hostBackdrop = node(); hostBackdrop.hidden = false;
  hostBackdrop.className = 'host-sidebar-layer';
  const hostStyle = node(); hostStyle.textContent = '/* host style */';
  const h = harness({ hostBackdrop, hostStyle, toggleExpanded: 'mixed' });
  const controller = api.createController({ documentRef: h.documentRef, windowRef: h.windowRef });
  assert.equal(controller.mount(), true);
  assert.equal(hostBackdrop.hidden, true);
  assert.ok(hostBackdrop.listener('click'));
  assert.equal(h.toggle.getAttribute('aria-expanded'), 'false');

  h.sidebar.classList.add('open');
  h.toggle.emit('click');
  assert.equal(hostBackdrop.hidden, false);
  assert.equal(controller.destroy(), true);
  assert.equal(hostBackdrop.parent, h.body);
  assert.equal(hostBackdrop.className, 'host-sidebar-layer');
  assert.equal(hostBackdrop.hidden, false);
  assert.equal(hostBackdrop.listener('click'), null);
  assert.equal(hostStyle.parent, h.head);
  assert.equal(hostStyle.textContent, '/* host style */');
  assert.equal(h.toggle.getAttribute('aria-expanded'), 'mixed');
}

{
  const malformedBackdrop = { id: api.BACKDROP_ID };
  const h = harness({ hostBackdrop: malformedBackdrop });
  const controller = api.createController({ documentRef: h.documentRef, windowRef: h.windowRef });
  assert.equal(controller.mount(), false);
  assert.equal(h.style()?.parent ?? null, null);
  assert.equal(h.toggle.hasAttribute('aria-expanded'), false);
}

assert.equal(api.createController({ documentRef: { querySelector: () => null }, windowRef: {} }).mount(), false);
assert.match(loader, /HafizeMobileSidebarDismiss/);
assert.match(loader, /\/mobile-sidebar-dismiss\.js/);
assert.match(swPolicy, /CURRENT_CACHE = `\$\{CACHE_PREFIX\}v\d+`/);
assert.match(swPolicy, /'\/mobile-sidebar-dismiss\.js'/);
for (const forbidden of ['fetch(', 'localStorage', 'sessionStorage', 'document.cookie', 'navigator.clipboard', 'Authorization', 'Bearer ', 'innerHTML']) {
  assert.equal(source.includes(forbidden), false, `forbidden surface: ${forbidden}`);
}
console.log('mobile sidebar dismiss tests passed');
