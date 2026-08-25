import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const workspace = require('../public/workspace-navigation.js');

class FakeClassList {
  constructor(node) { this.node = node; }
  tokens() { return new Set(String(this.node.className || '').split(/\s+/).filter(Boolean)); }
  write(tokens) { this.node.className = [...tokens].join(' '); }
  contains(value) { return this.tokens().has(value); }
  toggle(value, force) {
    const tokens = this.tokens();
    const next = force === undefined ? !tokens.has(value) : Boolean(force);
    if (next) tokens.add(value); else tokens.delete(value);
    this.write(tokens);
    return next;
  }
}

class FakeNode {
  constructor(tag = 'div', { id = '', className = '' } = {}) {
    this.tagName = tag.toUpperCase();
    this.id = id;
    this.className = className;
    this.classList = new FakeClassList(this);
    this.children = [];
    this.parentNode = null;
    this.attributes = new Map();
    this.listeners = new Map();
    this.dataset = {};
    this.hidden = false;
    this.disabled = false;
    this.textContent = '';
    this.focused = false;
  }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.has(name) ? this.attributes.get(name) : null; }
  removeAttribute(name) { this.attributes.delete(name); }
  append(...nodes) {
    for (const node of nodes) {
      if (!node) continue;
      node.remove?.();
      node.parentNode = this;
      this.children.push(node);
    }
  }
  prepend(...nodes) {
    for (const node of [...nodes].reverse()) {
      if (!node) continue;
      node.remove?.();
      node.parentNode = this;
      this.children.unshift(node);
    }
  }
  remove() {
    if (!this.parentNode) return;
    const index = this.parentNode.children.indexOf(this);
    if (index >= 0) this.parentNode.children.splice(index, 1);
    this.parentNode = null;
  }
  addEventListener(type, handler) {
    const handlers = this.listeners.get(type) || new Set();
    handlers.add(handler);
    this.listeners.set(type, handlers);
  }
  removeEventListener(type, handler) { this.listeners.get(type)?.delete(handler); }
  dispatch(type, event = {}) {
    const normalized = { preventDefault() {}, ...event };
    for (const handler of [...(this.listeners.get(type) || [])]) handler(normalized);
  }
  click() { this.dispatch('click'); }
  focus() { this.focused = true; }
  querySelectorAll(selector) {
    if (selector === '.nav-item') return this.children.filter((node) => node.classList.contains('nav-item'));
    return [];
  }
}

function findById(node, id) {
  if (!node) return null;
  if (node.id === id) return node;
  for (const child of node.children || []) {
    const found = findById(child, id);
    if (found) return found;
  }
  return null;
}

function makeCard(id, hidden = false) {
  const node = new FakeNode('section', { id, className: 'utility-card' });
  node.hidden = hidden;
  return node;
}

function buildHost() {
  const head = new FakeNode('head');
  const main = new FakeNode('main', { className: 'main' });
  const primary = new FakeNode('div', { className: 'primary-column' });
  const rail = new FakeNode('aside', { className: 'utility-rail' });
  rail.setAttribute('aria-label', 'Hafize yardımcı araçları');
  main.append(primary, rail);

  const navList = new FakeNode('nav', { className: 'nav-list' });
  const chat = new FakeNode('button', { className: 'nav-item active' });
  const tasks = new FakeNode('button', { className: 'nav-item' });
  const connections = new FakeNode('button', { className: 'nav-item' });
  const settings = new FakeNode('button', { className: 'nav-item' });
  tasks.disabled = true;
  connections.disabled = true;
  settings.disabled = true;
  navList.append(chat, tasks, connections, settings);

  const cards = {
    account: makeCard('accountConnectionCard'),
    memory: makeCard('memoryCard'),
    runtime: makeCard('scheduleRuntimeCard'),
    schedules: makeCard('scheduleListCard'),
    canva: makeCard('canvaConnectionCard'),
    github: makeCard('githubWriteReadinessCard'),
    voice: makeCard('voiceCard', true)
  };
  rail.append(...Object.values(cards));

  const roots = [head, main, navList];
  const documentRef = {
    head,
    createElement: (tag) => new FakeNode(tag),
    querySelector(selector) {
      if (selector === '.main') return main;
      if (selector === '.primary-column') return primary;
      if (selector === '.utility-rail') return rail;
      if (selector === '.nav-list') return navList;
      return null;
    },
    getElementById(id) {
      for (const root of roots) {
        const found = findById(root, id);
        if (found) return found;
      }
      return null;
    }
  };

  let latestObserver = null;
  class FakeMutationObserver {
    constructor(callback) { this.callback = callback; this.disconnected = false; latestObserver = this; }
    observe(target, options) { this.target = target; this.options = options; }
    disconnect() { this.disconnected = true; }
    trigger() { this.callback([], this); }
  }
  class FakeCustomEvent {
    constructor(type, init = {}) { this.type = type; this.detail = init.detail; }
  }
  const events = [];
  const rootRef = {
    MutationObserver: FakeMutationObserver,
    CustomEvent: FakeCustomEvent,
    dispatchEvent(event) { events.push(event); return true; }
  };

  return {
    documentRef, rootRef, main, primary, rail, nav: { chat, tasks, connections, settings }, cards, events,
    observer: () => latestObserver
  };
}

const host = buildHost();
const controller = workspace.createController({
  documentRef: host.documentRef,
  rootRef: host.rootRef,
  MutationObserverImpl: host.rootRef.MutationObserver
});
assert.equal(controller.mount(), true);
assert.equal(controller.getWorkspace(), 'chat');
assert.equal(host.nav.tasks.disabled, false, 'tasks only unlock after successful mount');
assert.equal(host.nav.connections.disabled, false, 'connections only unlock after successful mount');
assert.equal(host.nav.settings.disabled, true, 'unimplemented settings remain fail-closed');
assert.equal(host.main.getAttribute('data-workspace'), 'chat');
assert.equal(host.primary.hidden, false);
assert.equal(host.nav.chat.getAttribute('aria-current'), 'page');
assert.equal(host.documentRef.getElementById(workspace.INTRO_ID)?.hidden, true);
assert.ok(host.documentRef.getElementById(workspace.STYLE_ID));

assert.equal(controller.setWorkspace('tasks', { focus: true }), true);
assert.equal(controller.getWorkspace(), 'tasks');
assert.equal(host.primary.hidden, true);
assert.equal(host.main.getAttribute('data-workspace'), 'tasks');
assert.equal(host.rail.getAttribute('aria-label'), 'Hafize görevler çalışma alanı');
assert.equal(host.cards.runtime.hidden, false);
assert.equal(host.cards.schedules.hidden, false);
for (const card of [host.cards.account, host.cards.memory, host.cards.canva, host.cards.github, host.cards.voice]) {
  assert.equal(card.hidden, true);
}
const intro = host.documentRef.getElementById(workspace.INTRO_ID);
assert.equal(intro.hidden, false);
assert.equal(intro.children[1].textContent, 'Görevler');
assert.equal(intro.focused, true);
assert.equal(host.nav.tasks.getAttribute('aria-current'), 'page');
assert.equal(host.nav.chat.getAttribute('aria-current'), null);
assert.deepEqual(host.events.at(-1)?.detail, { workspace: 'tasks' });

const rogue = makeCard('scheduleListCard-rogue');
host.rail.append(rogue);
host.observer().trigger();
assert.equal(rogue.hidden, true, 'dynamically inserted non-allowlisted cards stay hidden in focused workspaces');

assert.equal(controller.setWorkspace('connections'), true);
assert.equal(host.cards.account.hidden, false);
assert.equal(host.cards.canva.hidden, false);
assert.equal(host.cards.github.hidden, false);
for (const card of [host.cards.memory, host.cards.runtime, host.cards.schedules, host.cards.voice, rogue]) {
  assert.equal(card.hidden, true);
}
assert.equal(host.rail.getAttribute('aria-label'), 'Hafize bağlantılar çalışma alanı');
assert.equal(intro.children[1].textContent, 'Bağlantılar');
assert.equal(host.nav.connections.getAttribute('aria-current'), 'page');

assert.equal(controller.setWorkspace('not-a-workspace'), true, 'unknown workspace values normalize safely back to chat');
assert.equal(controller.getWorkspace(), 'chat');
assert.equal(host.primary.hidden, false);
assert.equal(host.rail.getAttribute('aria-label'), 'Hafize yardımcı araçları');
for (const card of [host.cards.account, host.cards.memory, host.cards.runtime, host.cards.schedules, host.cards.canva, host.cards.github, rogue]) {
  assert.equal(card.hidden, false, `chat restores original visibility for ${card.id}`);
}
assert.equal(host.cards.voice.hidden, true, 'pre-existing hidden state is restored, not overwritten');
assert.equal(intro.hidden, true);

controller.setWorkspace('tasks');
const observer = host.observer();
assert.equal(controller.destroy(), true);
assert.equal(observer.disconnected, true);
assert.equal(host.nav.tasks.disabled, true);
assert.equal(host.nav.connections.disabled, true);
assert.equal(host.nav.chat.classList.contains('active'), true);
assert.equal(host.nav.tasks.classList.contains('active'), false);
assert.equal(host.main.getAttribute('data-workspace'), null);
assert.equal(host.primary.hidden, false);
assert.equal(host.rail.getAttribute('aria-label'), 'Hafize yardımcı araçları');
assert.equal(host.documentRef.getElementById(workspace.INTRO_ID), null);
assert.equal(host.documentRef.getElementById(workspace.STYLE_ID), null);
assert.equal(host.cards.voice.hidden, true);
assert.equal(controller.setWorkspace('connections'), false, 'destroyed controllers cannot mutate the host');

const remount = workspace.createController({
  documentRef: host.documentRef,
  rootRef: host.rootRef,
  MutationObserverImpl: host.rootRef.MutationObserver
});
assert.equal(remount.mount(), true, 'destroy releases the active-main ownership guard');
assert.equal(remount.destroy(), true);

assert.throws(() => workspace.createController({ documentRef: {}, rootRef: {} }), /INVALID_WORKSPACE_NAVIGATION_DOCUMENT/);
assert.equal(workspace.mount({ querySelector() { return null; }, createElement() {} }, {}), null);

console.log('workspace navigation OK: fail-closed mount, task/connection focus, dynamic allowlist filtering, accessibility state and full lifecycle restoration');
