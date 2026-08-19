import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const progress = require('../public/response-progress.js');

class FakeClassList {
  constructor(values = []) { this.values = new Set(values); }
  contains(value) { return this.values.has(value); }
  add(value) { this.values.add(value); }
  remove(value) { this.values.delete(value); }
}

class FakeElement {
  constructor(tagName = 'div') {
    this.tagName = tagName.toUpperCase();
    this.id = '';
    this.textContent = '';
    this.hidden = false;
    this.title = '';
    this.dataset = {};
    this.attributes = new Map();
    this.children = [];
    this.parentNode = null;
    this.classList = new FakeClassList();
    this.assistantNodes = [];
  }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.has(name) ? this.attributes.get(name) : null; }
  removeAttribute(name) { this.attributes.delete(name); }
  append(node) { node.parentNode = this; this.children.push(node); }
  prepend(node) { node.parentNode = this; this.children.unshift(node); }
  remove() {
    if (!this.parentNode) return;
    this.parentNode.children = this.parentNode.children.filter((node) => node !== this);
    this.parentNode = null;
  }
  querySelectorAll(selector) { return selector === '.message.assistant .content' ? this.assistantNodes : []; }
}

class FakeObserver {
  static instances = [];
  constructor(callback) { this.callback = callback; this.targets = []; this.disconnected = false; FakeObserver.instances.push(this); }
  observe(target, options) { this.targets.push({ target, options }); }
  disconnect() { this.disconnected = true; }
}

function fixture({ streaming = false, text = '', busy = null, existingStatus = null } = {}) {
  FakeObserver.instances = [];
  const head = new FakeElement('head');
  const messages = new FakeElement('div');
  messages.id = 'messages';
  if (busy !== null) messages.setAttribute('aria-busy', busy);
  if (text !== null) {
    const content = new FakeElement('div');
    content.textContent = text;
    messages.assistantNodes = [content];
  }
  const composer = new FakeElement('form');
  composer.id = 'composer';
  if (existingStatus) composer.append(existingStatus);
  const send = new FakeElement('button');
  send.id = 'sendBtn';
  if (streaming) send.classList.add('streaming');
  const byId = new Map([['messages', messages], ['composer', composer], ['sendBtn', send]]);
  const documentRef = {
    head,
    createElement: (tag) => new FakeElement(tag),
    querySelector(selector) {
      if (!selector.startsWith('#')) return null;
      const id = selector.slice(1);
      if (id === progress.STYLE_ID) return head.children.find((node) => node.id === id) || null;
      if (id === progress.STATUS_ID) return composer.children.find((node) => node.id === id) || null;
      return byId.get(id) || null;
    }
  };
  return { documentRef, head, messages, composer, send };
}

{
  const send = new FakeElement('button');
  const messages = new FakeElement('div');
  assert.equal(progress.derivePhase(send, messages), 'idle');
  send.classList.add('streaming');
  assert.equal(progress.derivePhase(send, messages), 'preparing');
  const content = new FakeElement('div');
  content.textContent = 'Merhaba';
  messages.assistantNodes = [content];
  assert.equal(progress.derivePhase(send, messages), 'streaming');
}

{
  const f = fixture({ streaming: false, text: '' });
  const controller = progress.createController({ documentRef: f.documentRef, MutationObserverImpl: FakeObserver });
  assert.equal(controller.mount(), true);
  assert.equal(controller.mount(), false, 'mount is single-owner');
  const status = f.documentRef.querySelector(`#${progress.STATUS_ID}`);
  assert.equal(controller.snapshot().ownsStatus, true);
  assert.equal(status.hidden, true);
  assert.equal(status.getAttribute('role'), 'status');
  assert.equal(status.getAttribute('aria-live'), 'polite');
  assert.equal(f.messages.getAttribute('aria-busy'), 'false');
  assert.equal(FakeObserver.instances[0].targets.length, 2);

  f.send.classList.add('streaming');
  FakeObserver.instances[0].callback();
  assert.equal(status.hidden, false);
  assert.equal(status.textContent, progress.PREPARING_TEXT);
  assert.equal(status.dataset.phase, 'preparing');
  assert.equal(status.getAttribute('data-phase'), 'preparing');
  assert.equal(f.messages.getAttribute('aria-busy'), 'true');

  f.messages.assistantNodes[0].textContent = 'İlk token';
  FakeObserver.instances[0].callback();
  assert.equal(status.textContent, progress.STREAMING_TEXT);
  assert.equal(status.dataset.phase, 'streaming');

  f.send.classList.remove('streaming');
  FakeObserver.instances[0].callback();
  assert.equal(status.hidden, true);
  assert.equal(status.textContent, '');
  assert.equal(f.messages.getAttribute('aria-busy'), 'false');

  assert.equal(controller.destroy(), true);
  assert.equal(controller.destroy(), false, 'double destroy is a no-op');
  assert.equal(f.messages.getAttribute('aria-busy'), null);
  assert.equal(f.documentRef.querySelector(`#${progress.STATUS_ID}`), null);
  assert.equal(FakeObserver.instances[0].disconnected, true);
  assert.equal(controller.refresh(), 'idle');
  assert.equal(controller.paint('streaming'), false, 'public paint is inert after destroy');
}

{
  const hostStatus = new FakeElement('small');
  hostStatus.id = progress.STATUS_ID;
  hostStatus.hidden = false;
  hostStatus.textContent = 'Host durumu';
  hostStatus.dataset.phase = 'host';
  hostStatus.setAttribute('data-phase', 'host');
  hostStatus.setAttribute('role', 'note');
  const f = fixture({ streaming: true, text: 'Yanıt', busy: 'mixed', existingStatus: hostStatus });
  const controller = progress.createController({ documentRef: f.documentRef, MutationObserverImpl: FakeObserver });

  assert.equal(controller.mount(), true);
  assert.equal(controller.snapshot().ownsStatus, false);
  assert.equal(hostStatus.textContent, progress.STREAMING_TEXT);
  assert.equal(hostStatus.getAttribute('role'), 'note', 'host accessibility attributes are not replaced');
  assert.equal(f.messages.getAttribute('aria-busy'), 'true');

  assert.equal(controller.destroy(), true);
  assert.equal(hostStatus.parentNode, f.composer, 'host-owned status survives teardown');
  assert.equal(hostStatus.hidden, false);
  assert.equal(hostStatus.textContent, 'Host durumu');
  assert.equal(hostStatus.dataset.phase, 'host');
  assert.equal(hostStatus.getAttribute('data-phase'), 'host');
  assert.equal(hostStatus.getAttribute('role'), 'note');
  assert.equal(f.messages.getAttribute('aria-busy'), 'mixed');
}

{
  const hostStatus = new FakeElement('small');
  hostStatus.id = progress.STATUS_ID;
  hostStatus.hidden = true;
  hostStatus.textContent = 'Başlangıç';
  const f = fixture({ streaming: true, text: '', existingStatus: hostStatus });
  const controller = progress.createController({ documentRef: f.documentRef, MutationObserverImpl: FakeObserver });
  controller.mount();
  assert.equal(hostStatus.getAttribute('data-phase'), 'preparing');
  controller.destroy();
  assert.equal(hostStatus.getAttribute('data-phase'), null, 'missing host phase attribute is removed again');
  assert.equal('phase' in hostStatus.dataset, false, 'dataset phase is restored to absence');
  assert.equal(hostStatus.hidden, true);
  assert.equal(hostStatus.textContent, 'Başlangıç');
}

{
  const f = fixture({ streaming: true, text: 'Yanıt', busy: 'false' });
  const controller = progress.createController({ documentRef: f.documentRef, MutationObserverImpl: FakeObserver });
  controller.mount();
  assert.equal(controller.snapshot().phase, 'streaming');
  assert.equal(controller.destroy(), true);
  assert.equal(f.messages.getAttribute('aria-busy'), 'false', 'destroy must restore pre-existing aria-busy');
  assert.equal(controller.mount(), true, 'same controller can cleanly remount');
  assert.equal(FakeObserver.instances.length, 2);
  assert.equal(controller.destroy(), true);
}

{
  const documentRef = { querySelector: () => null };
  assert.equal(progress.mount({ documentRef, MutationObserverImpl: FakeObserver }), null);
}

console.log('response progress tests passed');
