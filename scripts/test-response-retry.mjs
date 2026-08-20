import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const retry = require('../public/response-retry.js');

class FakeClassList {
  constructor(owner, values = []) { this.owner = owner; this.values = new Set(values); }
  contains(value) { return this.values.has(value) || String(this.owner.className || '').split(/\s+/).includes(value); }
  add(value) { this.values.add(value); }
  remove(value) { this.values.delete(value); }
}

class FakeElement {
  constructor(tagName = 'div', classes = []) {
    this.tagName = tagName.toUpperCase();
    this.id = '';
    this.type = '';
    this.value = '';
    this.textContent = '';
    this.hidden = false;
    this.title = '';
    this.disabled = false;
    this.dataset = {};
    this.className = classes.join(' ');
    this.classList = new FakeClassList(this, classes);
    this.attributes = new Map();
    this.children = [];
    this.parentNode = null;
    this.listeners = new Map();
    this.focused = false;
    this.clickCount = 0;
  }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.has(name) ? this.attributes.get(name) : null; }
  append(node) { node.parentNode = this; this.children.push(node); }
  remove() {
    if (!this.parentNode) return;
    this.parentNode.children = this.parentNode.children.filter((node) => node !== this);
    this.parentNode = null;
  }
  addEventListener(name, listener) {
    if (!this.listeners.has(name)) this.listeners.set(name, []);
    this.listeners.get(name).push(listener);
  }
  removeEventListener(name, listener) {
    const list = this.listeners.get(name) || [];
    this.listeners.set(name, list.filter((item) => item !== listener));
  }
  dispatchEvent(event) {
    for (const listener of this.listeners.get(event?.type) || []) listener(event);
    return true;
  }
  click() {
    this.clickCount += 1;
    this.dispatchEvent({ type: 'click', target: this });
  }
  focus() { this.focused = true; }
  matchesClass(name) { return this.classList.contains(name); }
  descendants() { return this.children.flatMap((child) => [child, ...child.descendants()]); }
  querySelectorAll(selector) {
    const all = this.descendants();
    if (selector === '.message') return all.filter((node) => node.matchesClass('message'));
    if (selector === `.${retry.ACTION_CLASS}`) return all.filter((node) => node.matchesClass(retry.ACTION_CLASS));
    return [];
  }
  querySelector(selector) {
    const all = this.descendants();
    if (selector === '.content') return all.find((node) => node.matchesClass('content')) || null;
    if (selector === '.message-edit-btn') return all.find((node) => node.matchesClass('message-edit-btn')) || null;
    if (selector === `.${retry.ACTION_CLASS}`) return all.find((node) => node.matchesClass(retry.ACTION_CLASS)) || null;
    return null;
  }
}

class FakeObserver {
  static instances = [];
  constructor(callback) {
    this.callback = callback;
    this.targets = [];
    this.disconnected = false;
    FakeObserver.instances.push(this);
  }
  observe(target, options) { this.targets.push({ target, options }); }
  disconnect() { this.disconnected = true; }
}

class ThrowingObserver extends FakeObserver {
  observe(target, options) {
    super.observe(target, options);
    throw new Error('observer install failed');
  }
}

function message(role, text, id) {
  const article = new FakeElement('article', ['message', role]);
  article.dataset.messageId = id;
  const content = new FakeElement('div', ['content']);
  content.textContent = text;
  article.append(content);
  if (role === 'user') {
    const edit = new FakeElement('button', ['message-edit-btn']);
    article.append(edit);
  }
  return article;
}

function fixture({ streaming = false, draft = '', editAvailable = true, hostStatus = false, hostAction = false } = {}) {
  FakeObserver.instances = [];
  const messages = new FakeElement('div');
  messages.id = 'messages';
  messages.append(message('user', 'İlk soru', 'u-1'));
  messages.append(message('assistant', 'İlk cevap', 'a-1'));
  messages.append(message('user', 'Son kullanıcı isteği', 'u-2'));
  messages.append(message('assistant', 'Son cevap', 'a-2'));
  if (!editAvailable) {
    const lastUser = messages.querySelectorAll('.message').at(-2);
    lastUser.children = lastUser.children.filter((node) => !node.matchesClass('message-edit-btn'));
  }
  const composer = new FakeElement('form');
  composer.id = 'composer';
  let existingStatus = null;
  if (hostStatus) {
    existingStatus = new FakeElement('p');
    existingStatus.id = retry.STATUS_ID;
    existingStatus.textContent = 'Host durumu';
    existingStatus.hidden = false;
    composer.append(existingStatus);
  }
  let existingAction = null;
  if (hostAction) {
    existingAction = new FakeElement('div', [retry.ACTION_CLASS]);
    existingAction.textContent = 'Host retry action';
    messages.querySelectorAll('.message').at(-1).append(existingAction);
  }
  const input = new FakeElement('textarea');
  input.id = 'messageInput';
  input.value = draft;
  const send = new FakeElement('button');
  send.id = 'sendBtn';
  if (streaming) send.classList.add('streaming');
  const byId = new Map([
    ['messages', messages],
    ['composer', composer],
    ['messageInput', input],
    ['sendBtn', send]
  ]);
  const documentRef = {
    createElement: (tag) => new FakeElement(tag),
    querySelector(selector) {
      if (selector === `#${retry.STATUS_ID}`) return composer.descendants().find((node) => node.id === retry.STATUS_ID) || null;
      if (!selector.startsWith('#')) return null;
      return byId.get(selector.slice(1)) || null;
    }
  };
  return { documentRef, messages, composer, input, send, existingStatus, existingAction };
}

assert.equal(retry.MAX_PROMPT_CHARS, 12000);
assert.match(retry.DRAFT_BLOCKED, /taslağ/i);
assert.match(retry.PROMPT_UNAVAILABLE, /bulunamadı/i);
assert.match(retry.EDIT_UNAVAILABLE, /düzenleme dalı/i);
assert.equal(retry.normalizePrompt('  tekrar sor  '), 'tekrar sor');
assert.equal(retry.normalizePrompt('   '), '');
assert.equal(retry.normalizePrompt(null), '');
assert.equal(retry.normalizePrompt('x'.repeat(retry.MAX_PROMPT_CHARS + 1)), '');
assert.equal(retry.hasDraft(' taslak '), true);
assert.equal(retry.hasDraft(''), false);
assert.equal(retry.isStreaming({ classList: { contains: (name) => name === 'streaming' } }), true);
assert.deepEqual(retry.lastRetryPair([
  { id: 'u1', role: 'user', content: 'ilk soru' },
  { id: 'a1', role: 'assistant', content: 'ilk yanıt' },
  { id: 'u2', role: 'user', content: 'ikinci soru' },
  { id: 'a2', role: 'assistant', content: 'ikinci yanıt' }
]), { assistantId: 'a2', userId: 'u2', prompt: 'ikinci soru' });

{
  const f = fixture();
  const controller = retry.createController({ documentRef: f.documentRef, MutationObserverImpl: FakeObserver });
  assert.equal(controller.mount(), true);
  assert.equal(FakeObserver.instances.length, 1);
  assert.equal(FakeObserver.instances[0].targets.length, 2);
  const actions = f.messages.querySelectorAll(`.${retry.ACTION_CLASS}`);
  assert.equal(actions.length, 2, 'each completed user-assistant turn gets a retry action');
  const pairs = controller.getRenderedPairs(f.messages);
  assert.deepEqual(pairs.map((pair) => pair.userMessageId), ['u-1', 'u-2']);

  const firstEdit = pairs[0].user.querySelector('.message-edit-btn');
  actions[0].children[0].click();
  assert.equal(firstEdit.clickCount, 1, 'historical retry delegates to the matching guarded edit branch');

  const lastPair = controller.getRenderedPair(f.messages);
  const lastEdit = lastPair.user.querySelector('.message-edit-btn');
  const staleButton = actions[1].children[0];
  staleButton.click();
  assert.equal(lastEdit.clickCount, 1, 'latest retry also delegates to guarded edit branch');
  assert.equal(f.input.value, '', 'retry must not mutate composer before branch reload');
  assert.equal(f.documentRef.querySelector(`#${retry.STATUS_ID}`).textContent, 'Yeni tekrar dalı hazırlanıyor…');
  assert.equal(controller.render(), true);
  assert.equal(f.messages.querySelectorAll(`.${retry.ACTION_CLASS}`).length, 2, 'stable render must not duplicate actions');
  assert.equal(controller.destroy(), true);
  assert.equal(FakeObserver.instances[0].disconnected, true);
  assert.equal(f.messages.querySelectorAll(`.${retry.ACTION_CLASS}`).length, 0);
  assert.equal(f.documentRef.querySelector(`#${retry.STATUS_ID}`), null);
  staleButton.click();
  assert.equal(lastEdit.clickCount, 1, 'destroyed retry button must be inert');
  assert.equal(controller.render(), false, 'destroyed controller must stay inert');
  assert.equal(controller.prepareRetryBranch(lastPair), false, 'destroyed controller must not restart a branch');
}

{
  const f = fixture({ draft: 'Kaybetmek istemediğim taslak' });
  const controller = retry.createController({ documentRef: f.documentRef, MutationObserverImpl: FakeObserver });
  controller.mount();
  const pair = controller.getRenderedPair(f.messages);
  const edit = pair.user.querySelector('.message-edit-btn');
  f.messages.querySelectorAll(`.${retry.ACTION_CLASS}`).at(-1).children[0].click();
  assert.equal(f.input.value, 'Kaybetmek istemediğim taslak');
  assert.equal(edit.clickCount, 0, 'draft guard must prevent branch action');
  assert.equal(f.input.focused, true);
  assert.equal(f.documentRef.querySelector(`#${retry.STATUS_ID}`).textContent, retry.DRAFT_BLOCKED);
}

{
  const f = fixture({ streaming: true });
  const controller = retry.createController({ documentRef: f.documentRef, MutationObserverImpl: FakeObserver });
  controller.mount();
  assert.equal(f.messages.querySelectorAll(`.${retry.ACTION_CLASS}`).length, 0, 'all owned retry actions stay hidden during streaming');
}

{
  const f = fixture({ editAvailable: false });
  const controller = retry.createController({ documentRef: f.documentRef, MutationObserverImpl: FakeObserver });
  controller.mount();
  const pair = controller.getRenderedPair(f.messages);
  assert.equal(controller.prepareRetryBranch(pair), false);
  assert.equal(f.documentRef.querySelector(`#${retry.STATUS_ID}`).textContent, retry.EDIT_UNAVAILABLE);
}

{
  const f = fixture({ hostStatus: true, hostAction: true });
  const controller = retry.createController({ documentRef: f.documentRef, MutationObserverImpl: FakeObserver });
  assert.equal(controller.mount(), true);
  assert.equal(f.messages.querySelectorAll(`.${retry.ACTION_CLASS}`).length, 2, 'host action blocks only its matching assistant decoration');
  controller.prepareRetryBranch(controller.getRenderedPair(f.messages));
  assert.equal(f.existingStatus.textContent, 'Yeni tekrar dalı hazırlanıyor…');
  assert.equal(controller.destroy(), true);
  assert.equal(f.existingStatus.parentNode, f.composer, 'host status must not be removed');
  assert.equal(f.existingStatus.textContent, 'Host durumu', 'host status text must be restored exactly');
  assert.equal(f.existingStatus.hidden, false, 'host status visibility must be restored exactly');
  assert.equal(f.existingAction.parentNode !== null, true, 'host retry action must survive teardown');
  assert.equal(f.existingAction.textContent, 'Host retry action');
}

{
  const f = fixture();
  const first = retry.createController({ documentRef: f.documentRef, MutationObserverImpl: FakeObserver });
  const second = retry.createController({ documentRef: f.documentRef, MutationObserverImpl: FakeObserver });
  assert.equal(first.mount(), true);
  assert.equal(second.mount(), false, 'second controller on the same messages host must fail closed');
  assert.equal(first.destroy(), true);
  assert.equal(second.mount(), true, 'ownership must be released for a clean remount');
  assert.equal(second.destroy(), true);
}

{
  const f = fixture({ hostStatus: true });
  const controller = retry.createController({ documentRef: f.documentRef, MutationObserverImpl: ThrowingObserver });
  assert.equal(controller.mount(), false, 'partial observer install must roll back');
  assert.equal(f.input.listeners.get('input')?.length || 0, 0, 'input listener must roll back exactly');
  assert.equal(f.existingStatus.parentNode, f.composer);
  assert.equal(f.existingStatus.textContent, 'Host durumu');
  assert.equal(f.existingStatus.hidden, false);
  const retryController = retry.createController({ documentRef: f.documentRef, MutationObserverImpl: FakeObserver });
  assert.equal(retryController.mount(), true, 'failed install must not leak ownership');
  assert.equal(retryController.destroy(), true);
}

assert.equal(retry.mount({ documentRef: { querySelector: () => null }, MutationObserverImpl: FakeObserver }), null);
console.log('response retry historical branch lifecycle tests passed');
