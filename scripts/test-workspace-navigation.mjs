import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const workspace = require('../public/workspace-navigation.js');
const sw = require('../public/sw-policy.js');

class FakeClassList {
  constructor(node) { this.node = node; }
  set tokens(value) { this.node.className = [...value].join(' '); }
  get tokens() { return new Set(String(this.node.className || '').split(/\s+/).filter(Boolean)); }
  contains(value) { return this.tokens.has(value); }
  toggle(value, force) {
    const next = force === undefined ? !this.contains(value) : Boolean(force);
    const tokens = this.tokens;
    if (next) tokens.add(value); else tokens.delete(value);
    this.tokens = tokens;
    return next;
  }
}

class FakeNode {
  constructor(tag = 'div', id = '', className = '') {
    this.tagName = tag.toUpperCase(); this.id = id; this.className = className;
    this.classList = new FakeClassList(this); this.children = []; this.parentNode = null;
    this.attributes = new Map(); this.listeners = new Map(); this.hidden = false; this.disabled = false;
    this.textContent = ''; this.focused = false;
  }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.has(name) ? this.attributes.get(name) : null; }
  removeAttribute(name) { this.attributes.delete(name); }
  append(...nodes) { for (const node of nodes) { node.remove?.(); node.parentNode = this; this.children.push(node); } }
  prepend(...nodes) { for (const node of [...nodes].reverse()) { node.remove?.(); node.parentNode = this; this.children.unshift(node); } }
  remove() { if (!this.parentNode) return; const i = this.parentNode.children.indexOf(this); if (i >= 0) this.parentNode.children.splice(i, 1); this.parentNode = null; }
  addEventListener(type, handler) { const set = this.listeners.get(type) || new Set(); set.add(handler); this.listeners.set(type, set); }
  removeEventListener(type, handler) { this.listeners.get(type)?.delete(handler); }
  dispatch(type, event = {}) { for (const handler of [...(this.listeners.get(type) || [])]) handler({ preventDefault() {}, ...event }); }
  click() { this.dispatch('click'); }
  focus() { this.focused = true; }
  querySelectorAll(selector) { return selector === '.nav-item' ? this.children.filter((n) => n.classList.contains('nav-item')) : []; }
}

function find(node, id) {
  if (!node) return null; if (node.id === id) return node;
  for (const child of node.children) { const result = find(child, id); if (result) return result; }
  return null;
}

function host() {
  const head = new FakeNode('head');
  const main = new FakeNode('main', '', 'main');
  const primary = new FakeNode('div', '', 'primary-column');
  const rail = new FakeNode('aside', '', 'utility-rail');
  rail.setAttribute('aria-label', 'Hafize yardımcı araçları'); main.append(primary, rail);
  const navList = new FakeNode('nav', '', 'nav-list');
  const nav = {
    chat: new FakeNode('button', '', 'nav-item active'),
    tasks: new FakeNode('button', '', 'nav-item'),
    connections: new FakeNode('button', '', 'nav-item'),
    settings: new FakeNode('button', '', 'nav-item')
  };
  nav.tasks.disabled = true; nav.connections.disabled = true; nav.settings.disabled = true;
  navList.append(nav.chat, nav.tasks, nav.connections, nav.settings);
  const cards = {
    account: new FakeNode('section', 'accountConnectionCard', 'utility-card'),
    memory: new FakeNode('section', 'memoryCard', 'utility-card'),
    runtime: new FakeNode('section', 'scheduleRuntimeCard', 'utility-card'),
    schedules: new FakeNode('section', 'scheduleListCard', 'utility-card'),
    canva: new FakeNode('section', 'canvaConnectionCard', 'utility-card'),
    github: new FakeNode('section', 'githubWriteReadinessCard', 'utility-card'),
    voice: new FakeNode('section', 'voiceCard', 'utility-card')
  };
  cards.voice.hidden = true;
  rail.append(...Object.values(cards));
  const roots = [head, main, navList];
  const documentRef = {
    head,
    createElement: (tag) => new FakeNode(tag),
    querySelector(selector) {
      if (selector === '.main') return main; if (selector === '.primary-column') return primary;
      if (selector === '.utility-rail') return rail; if (selector === '.nav-list') return navList; return null;
    },
    getElementById(id) { for (const root of roots) { const result = find(root, id); if (result) return result; } return null; }
  };
  let observer = null;
  class FakeMutationObserver { constructor(cb) { this.cb = cb; observer = this; } observe(target, options) { this.target = target; this.options = options; } disconnect() { this.disconnected = true; } trigger() { this.cb([], this); } }
  class FakeCustomEvent { constructor(type, init = {}) { this.type = type; this.detail = init.detail; } }
  const events = [];
  const rootRef = { MutationObserver: FakeMutationObserver, CustomEvent: FakeCustomEvent, dispatchEvent: (event) => { events.push(event); return true; } };
  return { documentRef, rootRef, main, primary, rail, nav, cards, events, observer: () => observer };
}

assert.deepEqual(workspace.WORKSPACES, ['chat', 'tasks', 'connections']);
assert.deepEqual(workspace.allowedCardIds('tasks'), ['scheduleRuntimeCard', 'scheduleListCard']);
assert.deepEqual(workspace.allowedCardIds('connections'), ['accountConnectionCard', 'canvaConnectionCard', 'githubWriteReadinessCard']);
for (const unsafe of ['', 'settings', 'TASKS', null, {}, '__proto__']) assert.equal(workspace.normalizeWorkspace(unsafe), 'chat');
assert.equal(workspace.isWorkspaceCard({ id: 'scheduleListCard' }, 'tasks'), true);
assert.equal(workspace.isWorkspaceCard({ id: 'scheduleListCard-rogue' }, 'tasks'), false);
assert.equal(workspace.workspaceCopy('tasks')?.title, 'Görevler');
assert.equal(workspace.workspaceCopy('chat'), null);

const h = host();
const controller = workspace.createController({ documentRef: h.documentRef, rootRef: h.rootRef, MutationObserverImpl: h.rootRef.MutationObserver });
assert.equal(controller.mount(), true);
assert.equal(h.nav.tasks.disabled, false);
assert.equal(h.nav.connections.disabled, false);
assert.equal(h.nav.settings.disabled, true);
assert.equal(h.nav.chat.getAttribute('aria-current'), 'page');

assert.equal(controller.setWorkspace('tasks', { focus: true }), true);
assert.equal(h.primary.hidden, true);
assert.equal(h.cards.runtime.hidden, false);
assert.equal(h.cards.schedules.hidden, false);
for (const card of [h.cards.account, h.cards.memory, h.cards.canva, h.cards.github, h.cards.voice]) assert.equal(card.hidden, true);
assert.equal(h.documentRef.getElementById(workspace.INTRO_ID).children[1].textContent, 'Görevler');
assert.equal(h.documentRef.getElementById(workspace.INTRO_ID).focused, true);
assert.equal(h.events.at(-1).detail.workspace, 'tasks');

const rogue = new FakeNode('section', 'rogue', 'utility-card');
h.rail.append(rogue); h.observer().trigger();
assert.equal(rogue.hidden, true);

assert.equal(controller.setWorkspace('connections'), true);
assert.equal(h.cards.account.hidden, false); assert.equal(h.cards.canva.hidden, false); assert.equal(h.cards.github.hidden, false);
for (const card of [h.cards.memory, h.cards.runtime, h.cards.schedules, h.cards.voice, rogue]) assert.equal(card.hidden, true);
assert.equal(h.documentRef.getElementById(workspace.INTRO_ID).children[1].textContent, 'Bağlantılar');

assert.equal(controller.setWorkspace('invalid'), true);
assert.equal(controller.getWorkspace(), 'chat');
for (const card of [h.cards.account, h.cards.memory, h.cards.runtime, h.cards.schedules, h.cards.canva, h.cards.github, rogue]) assert.equal(card.hidden, false);
assert.equal(h.cards.voice.hidden, true);

assert.equal(controller.setWorkspace('tasks'), true);
const observer = h.observer();
assert.equal(controller.destroy(), true);
assert.equal(observer.disconnected, true);
assert.equal(h.nav.tasks.disabled, true); assert.equal(h.nav.connections.disabled, true);
assert.equal(h.main.getAttribute('data-workspace'), null);
assert.equal(h.documentRef.getElementById(workspace.INTRO_ID), null);
assert.equal(h.documentRef.getElementById(workspace.STYLE_ID), null);
assert.equal(h.cards.voice.hidden, true);
assert.equal(controller.setWorkspace('connections'), false);

assert.match(sw.CURRENT_CACHE, /^hafize-shell-v[1-9]\d*$/);
assert.equal(sw.SHELL_ASSETS.includes('/workspace-navigation.js'), true);
assert.equal(sw.SHELL_ASSETS.includes('/workspace-navigation.css'), true);
for (const path of ['/workspace-navigation.js', '/workspace-navigation.css']) {
  assert.equal(sw.classifyRequest({ url: `https://hafize.example${path}`, method: 'GET', headers: {}, mode: 'same-origin' }, 'https://hafize.example'), 'shell');
}
assert.equal(sw.classifyRequest({ url: 'https://hafize.example/api/health', method: 'GET', headers: {}, mode: 'same-origin' }, 'https://hafize.example'), 'network-only');

console.log('workspace navigation OK: allowlists, accessible focus/current state, dynamic card filtering, PWA shell wiring and lifecycle restoration');
