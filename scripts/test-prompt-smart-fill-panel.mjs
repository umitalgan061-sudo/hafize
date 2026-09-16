// Smart Fill as a running dialog, driven through the bundle the browser loads.
//
// Some forty suites assert Smart Fill's source text. This one mounts the
// compiled `public/typed-build/prompt-library-smart-fill.js` — the exact file
// index.html loads — over a fake Prompt Library card and walks the journey the
// user takes: press Kullan, fill the variables, watch the preview, transfer.
//
// The bundle is build output; the check gate regenerates it before the suites
// run, and this suite says so instead of failing cryptically when it is absent.
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';

import { createStorageStub } from './browser-storage-stub.mjs';
import { createPanelWindow, installBrowserGlobals } from './panel-dom-harness.mjs';

const require = createRequire(import.meta.url);

const BUNDLE = new URL('../public/typed-build/prompt-library-smart-fill.js', import.meta.url);
if (!existsSync(BUNDLE)) {
  console.error('prompt smart-fill panel: public/typed-build is missing — run `npm run build` first');
  process.exit(1);
}

const PROMPT_KEY = 'hafize.prompt-library.v1';
const restoreGlobals = installBrowserGlobals();
const storage = createStorageStub();
globalThis.localStorage = storage;
const library = require('../public/prompt-library.js');
globalThis.HafizePromptLibrary = library;

const smartFill = await import(BUNDLE.href);

const prompt = (id, body, title = `İstem ${id}`) => ({
  id,
  title,
  body,
  tags: [],
  favorite: false,
  useCount: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z'
});

/** A card with a prompt list and a composer, the way the library renders it. */
function mountSmartFill(items, { promptResponses = [], confirmResponses = [] } = {}) {
  storage.clear();
  storage.setItem(PROMPT_KEY, JSON.stringify(items));
  const root = createPanelWindow({ storage, promptResponses, confirmResponses });
  const documentRef = root.document;

  const card = documentRef.createElement('section');
  card.id = 'promptLibraryCard';
  const list = documentRef.createElement('div');
  list.id = 'promptLibraryList';
  const useButtons = new Map();
  for (const item of items) {
    const row = documentRef.createElement('article');
    row.className = 'prompt-item';
    row.dataset.promptId = item.id;
    row.setAttribute('data-prompt-id', item.id);
    const actions = documentRef.createElement('div');
    actions.className = 'prompt-item-actions';
    const use = documentRef.createElement('button');
    use.textContent = 'Kullan';
    actions.append(use);
    row.append(actions);
    list.append(row);
    useButtons.set(item.id, use);
  }
  card.append(list);

  const composer = documentRef.createElement('textarea');
  composer.id = 'messageInput';
  composer.value = '';
  const composerEvents = [];
  composer.addEventListener('input', (event) => composerEvents.push(event));

  documentRef.body.append(card, composer);

  const controller = smartFill.mount(documentRef, root);
  const dialog = documentRef.getElementById('promptLibrarySmartFill');
  return {
    root,
    documentRef,
    card,
    composer,
    composerEvents,
    controller,
    dialog,
    useButtons,
    fields: () => dialog.querySelectorAll('.prompt-smart-fill-field input'),
    preview: () => dialog.querySelector('.prompt-smart-fill-preview'),
    errors: () => dialog.querySelector('.prompt-smart-fill-errors').textContent,
    button: (label) => dialog.querySelectorAll('button').find((node) => node.textContent === label)
  };
}

const click = (view, node) => view.documentRef.dispatchEvent({ type: 'click', target: node });
const typeInto = (view, input, value) => {
  input.value = value;
  view.documentRef.dispatchEvent({ type: 'input', target: input });
};

/* Kullan on a prompt with variables opens the dialog instead of pasting -- */

let view = mountSmartFill([prompt('a', 'Merhaba {{ad}}, konu: {{konu}}')]);
assert.ok(view.controller?.mounted);
assert.equal(view.dialog.hidden, true);
assert.equal(view.dialog.getAttribute('role'), 'dialog');
assert.equal(view.dialog.getAttribute('aria-modal'), 'true');
assert.equal(view.dialog.getAttribute('aria-labelledby'), 'promptSmartFillTitle');

click(view, view.useButtons.get('a'));
assert.equal(view.dialog.hidden, false, 'the dialog opened');
assert.equal(view.composer.value, '', 'the composer is untouched until the transfer');
assert.deepEqual(view.fields().map((input) => input.name), ['ad', 'konu'], 'one field per variable');
assert.equal(view.fields()[0].maxLength, 1000);

/* The preview follows what is typed -------------------------------------- */

typeInto(view, view.fields()[0], 'Hafize');
// Every variable is substituted, including the ones still empty: the preview
// shows what would be transferred, not what is left to do.
assert.equal(view.preview().textContent, 'Merhaba Hafize, konu: ');
typeInto(view, view.fields()[1], 'sürüm notları');
assert.equal(view.preview().textContent, 'Merhaba Hafize, konu: sürüm notları');

/* A transfer needs every field; the composer is never half-filled -------- */

typeInto(view, view.fields()[1], '   ');
click(view, view.button('Mesaja aktar'));
assert.match(view.errors(), /Doldurulmamış değişkenler: \{\{konu\}\}/);
assert.equal(view.composer.value, '', 'an incomplete prompt is not transferred');
assert.equal(view.dialog.hidden, false, 'the dialog stays open so the gap can be filled');

typeInto(view, view.fields()[1], 'sürüm notları');
click(view, view.button('Mesaja aktar'));
assert.equal(view.composer.value, 'Merhaba Hafize, konu: sürüm notları');
assert.equal(view.composerEvents.length, 1, 'the composer is notified exactly once');
assert.equal(view.dialog.hidden, true, 'the dialog closes after the transfer');
assert.equal(JSON.parse(storage.getItem(PROMPT_KEY))[0].useCount, 1, 'the use counter moves');
assert.equal(
  view.root.dispatched.filter((event) => event.type === 'storage').length,
  1,
  'the library is told the record changed'
);

/* A prompt without variables is left to the library ---------------------- */

view = mountSmartFill([prompt('plain', 'Değişkeni olmayan istem')]);
click(view, view.useButtons.get('plain'));
assert.equal(view.dialog.hidden, true, 'nothing to fill means nothing to intercept');

/* Escape closes without transferring and returns focus ------------------- */

view = mountSmartFill([prompt('a', 'Merhaba {{ad}}')]);
const opener = view.useButtons.get('a');
opener.focus();
click(view, opener);
assert.equal(view.dialog.hidden, false);
typeInto(view, view.fields()[0], 'Hafize');
view.documentRef.dispatchEvent({ type: 'keydown', target: view.dialog, key: 'Escape' });
assert.equal(view.dialog.hidden, true);
assert.equal(view.composer.value, '', 'Escape transfers nothing');
assert.equal(view.documentRef.activeElement, opener, 'focus returns to the button that opened the dialog');

/* Variable sets round-trip through device storage ------------------------ */

view = mountSmartFill([prompt('a', 'Merhaba {{ad}}')], { promptResponses: ['Standart'] });
click(view, view.useButtons.get('a'));
typeInto(view, view.fields()[0], 'Hafize');
click(view, view.button('Seti kaydet'));

const presetKey = `hafize.prompt-library.smart-fill.v1.a`;
const saved = JSON.parse(storage.getItem(presetKey));
assert.equal(saved.length, 1);
assert.equal(saved[0].name, 'Standart');
assert.deepEqual(saved[0].values, { ad: 'Hafize' });

const select = view.dialog.querySelector('.prompt-smart-fill-preset-select');
assert.deepEqual(select.querySelectorAll('option').map((option) => option.textContent), ['Değişken seti seç…', 'Standart']);

typeInto(view, view.fields()[0], 'başka değer');
select.value = saved[0].id;
view.documentRef.dispatchEvent({ type: 'change', target: select });
assert.equal(view.fields()[0].value, 'Hafize', 'choosing a set restores its values');
assert.equal(view.preview().textContent, 'Merhaba Hafize');

/* Clearing the sets asks first ------------------------------------------- */

view = mountSmartFill([prompt('a', 'Merhaba {{ad}}')], { confirmResponses: [false, true] });
storage.setItem(presetKey, JSON.stringify([{ id: 'p1', name: 'Standart', values: { ad: 'Hafize' } }]));
click(view, view.useButtons.get('a'));
click(view, view.button('Setleri temizle'));
assert.equal(JSON.parse(storage.getItem(presetKey)).length, 1, 'a declined confirmation keeps the sets');
click(view, view.button('Setleri temizle'));
assert.deepEqual(JSON.parse(storage.getItem(presetKey)), [], 'a confirmed clear empties them');

/* Mounting is idempotent and destroy() removes the dialog ---------------- */

assert.equal(smartFill.mount(view.documentRef, view.root), null, 'the card is only decorated once');
view.controller.destroy();
assert.equal(view.documentRef.getElementById('promptLibrarySmartFill'), null);

restoreGlobals();
console.log('prompt smart-fill panel: ok');
