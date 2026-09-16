// The DOM harness is infrastructure: the panel suites only mean something if it
// dispatches events the way a browser does. `docs/CHECK_GATE.md` rules out a
// suite that tests its own stub *instead of* the product; this one guards the
// four behaviours the panel suites depend on — capture before target,
// `stopImmediatePropagation()`, selector matching and `dataset` — so those
// suites cannot pass against a harness that quietly does the wrong thing.
import assert from 'node:assert/strict';
import { change, click, createDocument, createWindow, installDomGlobals, keydown } from './dom-harness.mjs';

installDomGlobals();

/* Capture runs before the target, and can stop it ------------------------- */

{
  const documentRef = createDocument();
  const outer = documentRef.createElement('div');
  const inner = documentRef.createElement('button');
  outer.append(inner);
  documentRef.body.append(outer);

  const order = [];
  documentRef.addEventListener('click', () => order.push('document-capture'), true);
  outer.addEventListener('click', () => order.push('outer-capture'), true);
  inner.addEventListener('click', () => order.push('target'));
  outer.addEventListener('click', () => order.push('outer-bubble'));
  documentRef.addEventListener('click', () => order.push('document-bubble'));
  click(inner);
  assert.deepEqual(order, ['document-capture', 'outer-capture', 'target', 'outer-bubble', 'document-bubble']);
}

{
  const documentRef = createDocument();
  const input = documentRef.createElement('input');
  documentRef.body.append(input);
  const order = [];
  documentRef.body.addEventListener('change', (event) => { order.push('capture'); event.stopImmediatePropagation(); }, true);
  input.addEventListener('change', () => order.push('target'));
  change(input);
  assert.deepEqual(order, ['capture'], 'stopImmediatePropagation keeps the target handler from running');
}

{
  const documentRef = createDocument();
  const button = documentRef.createElement('button');
  documentRef.body.append(button);
  let calls = 0;
  const handler = () => { calls += 1; };
  button.addEventListener('click', handler, { once: true });
  click(button);
  click(button);
  assert.equal(calls, 1, 'a once listener runs once');

  let removed = 0;
  const other = () => { removed += 1; };
  button.addEventListener('click', other);
  button.removeEventListener('click', other);
  click(button);
  assert.equal(removed, 0, 'removeEventListener detaches the handler');

  const event = { prevented: false };
  button.addEventListener('click', (clickEvent) => { clickEvent.preventDefault(); event.prevented = true; });
  assert.equal(click(button), false, 'preventDefault is reported back to the dispatcher');
  assert.equal(event.prevented, true);
}

/* A non-bubbling event stays on its target -------------------------------- */

{
  const documentRef = createDocument();
  const child = documentRef.createElement('div');
  documentRef.body.append(child);
  const seen = [];
  documentRef.body.addEventListener('focusish', () => seen.push('parent'));
  child.addEventListener('focusish', () => seen.push('child'));
  child.dispatchEvent(new (createWindow(documentRef).Event)('focusish'));
  assert.deepEqual(seen, ['child']);
}

/* Selectors, dataset and structure ---------------------------------------- */

{
  const documentRef = createDocument();
  const card = documentRef.createElement('section');
  card.id = 'card';
  card.className = 'panel wide';
  const input = documentRef.createElement('input');
  input.setAttribute('type', 'file');
  const actions = documentRef.createElement('div');
  actions.className = 'prompt-item-actions';
  const use = documentRef.createElement('button');
  use.textContent = 'Kullan';
  const other = documentRef.createElement('button');
  other.setAttribute('data-diagnostics-repair', 'true');
  actions.append(use, other);
  card.append(input, actions);
  documentRef.body.append(card);

  assert.equal(documentRef.getElementById('card'), card);
  assert.equal(card.querySelector('input[type="file"]'), input, 'attribute selectors match');
  assert.equal(documentRef.querySelector('.panel .prompt-item-actions button'), use, 'descendant selectors match');
  assert.deepEqual(card.querySelectorAll('button'), [use, other]);
  assert.equal(card.querySelector('button[data-diagnostics-repair]'), other, 'data attributes are selectable');
  assert.equal(use.closest('#card'), card, 'closest walks up to the id');
  assert.equal(use.closest('.missing'), null);

  use.dataset.promptId = 'p1';
  assert.equal(use.getAttribute('data-prompt-id'), 'p1', 'dataset writes a kebab-case attribute');
  use.setAttribute('data-prompt-id', 'p2');
  assert.equal(use.dataset.promptId, 'p2', 'and reads it back');

  assert.equal(use.nextElementSibling, other);
  assert.equal(other.nextElementSibling, null);
  assert.equal(card.textContent, 'Kullan', 'textContent collects the text nodes below');

  card.replaceChildren();
  assert.deepEqual(card.childNodes, []);
  assert.equal(input.parentNode, null, 'replaceChildren detaches what it removed');
}

/* Focus and keyboard events ----------------------------------------------- */

{
  const documentRef = createDocument();
  const first = documentRef.createElement('button');
  const second = documentRef.createElement('button');
  documentRef.body.append(first, second);
  assert.equal(documentRef.activeElement, null);
  second.focus();
  assert.equal(documentRef.activeElement, second);

  const keys = [];
  second.addEventListener('keydown', (event) => keys.push([event.key, event.shiftKey]));
  keydown(second, 'Tab', { shiftKey: true });
  assert.deepEqual(keys, [['Tab', true]]);
}

/* `hidden` and `disabled` behave like the properties panels read ---------- */

{
  const documentRef = createDocument();
  const node = documentRef.createElement('div');
  assert.equal(node.hidden, false, 'a fresh element is visible');
  node.hidden = true;
  assert.equal(node.hidden, true);
  node.hidden = false;
  assert.equal(node.hidden, false);
}

/* Ordered insertion, class toggling and the composer's metrics ------------- */

{
  const documentRef = createDocument();
  const row = documentRef.createElement('div');
  const send = documentRef.createElement('button');
  row.append(send);
  documentRef.body.append(row);

  const stop = documentRef.createElement('button');
  row.insertBefore(stop, send);
  assert.deepEqual(row.children, [stop, send], 'insertBefore places a node ahead of its reference');
  assert.equal(stop.parentNode, row);

  row.insertBefore(stop, null);
  assert.deepEqual(row.children, [send, stop], 'a missing reference appends, and the node moves rather than duplicates');

  const orphan = documentRef.createElement('span');
  assert.throws(() => row.insertBefore(send, orphan), /insertBefore reference/, 'a reference outside the parent is a mistake');

  const node = documentRef.createElement('div');
  node.className = 'panel';
  assert.equal(node.classList.toggle('open'), true);
  assert.equal(node.className, 'panel open');
  assert.equal(node.classList.toggle('open'), false);
  assert.equal(node.classList.contains('open'), false);
  node.classList.toggle('open', false);
  assert.equal(node.classList.contains('open'), false, 'a forced-off toggle stays off');
  node.classList.toggle('open', true);
  node.classList.toggle('open', true);
  assert.equal(node.className, 'panel open', 'a forced-on toggle does not repeat the class');

  const input = documentRef.createElement('textarea');
  assert.deepEqual(input.style, {}, 'inline styles start empty');
  input.style.height = '48px';
  assert.equal(input.style.height, '48px');
  assert.equal(input.scrollHeight, 0, 'scroll metrics are readable and default to zero');
  input.select();
  assert.equal(input.selected, true, 'select() is recorded');
}

console.log('dom harness: ok');
