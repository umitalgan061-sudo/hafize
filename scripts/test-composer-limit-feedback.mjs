import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const source = fs.readFileSync(new URL('../public/composer-limit-feedback.js', import.meta.url), 'utf8');
const swPolicy = require('../public/sw-policy.js');
const loader = fs.readFileSync(new URL('../public/chat-run-controller.js', import.meta.url), 'utf8');
const module = { exports: {} };
vm.runInNewContext(source, { module, exports: module.exports, globalThis: {} });
const api = module.exports;

assert.equal(api.DEFAULT_LIMIT, 12_000);
assert.equal(api.normalizeLimit(5000), 5000);
assert.equal(api.normalizeLimit(0), 12_000);
assert.equal(api.normalizeLimit(50_000), 12_000);
assert.equal(api.snapshot('', 12_000).remaining, 12_000);
assert.equal(api.snapshot('x'.repeat(10_199), 12_000).state, 'normal');
assert.equal(api.snapshot('x'.repeat(10_200), 12_000).state, 'warning');
assert.equal(api.snapshot('x'.repeat(11_640), 12_000).state, 'danger');
assert.equal(api.snapshot('x'.repeat(13_000), 12_000).used, 12_000);

function node(tag = 'div') {
  const listeners = new Map();
  return {
    tagName: tag.toUpperCase(), id: '', className: '', dataset: {}, textContent: '', value: '', maxLength: 12_000,
    max: 0, children: [], parent: null, attributes: new Map(), removeCalls: 0,
    append(...items) { for (const item of items) { item.parent = this; this.children.push(item); } },
    insertBefore(item, before) { item.parent = this; const i = this.children.indexOf(before); i < 0 ? this.children.push(item) : this.children.splice(i, 0, item); },
    remove() { this.removeCalls += 1; if (this.parent) this.parent.children = this.parent.children.filter((item) => item !== this); this.parent = null; },
    setAttribute(name, value) { this.attributes.set(name, String(value)); },
    getAttribute(name) { return this.attributes.has(name) ? this.attributes.get(name) : null; },
    hasAttribute(name) { return this.attributes.has(name); },
    removeAttribute(name) { this.attributes.delete(name); },
    addEventListener(type, handler) { listeners.set(type, handler); },
    removeEventListener(type, handler) { if (listeners.get(type) === handler) listeners.delete(type); },
    listenerCount(type) { return listeners.has(type) ? 1 : 0; },
    emit(type) { listeners.get(type)?.({ type }); },
    querySelector(selector) {
      if (selector === '.composer-limit-meter') return this.children.find((item) => item.className === 'composer-limit-meter') || null;
      if (selector === '.composer-limit-label') return this.children.find((item) => item.className === 'composer-limit-label') || null;
      if (selector === '.composer-row') return this.children.find((item) => item.className === 'composer-row') || null;
      return null;
    }
  };
}

function createHarness({ existingControl = null, inputMaxLength = 15_000 } = {}) {
  const input = node('textarea');
  input.maxLength = inputMaxLength;
  const composer = node('form');
  const row = node(); row.className = 'composer-row'; composer.append(row);
  if (existingControl) composer.insertBefore(existingControl, row);
  const head = node('head');
  let control = existingControl;
  let style = null;
  const documentRef = {
    head,
    createElement(tag) { return node(tag); },
    querySelector(selector) {
      if (selector === '#messageInput') return input;
      if (selector === '#composer') return composer;
      if (selector === '#composerLimitFeedback') return control && control.removeCalls === 0 ? control : null;
      if (selector === '#hafize-composer-limit-feedback-style') return style;
      return null;
    }
  };
  const append = head.append.bind(head);
  head.append = (...items) => { append(...items); style = items.find((item) => item.id === api.STYLE_ID) || style; };
  const insertBefore = composer.insertBefore.bind(composer);
  composer.insertBefore = (item, before) => { insertBefore(item, before); if (item.id === api.CONTROL_ID) control = item; };
  return { input, composer, head, documentRef, get control() { return control; } };
}

{
  const h = createHarness();
  const controller = api.createController({ documentRef: h.documentRef });
  assert.equal(controller.mount(), true);
  assert.deepEqual({ ...controller.lifecycleSnapshot() }, { mounted: true, controlOwned: true, hasInput: true });
  assert.equal(h.input.maxLength, 12_000);
  assert.equal(h.input.listenerCount('input'), 1);
  assert.equal(h.control.dataset.state, 'normal');
  assert.match(h.control.children[1].textContent, /12\.000 karakter kullanılabilir/);
  h.input.value = 'x'.repeat(10_200); h.input.emit('input');
  assert.equal(h.control.dataset.state, 'warning');
  h.input.value = 'x'.repeat(11_900); h.input.emit('input');
  assert.equal(h.control.dataset.state, 'danger');
  assert.equal(h.control.children[1].textContent, '100 karakter kaldı');
  assert.equal(controller.mount(), true, 'double mount reuses the same controller');
  assert.equal(h.composer.children.filter((item) => item.id === api.CONTROL_ID).length, 1);
  const owned = h.control;
  assert.equal(controller.destroy(), true);
  assert.equal(h.input.maxLength, 15_000, 'teardown restores the mount-time input maxlength');
  assert.equal(h.input.listenerCount('input'), 0);
  assert.equal(owned.removeCalls, 1, 'controller-owned feedback is removed');
  assert.equal(controller.render(), null, 'destroyed controller render is inert');
  assert.equal(controller.destroy(), false);
}

{
  const host = node('div');
  host.id = api.CONTROL_ID;
  host.dataset.state = 'host-state';
  const meter = node('progress'); meter.className = 'composer-limit-meter'; meter.max = 77; meter.value = 12;
  meter.setAttribute('aria-valuemax', '77'); meter.setAttribute('aria-valuenow', '12');
  const label = node('span'); label.className = 'composer-limit-label'; label.textContent = 'Host label';
  host.append(meter, label);
  const h = createHarness({ existingControl: host, inputMaxLength: 8000 });
  const controller = api.createController({ documentRef: h.documentRef });
  assert.equal(controller.mount(), true);
  assert.deepEqual({ ...controller.lifecycleSnapshot() }, { mounted: true, controlOwned: false, hasInput: true });
  h.input.value = 'x'.repeat(7900); h.input.emit('input');
  assert.notEqual(host.dataset.state, 'host-state');
  assert.notEqual(label.textContent, 'Host label');
  assert.equal(controller.destroy(), true);
  assert.equal(host.removeCalls, 0, 'host-owned feedback survives teardown');
  assert.equal(host.dataset.state, 'host-state');
  assert.equal(meter.max, 77);
  assert.equal(meter.value, 12);
  assert.equal(meter.getAttribute('aria-valuemax'), '77');
  assert.equal(meter.getAttribute('aria-valuenow'), '12');
  assert.equal(label.textContent, 'Host label', 'host-owned visual state is restored exactly');
  assert.equal(h.input.maxLength, 8000);
}

{
  const malformed = node('div');
  malformed.id = api.CONTROL_ID;
  const h = createHarness({ existingControl: malformed, inputMaxLength: 9000 });
  const controller = api.createController({ documentRef: h.documentRef });
  assert.equal(controller.mount(), false, 'malformed host control fails closed');
  assert.equal(h.input.maxLength, 9000, 'failed mount must not mutate composer input');
  assert.equal(h.input.listenerCount('input'), 0);
  assert.equal(malformed.removeCalls, 0);
}

assert.equal(api.createController({ documentRef: { querySelector: () => null } }).mount(), false);
assert.match(loader, /HafizeComposerLimitFeedback/);
assert.match(loader, /\/composer-limit-feedback\.js/);
assert.equal(swPolicy.CURRENT_CACHE, 'hafize-shell-v115');
assert.equal(swPolicy.SHELL_ASSETS.includes('/composer-limit-feedback.js'), true);
assert.equal(swPolicy.classifyRequest({ method: 'GET', url: 'https://hafize.example/api/chat', headers: {}, mode: 'cors' }, 'https://hafize.example'), 'network-only');
for (const forbidden of ['fetch(', 'localStorage', 'sessionStorage', 'document.cookie', 'navigator.clipboard', 'Authorization', 'Bearer ', 'innerHTML']) {
  assert.equal(source.includes(forbidden), false, `forbidden surface: ${forbidden}`);
}
assert.match(source, /controlOwned/);
assert.match(source, /inputMaxLengthBeforeMount/);
assert.match(source, /restoreHostControl/);
console.log('composer limit feedback tests passed');