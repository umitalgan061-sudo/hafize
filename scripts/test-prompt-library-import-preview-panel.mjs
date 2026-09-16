// The import preview as a running dialog.
//
// The feature rests on one thing: the preview must take the file selection
// before the Prompt Library's own `change` handler imports it. That is asserted
// here against a stand-in handler wired exactly like the library's, plus the
// QA scenarios that decide whether anything is written at all.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

import { createStorageStub } from './browser-storage-stub.mjs';
import { createFile, createFileInput, createFileReaderClass, createPanelWindow } from './panel-dom-harness.mjs';

const require = createRequire(import.meta.url);

const PROMPT_KEY = 'hafize.prompt-library.v1';

const storage = createStorageStub();
globalThis.localStorage = storage;
const library = require('../public/prompt-library.js');
globalThis.HafizePromptLibrary = library;
const importPreview = require('../public/prompt-library-import-preview.js');

const prompt = (id, title = `İstem ${id}`) => ({
  id,
  title,
  body: `${title} gövdesi`,
  tags: [],
  favorite: false,
  useCount: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z'
});

/**
 * Mounts the preview over a card that also carries the library's own direct
 * import handler, so an interception failure shows up as a real import.
 */
function mountPreview({ existing = [], readerFails = false } = {}) {
  storage.clear();
  storage.setItem(PROMPT_KEY, JSON.stringify(existing));
  const root = createPanelWindow({ storage });
  root.FileReader = createFileReaderClass({ fail: readerFails });

  const card = root.document.createElement('section');
  card.id = 'promptLibraryCard';
  root.document.body.append(card);
  const input = createFileInput(root.document);
  card.append(input);

  // The library's own handler: this is what must not run.
  const directImports = [];
  input.addEventListener('change', () => { directImports.push(input.files?.[0] ?? null); });

  const controller = importPreview.mount(root.document, root);
  const overlay = root.document.getElementById('promptLibraryImportPreview');
  const select = (file) => {
    input.files = file ? [file] : [];
    input.value = file ? 'C:/fake/backup.json' : '';
    root.document.dispatchEvent({ type: 'change', target: input });
  };
  const buttonLabelled = (label) => overlay.querySelectorAll('button').find((node) => node.textContent === label);
  return { root, card, input, controller, overlay, select, directImports, buttonLabelled };
}

const click = (root, node) => root.document.dispatchEvent({ type: 'click', target: node });
const keydown = (root, node, key, extra = {}) => root.document.dispatchEvent({ type: 'keydown', target: node, key, ...extra });

/* The preview takes the file; the direct import never sees it ----------- */

let view = mountPreview({ existing: [prompt('a')] });
assert.ok(view.controller?.mounted);
assert.equal(view.overlay.hidden, true, 'the dialog starts closed');
assert.equal(view.overlay.getAttribute('role'), 'dialog');
assert.equal(view.overlay.getAttribute('aria-modal'), 'true');

view.select(createFile(JSON.stringify([prompt('b'), prompt('c')])));
assert.deepEqual(view.directImports, [], 'the library never received the change event');
assert.equal(view.overlay.hidden, false, 'the preview opened instead');
assert.equal(view.input.value, '', 'the input is reset so the same file can be picked again');
assert.deepEqual(JSON.parse(storage.getItem(PROMPT_KEY)).map((item) => item.id), ['a'], 'nothing is written yet');

/* The summary counts what the user is about to accept ------------------- */

let stats = view.overlay.querySelectorAll('.prompt-library-import-stat');
assert.deepEqual(stats.map((node) => node.querySelector('strong').textContent), ['2', '2', '0', '2', '0']);
assert.deepEqual(stats.map((node) => node.querySelector('span').textContent), ['Dosyada', 'Geçerli', 'Bozuk', 'Aktarılacak', 'Kapasite dışı']);
assert.deepEqual(
  view.overlay.querySelectorAll('.prompt-library-import-preview-name').map((node) => node.textContent),
  ['İstem b', 'İstem c'],
  'sample titles are rendered as text'
);

/* Confirming writes once and tells the library to repaint --------------- */

const confirmButton = view.buttonLabelled('İçe aktar');
assert.equal(confirmButton.disabled, false);
click(view.root, confirmButton);
assert.deepEqual(JSON.parse(storage.getItem(PROMPT_KEY)).map((item) => item.id), ['a', 'b', 'c']);
assert.equal(view.overlay.hidden, true, 'the dialog closes once the import lands');
const storageEvents = view.root.dispatched.filter((event) => event.type === 'storage');
assert.equal(storageEvents.length, 1);
assert.equal(storageEvents[0].key, library.STORAGE_KEY);

/* Cancelling and Escape write nothing ----------------------------------- */

for (const dismiss of ['Vazgeç', 'Kapat']) {
  view = mountPreview({ existing: [prompt('a')] });
  view.select(createFile(JSON.stringify([prompt('b')])));
  click(view.root, view.buttonLabelled(dismiss));
  assert.equal(view.overlay.hidden, true, `${dismiss} closes the dialog`);
  assert.deepEqual(JSON.parse(storage.getItem(PROMPT_KEY)).map((item) => item.id), ['a'], `${dismiss} writes nothing`);
}

view = mountPreview({ existing: [prompt('a')] });
view.select(createFile(JSON.stringify([prompt('b')])));
keydown(view.root, view.overlay, 'Escape');
assert.equal(view.overlay.hidden, true);
assert.deepEqual(JSON.parse(storage.getItem(PROMPT_KEY)).map((item) => item.id), ['a']);

/* Tab cycles inside the dialog ------------------------------------------ */

view = mountPreview({ existing: [] });
view.select(createFile(JSON.stringify([prompt('b')])));
const focusables = view.overlay.querySelectorAll('button').filter((node) => !node.disabled);
const first = focusables[0];
const last = focusables[focusables.length - 1];
last.focus();
keydown(view.root, view.overlay, 'Tab');
assert.equal(view.root.document.activeElement, first, 'Tab wraps from the last control to the first');
keydown(view.root, view.overlay, 'Tab', { shiftKey: true });
assert.equal(view.root.document.activeElement, last, 'Shift+Tab wraps back');

/* An empty backup opens the dialog with the import disabled ------------- */

view = mountPreview({ existing: [prompt('a')] });
view.select(createFile('[]'));
assert.equal(view.overlay.hidden, false);
assert.equal(view.buttonLabelled('İçe aktar').disabled, true);
assert.equal(view.overlay.querySelector('.prompt-library-import-preview-empty').textContent, 'Aktarılabilecek istem yok.');
click(view.root, view.buttonLabelled('İçe aktar'));
assert.deepEqual(JSON.parse(storage.getItem(PROMPT_KEY)).map((item) => item.id), ['a'], 'a disabled confirm cannot write');

/* Invalid JSON, oversized files and read failures keep the library ------ */

view = mountPreview({ existing: [prompt('a')] });
view.select(createFile('{bozuk'));
assert.match(view.overlay.querySelector('.prompt-library-import-preview-feedback').textContent, /Geçersiz istem yedeği\..*Kütüphane değişmedi\./);
assert.equal(view.buttonLabelled('İçe aktar').disabled, true);
assert.deepEqual(JSON.parse(storage.getItem(PROMPT_KEY)).map((item) => item.id), ['a']);

view = mountPreview({ existing: [prompt('a')] });
view.select(createFile('[]', { size: importPreview.MAX_FILE + 1 }));
assert.match(view.overlay.querySelector('.prompt-library-import-preview-feedback').textContent, /1 MB sınırını aşamaz/);
assert.deepEqual(JSON.parse(storage.getItem(PROMPT_KEY)).map((item) => item.id), ['a']);

view = mountPreview({ existing: [prompt('a')], readerFails: true });
view.select(createFile(JSON.stringify([prompt('b')])));
assert.match(view.overlay.querySelector('.prompt-library-import-preview-feedback').textContent, /okunamadı/);
assert.deepEqual(JSON.parse(storage.getItem(PROMPT_KEY)).map((item) => item.id), ['a']);

/* A full library shows what capacity will reject ------------------------ */

view = mountPreview({ existing: Array.from({ length: library.LIMITS.maxItems }, (_, index) => prompt(`id-${index}`)) });
view.select(createFile(JSON.stringify([prompt('new')])));
stats = view.overlay.querySelectorAll('.prompt-library-import-stat');
assert.deepEqual(stats.map((node) => node.querySelector('strong').textContent), ['1', '1', '0', '0', '1']);
assert.equal(view.buttonLabelled('İçe aktar').disabled, true);
assert.match(view.overlay.querySelector('.prompt-library-import-preview-note').textContent, /kapasite sınırı/);

/* Tearing down releases the interception -------------------------------- */

view = mountPreview({ existing: [] });
view.controller.destroy();
assert.equal(view.root.document.getElementById('promptLibraryImportPreview'), null);
view.select(createFile(JSON.stringify([prompt('b')])));
assert.equal(view.directImports.length, 1, 'after destroy the library handles its own imports again');

console.log('prompt import preview panel: ok');
