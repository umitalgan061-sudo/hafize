import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../public/code-block-copy.js', import.meta.url), 'utf8');
const module = { exports: {} };
vm.runInNewContext(source, { module, exports: module.exports, globalThis: {}, self: {} });
const api = module.exports;

function classList(initial = []) {
  const values = new Set(initial);
  return {
    contains(value) { return values.has(value); },
    toggle(value, force) {
      if (force) values.add(value);
      else values.delete(value);
      return Boolean(force);
    }
  };
}

function button() {
  const attrs = new Map();
  return {
    textContent: '',
    title: '',
    setAttribute(name, value) { attrs.set(name, value); },
    getAttribute(name) { return attrs.get(name); }
  };
}

const pre = { classList: classList() };
const control = button();
assert.equal(api.setWrap(pre, control, false), true);
assert.equal(pre.classList.contains(api.WRAP_CLASS), false);
assert.equal(control.getAttribute('aria-pressed'), 'false');
assert.equal(control.textContent, 'Satırı sar');
assert.match(control.title, /Uzun kod/);

assert.equal(api.toggleWrap(pre, control), true);
assert.equal(pre.classList.contains(api.WRAP_CLASS), true);
assert.equal(control.getAttribute('aria-pressed'), 'true');
assert.equal(control.textContent, 'Kaydır');
assert.match(control.title, /Yatay/);

assert.equal(api.toggleWrap(pre, control), true);
assert.equal(pre.classList.contains(api.WRAP_CLASS), false);
assert.equal(control.getAttribute('aria-pressed'), 'false');

assert.equal(api.setWrap(null, control, true), false);
assert.equal(api.setWrap(pre, null, true), false);

assert.match(source, /hafize-code-wrap-toggle/);
assert.match(source, /white-space:pre-wrap/);
assert.match(source, /overflow-wrap:anywhere/);
assert.match(source, /aria-pressed/);
assert.match(source, /addEventListener\('click'/);
assert.ok(!source.includes('localStorage'));
assert.ok(!source.includes('sessionStorage'));
assert.ok(!source.includes('fetch('));
assert.ok(!source.includes('WebSocket'));
assert.ok(!source.includes('requestSubmit'));
assert.ok(!source.includes('innerHTML'));

const sw = fs.readFileSync(new URL('../public/sw-policy.js', import.meta.url), 'utf8');
assert.match(sw, /hafize-shell-v36/);
assert.match(sw, /'\/code-block-copy\.js'/);
assert.match(sw, /pathname\.startsWith\('\/api\/'\).*network-only/s);

console.log('code block wrap contract ok');