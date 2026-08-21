import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const api = require('../public/message-copy.js');

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function button() {
  return { dataset: { idleLabel: 'Kopyala' }, textContent: 'Kopyala', disabled: false };
}

const content = { textContent: 'aynı mesaj' };
const first = deferred();
const second = deferred();
let call = 0;
const clipboard = {
  writeText() {
    call += 1;
    return call === 1 ? first.promise : second.promise;
  }
};
const timers = new Map();
let timerId = 0;
const documentRef = {
  createElement() { return {}; },
  querySelector() { return null; }
};
const controller = api.createController({
  documentRef,
  clipboard,
  secureContext: true,
  MutationObserverImpl: null,
  setTimeoutImpl(callback, delay) { const id = ++timerId; timers.set(id, { callback, delay }); return id; },
  clearTimeoutImpl(id) { timers.delete(id); }
});

{
  const target = button();
  const oldRequest = controller.copyMessage(target, content);
  const newRequest = controller.copyMessage(target, content);
  second.resolve();
  assert.equal(await newRequest, true);
  assert.equal(target.textContent, 'Kopyalandı');
  first.reject(new Error('old provider failure'));
  assert.equal(await oldRequest, false);
  assert.equal(target.textContent, 'Kopyalandı', 'older rejection cannot overwrite newer success');
  assert.equal(target.dataset.state, 'success');
}

{
  const a = deferred();
  const b = deferred();
  let index = 0;
  const isolated = api.createController({
    documentRef,
    clipboard: { writeText() { index += 1; return index === 1 ? a.promise : b.promise; } },
    secureContext: true,
    MutationObserverImpl: null,
    setTimeoutImpl(callback, delay) { const id = ++timerId; timers.set(id, { callback, delay }); return id; },
    clearTimeoutImpl(id) { timers.delete(id); }
  });
  const left = button();
  const right = button();
  const leftPending = isolated.copyMessage(left, content);
  const rightPending = isolated.copyMessage(right, content);
  b.resolve();
  a.resolve();
  assert.equal(await leftPending, true, 'generation is isolated per button');
  assert.equal(await rightPending, true);
  assert.equal(left.dataset.state, 'success');
  assert.equal(right.dataset.state, 'success');
}

console.log('message copy generation race tests passed');
