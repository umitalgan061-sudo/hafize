import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const api = require('../public/github-write-readiness.js');

class FakeElement {
  constructor(tag = 'div') {
    this.tagName = tag.toUpperCase(); this.children = []; this.parentNode = null; this.attributes = new Map();
    this.dataset = {}; this.listeners = new Map(); this.className = ''; this.textContent = ''; this.hidden = false; this.disabled = false; this.id = '';
  }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.has(name) ? this.attributes.get(name) : null; }
  removeAttribute(name) { this.attributes.delete(name); }
  append(...nodes) { for (const node of nodes) { node.parentNode = this; this.children.push(node); } }
  remove() { if (!this.parentNode) return; this.parentNode.children = this.parentNode.children.filter((n) => n !== this); this.parentNode = null; }
  addEventListener(name, fn) { if (!this.listeners.has(name)) this.listeners.set(name, []); this.listeners.get(name).push(fn); }
  removeEventListener(name, fn) { this.listeners.set(name, (this.listeners.get(name) || []).filter((x) => x !== fn)); }
  listenerCount(name) { return (this.listeners.get(name) || []).length; }
  matches(selector) {
    if (selector === '.utility-rail') return this.className === 'utility-rail';
    if (selector === '#githubWriteReadinessCard') return this.id === 'githubWriteReadinessCard';
    if (selector === '#githubWriteReadinessSummary') return this.id === 'githubWriteReadinessSummary';
    if (selector === '.github-write-readiness-summary') return this.className.includes('github-write-readiness-summary');
    if (selector === '.github-write-readiness-badge') return this.className.includes('github-write-readiness-badge');
    if (selector === '.github-write-readiness-refresh') return this.className.includes('github-write-readiness-refresh');
    if (selector === '#scheduleRuntimeCard') return this.id === 'scheduleRuntimeCard';
    return false;
  }
  find(selector) { if (this.matches(selector)) return this; for (const child of this.children) { const found = child.find?.(selector); if (found) return found; } return null; }
  querySelector(selector) { for (const child of this.children) { const found = child.find?.(selector); if (found) return found; } return null; }
}

function fixture({ hostCard = false, addListenerError = false } = {}) {
  const rail = new FakeElement(); rail.className = 'utility-rail';
  let card = null, status = null, badge = null, refresh = null;
  if (hostCard) {
    card = new FakeElement('section'); card.id = 'githubWriteReadinessCard'; card.setAttribute('aria-busy', 'host-busy');
    status = new FakeElement('p'); status.id = 'githubWriteReadinessSummary'; status.className = 'github-write-readiness-summary'; status.textContent = 'host status'; status.dataset.state = 'host-status';
    badge = new FakeElement('strong'); badge.className = 'github-write-readiness-badge'; badge.textContent = 'host badge'; badge.dataset.state = 'host-badge';
    refresh = new FakeElement('button'); refresh.className = 'github-write-readiness-refresh'; refresh.textContent = 'host refresh'; refresh.disabled = true;
    if (addListenerError) refresh.addEventListener = () => { throw new Error('listener failed'); };
    card.append(status, badge, refresh); rail.append(card);
  }
  const documentRef = {
    createElement: (tag) => new FakeElement(tag),
    querySelector(selector) { return rail.find(selector); }
  };
  let pendingResolve = null;
  let aborted = 0;
  const rootRef = {
    AbortController,
    setTimeout,
    clearTimeout,
    fetch: async (_url, options) => await new Promise((resolve, reject) => {
      pendingResolve = resolve;
      options.signal.addEventListener('abort', () => { aborted += 1; const e = new Error('aborted'); e.name = 'AbortError'; reject(e); }, { once: true });
    })
  };
  return { rail, documentRef, rootRef, get card() { return rail.find('#githubWriteReadinessCard'); }, host: { card, status, badge, refresh }, resolve(value) { pendingResolve?.(value); }, get aborted() { return aborted; } };
}

{
  const f = fixture();
  const controller = api.createController({ documentRef: f.documentRef, rootRef: f.rootRef, fetchImpl: f.rootRef.fetch });
  assert.equal(controller.mount(), true);
  assert.ok(f.card, 'controller creates readiness card when absent');
  const refresh = f.card.querySelector('.github-write-readiness-refresh');
  assert.equal(refresh.listenerCount('click'), 1);
  assert.equal(f.card.getAttribute('aria-busy'), 'true');
  assert.equal(controller.getState().loading, true);
  assert.equal(controller.destroy(), true);
  assert.equal(controller.destroy(), false);
  assert.equal(f.card, null, 'controller-owned card removed on destroy');
  assert.equal(f.aborted, 1, 'pending health request aborted on destroy');
}

{
  const f = fixture({ hostCard: true });
  const { card, status, badge, refresh } = f.host;
  const controller = api.createController({ documentRef: f.documentRef, rootRef: f.rootRef, fetchImpl: f.rootRef.fetch });
  assert.equal(controller.mount(), true);
  assert.equal(refresh.listenerCount('click'), 1);
  assert.equal(api.createController({ documentRef: f.documentRef, rootRef: f.rootRef, fetchImpl: f.rootRef.fetch }).mount(), false, 'duplicate active card ownership fails closed');
  assert.equal(controller.destroy(), true);
  assert.equal(f.card, card, 'host card survives destroy');
  assert.equal(card.getAttribute('aria-busy'), 'host-busy');
  assert.equal(card.getAttribute('data-hafize-github-write-readiness-owner'), null);
  assert.equal(status.textContent, 'host status');
  assert.equal(status.dataset.state, 'host-status');
  assert.equal(badge.textContent, 'host badge');
  assert.equal(badge.dataset.state, 'host-badge');
  assert.equal(refresh.textContent, 'host refresh');
  assert.equal(refresh.disabled, true);
  assert.equal(refresh.listenerCount('click'), 0);
}

{
  const f = fixture({ hostCard: true, addListenerError: true });
  const { card, status, badge, refresh } = f.host;
  const controller = api.createController({ documentRef: f.documentRef, rootRef: f.rootRef, fetchImpl: f.rootRef.fetch });
  assert.equal(controller.mount(), false, 'partial install failure rolls back');
  assert.equal(f.card, card);
  assert.equal(card.getAttribute('data-hafize-github-write-readiness-owner'), null);
  assert.equal(status.textContent, 'host status');
  assert.equal(badge.textContent, 'host badge');
  assert.equal(refresh.disabled, true);
  refresh.addEventListener = FakeElement.prototype.addEventListener;
  const retry = api.createController({ documentRef: f.documentRef, rootRef: f.rootRef, fetchImpl: f.rootRef.fetch });
  assert.equal(retry.mount(), true, 'failed install releases ownership for retry');
  retry.destroy();
}

{
  const f = fixture({ hostCard: true });
  const controller = api.createController({ documentRef: f.documentRef, rootRef: f.rootRef, fetchImpl: async () => ({ ok: true, json: async () => ({ githubWriteConfigured: true }) }) });
  assert.equal(controller.mount(), true);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(f.host.status.textContent, 'GitHub yazma sınırı hazır; her yazma ayrı açık onay gerektirir.');
  assert.equal(f.host.status.dataset.state, 'ready');
  assert.equal(f.host.badge.textContent, 'Açık onay gerekli');
  assert.equal(f.host.badge.dataset.state, 'ready');
  assert.equal(f.host.refresh.disabled, false);
  controller.destroy();
  assert.equal(f.host.status.textContent, 'host status', 'host state restored after successful render');
}

console.log('GitHub write readiness controller lifecycle tests passed');
