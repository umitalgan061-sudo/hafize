// The import preview, exercised through the panel it actually mounts.
//
// The module is mounted on a stand-in library card, the hidden file input is
// changed the way the browser changes it, and the dialog is driven with real
// click and key events. Nothing here looks at the source text.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createStorageStub } from './browser-storage-stub.mjs';
import { change, click, createDocument, createWindow, keydown } from './dom-harness.mjs';

const require = createRequire(import.meta.url);

const storage = createStorageStub();
globalThis.localStorage = storage;
const library = require('../public/prompt-library.js');
globalThis.HafizePromptLibrary = library;
const preview = require('../public/prompt-library-import-preview.js');

const PROMPT_KEY = library.STORAGE_KEY;

const prompt = (id, title = `İstem ${id}`) => ({
  id,
  title,
  body: 'gövde',
  tags: [],
  favorite: false,
  useCount: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z'
});

/** A `File` with just the surface the panel reads, plus a readable body. */
function file(contents, { size } = {}) {
  const body = typeof contents === 'string' ? contents : JSON.stringify(contents);
  return { name: 'yedek.json', size: size ?? body.length, body };
}

function createReaderClass(failures = new Set()) {
  return class FileReader {
    readAsText(fileObject) {
      if (failures.has('read')) {
        this.onerror?.(new Error('read failed'));
        return;
      }
      this.result = fileObject.body;
      this.onload?.();
    }
  };
}

function setup({ current = [], failures } = {}) {
  storage.clear();
  if (current.length) storage.setItem(PROMPT_KEY, JSON.stringify(library.normalizeCollection(current)));
  const documentRef = createDocument();
  const card = documentRef.createElement('section');
  card.id = 'promptLibraryCard';
  documentRef.body.append(card);
  const input = documentRef.createElement('input');
  input.setAttribute('type', 'file');
  input.type = 'file';
  card.append(input);
  const importButton = documentRef.createElement('button');
  importButton.textContent = 'İçe aktar';
  card.append(importButton);
  const storageEvents = [];
  const root = createWindow(documentRef, { FileReader: createReaderClass(failures ?? new Set()) });
  root.addEventListener('storage', (event) => storageEvents.push(event));
  const controller = preview.mount(documentRef, root);
  assert.ok(controller?.mounted, 'the preview mounts on the library card');
  const dialog = documentRef.getElementById('promptLibraryImportPreview');
  const buttons = () => dialog.querySelectorAll('button');
  const labelled = (label) => buttons().find((node) => node.textContent === label);
  return {
    documentRef,
    root,
    card,
    input,
    dialog,
    controller,
    storageEvents,
    buttons,
    confirm: () => labelled('Aktar'),
    cancel: () => labelled('Vazgeç'),
    close: () => labelled('Kapat'),
    feedback: () => dialog.querySelector('.prompt-library-import-preview-feedback').textContent,
    stats: () => dialog.querySelectorAll('.prompt-library-import-stat').map((tile) => tile.textContent),
    names: () => dialog.querySelectorAll('.prompt-library-import-preview-name').map((node) => node.textContent),
    choose(fileObject) {
      this.input.files = [fileObject];
      return change(this.input);
    }
  };
}

/* The panel starts hidden and is opened by choosing a file ----------------- */

{
  const ui = setup();
  assert.equal(ui.dialog.hidden, true, 'the dialog starts hidden');
  assert.equal(ui.dialog.getAttribute('role'), 'dialog');
  assert.equal(ui.dialog.getAttribute('aria-modal'), 'true');
  assert.equal(ui.dialog.getAttribute('aria-labelledby'), 'promptLibraryImportPreviewTitle');
  ui.choose(file({ items: [prompt('a'), prompt('b')] }));
  assert.equal(ui.dialog.hidden, false, 'choosing a file opens the preview');
  assert.deepEqual(storage.snapshot(), {}, 'opening the preview writes nothing');
}

/* The library card never sees the change it would have imported ------------ */

{
  const ui = setup();
  let libraryHandled = false;
  ui.input.addEventListener('change', () => { libraryHandled = true; });
  ui.choose(file({ items: [prompt('a')] }));
  assert.equal(libraryHandled, false, 'the original import handler is stopped before it runs');
}

/* The summary reports the merge, and confirming performs it ---------------- */

{
  const ui = setup({ current: [prompt('same', 'Mevcut kayıt')] });
  ui.choose(file({ items: [prompt('same', 'Yedekten gelen'), prompt('yeni'), { id: 'bozuk', title: '' }] }));
  const stats = ui.stats();
  assert.equal(stats.length, 5, 'five numbers describe the merge');
  assert.ok(stats.some((tile) => tile.startsWith('3') && tile.includes('Dosyada')), `file count is shown: ${stats.join(' | ')}`);
  assert.ok(stats.some((tile) => tile.startsWith('1') && tile.includes('Atlanan')), 'the unreadable record is reported');
  assert.ok(stats.some((tile) => tile.startsWith('1') && tile.includes('Yeni id')), 'the colliding id is reported');
  assert.deepEqual(ui.names(), ['Yedekten gelen', 'İstem yeni'], 'sample titles are listed as text');
  assert.equal(ui.confirm().disabled, false, 'there is something to import');

  click(ui.confirm());
  const stored = JSON.parse(storage.getItem(PROMPT_KEY));
  assert.equal(stored.length, 3, 'the merge is written once confirmed');
  assert.equal(stored.find((item) => item.id === 'same').title, 'Mevcut kayıt', 'the existing prompt is untouched');
  assert.equal(ui.storageEvents.length, 1, 'the library card is told to repaint');
  assert.equal(ui.storageEvents[0].key, PROMPT_KEY);
  assert.equal(ui.dialog.hidden, true, 'the dialog closes after importing');
  assert.equal(ui.input.value, '', 'the file input is reset, so the same file can be chosen again');
}

/* Cancelling and Escape write nothing -------------------------------------- */

for (const dismiss of ['cancel', 'close', 'escape']) {
  const ui = setup({ current: [prompt('a')] });
  const before = storage.snapshot();
  ui.choose(file({ items: [prompt('b')] }));
  if (dismiss === 'escape') keydown(ui.dialog, 'Escape');
  else click(ui[dismiss]());
  assert.equal(ui.dialog.hidden, true, `${dismiss} closes the dialog`);
  assert.deepEqual(storage.snapshot(), before, `${dismiss} writes nothing`);
  assert.equal(ui.storageEvents.length, 0, `${dismiss} does not announce a change`);
}

/* An empty or fully redundant file cannot be confirmed --------------------- */

{
  const ui = setup();
  ui.choose(file({ items: [] }));
  assert.equal(ui.confirm().disabled, true, 'nothing to import keeps the confirm button disabled');
  assert.match(ui.feedback(), /aktarılacak yeni istem yok/i);
  assert.equal(ui.dialog.querySelectorAll('.prompt-library-import-preview-empty').length, 1, 'the empty state is shown');
}

/* Hostile input is text, and broken input leaves the library alone ---------- */

{
  const ui = setup();
  ui.choose(file({ items: [prompt('a', '<img src=x onerror=alert(1)>')] }));
  const [name] = ui.names();
  assert.equal(name, '<img src=x onerror=alert(1)>', 'the title is a text node, not markup');
  assert.equal(ui.dialog.querySelectorAll('img').length, 0, 'no element is created from the title');
}

{
  const ui = setup({ current: [prompt('a')] });
  const before = storage.snapshot();
  ui.choose(file('bu json değil'));
  assert.equal(ui.dialog.hidden, false, 'the failure is reported in the dialog');
  assert.equal(ui.confirm().disabled, true);
  assert.match(ui.feedback(), /Geçersiz istem yedeği/);
  assert.deepEqual(storage.snapshot(), before, 'the existing library survives a broken file');
}

{
  const ui = setup({ current: [prompt('a')] });
  const before = storage.snapshot();
  ui.choose(file({ items: [prompt('b')] }, { size: preview.MAX_FILE + 1 }));
  assert.match(ui.feedback(), /1 MB/, 'an oversized file is refused with the limit named');
  assert.equal(ui.confirm().disabled, true);
  assert.deepEqual(storage.snapshot(), before);
}

{
  const ui = setup({ current: [prompt('a')], failures: new Set(['read']) });
  const before = storage.snapshot();
  ui.choose(file({ items: [prompt('b')] }));
  assert.match(ui.feedback(), /okunamadı/, 'a read failure is reported');
  assert.equal(ui.confirm().disabled, true);
  assert.deepEqual(storage.snapshot(), before);
}

/* Focus is trapped while the dialog is open, and handed back on close ------- */

{
  const ui = setup();
  const opener = ui.documentRef.querySelector('#promptLibraryCard button');
  opener.focus();
  ui.choose(file({ items: [prompt('a')] }));
  const focusable = ui.buttons().filter((node) => !node.disabled && !node.hidden);
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  last.focus();
  keydown(ui.dialog, 'Tab');
  assert.equal(ui.documentRef.activeElement, first, 'Tab wraps from the last control to the first');
  keydown(ui.dialog, 'Tab', { shiftKey: true });
  assert.equal(ui.documentRef.activeElement, last, 'Shift+Tab wraps back');
  keydown(ui.dialog, 'Escape');
  assert.equal(ui.documentRef.activeElement, opener, 'focus returns to whatever opened the dialog');
}

/* A second mount does not stack two dialogs on the card -------------------- */

{
  const ui = setup();
  assert.equal(preview.mount(ui.documentRef, ui.root), null, 'mounting twice is a no-op');
  ui.controller.destroy();
  assert.equal(ui.documentRef.getElementById('promptLibraryImportPreview'), null, 'destroy removes the dialog');
  ui.input.files = [file({ items: [prompt('a')] })];
  change(ui.input);
  assert.equal(ui.documentRef.getElementById('promptLibraryImportPreview'), null, 'the change listener is gone too');
}

console.log('prompt library import preview UI: ok');
