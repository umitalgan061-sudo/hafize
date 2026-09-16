// The `/prompt` command palette, driven through the bundle the browser loads.
//
// `searchPromptLibrary` is unit tested; the surface around it — noticing the
// trigger in the composer, replacing exactly the typed command, keyboard
// selection and the handoff to Smart Fill — was only ever asserted as source
// text. This suite mounts `public/typed-build/prompt-library-command-palette.js`
// over a composer and types into it.
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';

import { createStorageStub } from './browser-storage-stub.mjs';
import { createPanelWindow, installBrowserGlobals } from './panel-dom-harness.mjs';

const require = createRequire(import.meta.url);

const BUNDLE = new URL('../public/typed-build/prompt-library-command-palette.js', import.meta.url);
if (!existsSync(BUNDLE)) {
  console.error('prompt command palette panel: public/typed-build is missing — run `npm run build` first');
  process.exit(1);
}

const PROMPT_KEY = 'hafize.prompt-library.v1';
const restoreGlobals = installBrowserGlobals();
const storage = createStorageStub();
globalThis.localStorage = storage;
const library = require('../public/prompt-library.js');
globalThis.HafizePromptLibrary = library;

// The bundle exports its pure search helper and installs the mount entry on
// the window, exactly as the page consumes it.
const paletteModule = await import(BUNDLE.href);
const palette = globalThis.PromptLibraryCommandPalette;
assert.equal(typeof paletteModule.searchPromptLibrary, 'function');
assert.equal(typeof palette?.mount, 'function');

const prompt = (id, title, body, extra = {}) => ({
  id,
  title,
  body,
  tags: [],
  favorite: false,
  useCount: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: `2026-01-0${(Number(id.at(-1)) % 9) + 1}T00:00:00.000Z`,
  ...extra
});

function mountPalette(items, { smartFill = null } = {}) {
  storage.clear();
  storage.setItem(PROMPT_KEY, JSON.stringify(items));
  const root = createPanelWindow({ storage });
  if (smartFill) root.HafizePromptLibrarySmartFill = smartFill;
  const documentRef = root.document;

  const composer = documentRef.createElement('textarea');
  composer.id = 'messageInput';
  composer.value = '';
  composer.selectionStart = 0;
  documentRef.body.append(composer);

  const controller = palette.mount(documentRef, root);
  const node = documentRef.getElementById('promptLibraryCommandPalette');
  const typeInComposer = (value) => {
    composer.value = value;
    composer.selectionStart = value.length;
    documentRef.dispatchEvent({ type: 'input', target: composer });
  };
  return {
    root,
    documentRef,
    composer,
    controller,
    node,
    typeInComposer,
    options: () => node.querySelectorAll('.prompt-command-palette-item'),
    names: () => node.querySelectorAll('.prompt-command-palette-name').map((item) => item.textContent),
    status: () => node.querySelector('.prompt-command-palette-status').textContent,
    query: () => node.querySelector('input')
  };
}

const key = (view, target, keyName, extra = {}) => view.documentRef.dispatchEvent({ type: 'keydown', target, key: keyName, ...extra });

const items = [
  prompt('a1', 'Asistan', 'Asistan gövdesi'),
  prompt('a2', 'Asistan planı', 'Plan gövdesi'),
  prompt('b1', 'Rapor', 'Rapor gövdesi')
];

/* Typing `/prompt` in the composer opens the palette --------------------- */

let view = mountPalette(items);
assert.ok(view.controller?.mounted);
assert.equal(view.node.hidden, true);
assert.equal(view.node.getAttribute('role'), 'dialog');
assert.equal(view.node.getAttribute('aria-modal'), 'false', 'the composer stays reachable behind it');
assert.equal(view.node.querySelector('.prompt-command-palette-list').getAttribute('role'), 'listbox');

view.typeInComposer('/prompt');
assert.equal(view.node.hidden, false, 'the trigger opened the palette');
// The bare trigger lists nothing: the ranking needs a query, so the palette
// waits for one instead of guessing an order.
assert.deepEqual(view.names(), []);

/* The query after the trigger filters the list --------------------------- */

view.typeInComposer('/prompt asistan');
assert.deepEqual(view.names(), ['Asistan', 'Asistan planı']);
assert.equal(view.status(), '2 istem bulundu.');
assert.equal(view.options()[0].getAttribute('aria-selected'), 'true');
assert.equal(view.query().value, 'asistan', 'the typed query is carried into the palette input');

view.typeInComposer('/prompt rapor');
assert.deepEqual(view.names(), ['Rapor']);

view.typeInComposer('/prompt kayıp');
assert.deepEqual(view.names(), []);
assert.equal(view.status(), 'Eşleşen istem bulunamadı.');

/* Removing the trigger closes it ----------------------------------------- */

view.typeInComposer('sadece metin');
assert.equal(view.node.hidden, true);

/* Arrow keys move the selection, Enter inserts the body ------------------ */

view = mountPalette(items);
view.typeInComposer('/prompt asistan');
assert.deepEqual(view.names(), ['Asistan', 'Asistan planı']);
key(view, view.composer, 'ArrowDown');
assert.equal(view.options()[1].getAttribute('aria-selected'), 'true');
key(view, view.composer, 'ArrowUp');
assert.equal(view.options()[0].getAttribute('aria-selected'), 'true');

key(view, view.composer, 'Enter');
assert.equal(view.composer.value, 'Asistan gövdesi', 'the command is replaced by the prompt body');
assert.equal(view.node.hidden, true, 'the palette closes after inserting');
const inserted = view.root.dispatched.filter((event) => event.type === 'hafize:prompt-command-inserted');
assert.equal(inserted.length, 1);
assert.equal(inserted[0].detail.id, 'a1');

/* Only the typed command is replaced, not what came before it ------------ */

view = mountPalette(items);
view.typeInComposer('Merhaba, /prompt rapor');
assert.deepEqual(view.names(), ['Rapor']);
key(view, view.composer, 'Enter');
assert.equal(view.composer.value, 'Merhaba, Rapor gövdesi');

/* Escape closes without touching the composer ---------------------------- */

view = mountPalette(items);
view.typeInComposer('/prompt rapor');
key(view, view.node, 'Escape');
assert.equal(view.node.hidden, true);
assert.equal(view.composer.value, '/prompt rapor', 'Escape leaves what was typed alone');

/* A prompt with variables is handed to Smart Fill instead of pasted ------ */

const opened = [];
view = mountPalette(
  [prompt('v1', 'Değişkenli', 'Merhaba {{ad}}')],
  { smartFill: { open: (item) => opened.push(item.id) } }
);
view.typeInComposer('/prompt değişkenli');
key(view, view.composer, 'Enter');
assert.deepEqual(opened, ['v1'], 'Smart Fill takes over so the variables get filled');
assert.equal(view.composer.value, '/prompt değişkenli', 'the raw body is not pasted behind the dialog');
assert.equal(view.node.hidden, true);

/* An empty library says so rather than looking broken -------------------- */

view = mountPalette([]);
view.typeInComposer('/prompt');
assert.equal(view.status(), 'Kütüphanede istem yok.');

/* Ctrl+Shift+O toggles the palette from anywhere ------------------------- */

view = mountPalette(items);
view.root.dispatchEvent({ type: 'keydown', key: 'O', ctrlKey: true, shiftKey: true, preventDefault() {} });
assert.equal(view.node.hidden, false);
view.root.dispatchEvent({ type: 'keydown', key: 'O', ctrlKey: true, shiftKey: true, preventDefault() {} });
assert.equal(view.node.hidden, true);

/* destroy() takes the palette and its listeners back out ----------------- */

view.controller.destroy();
assert.equal(view.documentRef.getElementById('promptLibraryCommandPalette'), null);
view.typeInComposer('/prompt rapor');
assert.equal(view.documentRef.getElementById('promptLibraryCommandPalette'), null, 'a destroyed palette does not come back');

restoreGlobals();
console.log('prompt command palette panel: ok');
