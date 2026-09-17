// Mounts the real import preview in the DOM harness. The source-contract suite
// checks that the dialog attributes are spelled somewhere in the file; this one
// checks that choosing a file actually builds that dialog, that the core
// library's own import never runs, and that nothing is written until the user
// confirms.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createStorageStub } from './browser-storage-stub.mjs';
import { createFile, createFileReader, createWindow } from './dom-harness.mjs';

const require = createRequire(import.meta.url);
const modulePath = require.resolve('../public/prompt-library-import-preview.js');

const prompt = (id, title = `Başlık ${id}`) => ({
  id,
  title,
  body: `gövde ${id}`,
  tags: [],
  favorite: false,
  useCount: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z'
});

/** A card carrying the file input and status node the core library builds. */
function buildCard(root) {
  const documentRef = root.document;
  const card = documentRef.createElement('section');
  card.id = 'promptLibraryCard';
  const input = documentRef.createElement('input');
  input.type = 'file';
  input.setAttribute('type', 'file');
  const status = documentRef.createElement('div');
  status.className = 'prompt-library-status';
  card.append(input, status);
  documentRef.body.append(card);
  return { card, input, status };
}

function setUp({ file, storage = createStorageStub(), confirmAnswer = true } = {}) {
  const root = createWindow({ storage, confirmAnswer });
  const parts = buildCard(root);
  root.FileReader = createFileReader(file ?? '[]');
  globalThis.localStorage = storage;
  const library = require('../public/prompt-library.js');
  globalThis.HafizePromptLibrary = library;
  delete require.cache[modulePath];
  const preview = require(modulePath);
  const controller = preview.mount(root.document, root);
  assert.ok(controller?.mounted, 'the preview mounts onto the card');
  return { root, storage, library, preview, controller, ...parts };
}

/* The preview replaces the core import path ---------------------------- */

{
  const { root, storage, library, input, card } = setUp({
    file: JSON.stringify([prompt('b'), prompt('c')])
  });
  storage.setItem(library.STORAGE_KEY, JSON.stringify([prompt('a')]));

  let coreImportRan = false;
  input.addEventListener('change', () => { coreImportRan = true; });
  input.files = [createFile('[]')];
  input.dispatchEvent(new root.Event('change'));

  assert.equal(coreImportRan, false, 'the core library import never runs while the preview owns the flow');
  assert.equal(input.value, '', 'the input is reset so the same file can be chosen again');

  const dialog = root.document.getElementById('promptLibraryImportPreview');
  assert.ok(dialog, 'choosing a file opens the dialog');
  assert.equal(dialog.getAttribute('role'), 'dialog');
  assert.equal(dialog.getAttribute('aria-modal'), 'true');
  assert.equal(dialog.getAttribute('aria-labelledby'), 'promptLibraryImportPreviewTitle');
  assert.ok(root.document.getElementById('promptLibraryImportPreviewTitle'), 'the label it points at exists');

  const stats = dialog.querySelectorAll('.prompt-library-import-stat');
  assert.equal(stats.length, 5, 'the summary has one tile per reported number');
  assert.deepEqual(stats.map((tile) => tile.querySelector('strong').textContent), ['2', '2', '2', '0', '0']);

  const names = dialog.querySelectorAll('.prompt-library-import-preview-name');
  assert.deepEqual(names.map((node) => node.textContent), ['Başlık b', 'Başlık c'], 'sample titles are listed');
  // The title is a text node, so markup in a backup is shown, not interpreted.
  assert.equal(names[0].childNodes.every((node) => node.nodeType === 3), true);

  assert.deepEqual(
    JSON.parse(storage.getItem(library.STORAGE_KEY)).map((item) => item.id),
    ['a'],
    'opening the preview writes nothing'
  );

  const confirmButton = dialog.querySelectorAll('button').find((node) => node.textContent === 'İçe aktar');
  assert.equal(confirmButton.disabled, false, 'there is something to import, so the action is live');
  confirmButton.dispatchEvent(new root.Event('click'));

  assert.deepEqual(
    JSON.parse(storage.getItem(library.STORAGE_KEY)).map((item) => item.id),
    ['a', 'b', 'c'],
    'confirming writes the merged library'
  );
  assert.equal(root.document.getElementById('promptLibraryImportPreview'), null, 'and closes the dialog');
  assert.ok(card.dataset.importPreviewReady, 'the card stays marked so a second mount is a no-op');
}

/* Cancelling and Escape leave the library alone ------------------------ */

for (const dismiss of ['Vazgeç', 'escape']) {
  const { root, storage, library, input } = setUp({ file: JSON.stringify([prompt('b')]) });
  storage.setItem(library.STORAGE_KEY, JSON.stringify([prompt('a')]));
  input.files = [createFile('x')];
  input.dispatchEvent(new root.Event('change'));

  const dialog = root.document.getElementById('promptLibraryImportPreview');
  assert.ok(dialog, `dialog is open before ${dismiss}`);
  if (dismiss === 'escape') dialog.dispatchEvent(new root.Event('keydown', { key: 'Escape' }));
  else dialog.querySelectorAll('button').find((node) => node.textContent === 'Vazgeç').dispatchEvent(new root.Event('click'));

  assert.equal(root.document.getElementById('promptLibraryImportPreview'), null, `${dismiss} closes the dialog`);
  assert.deepEqual(
    JSON.parse(storage.getItem(library.STORAGE_KEY)).map((item) => item.id),
    ['a'],
    `${dismiss} writes nothing`
  );
}

/* An empty backup cannot be confirmed ---------------------------------- */

{
  const { root, input } = setUp({ file: '[]' });
  input.files = [createFile('[]')];
  input.dispatchEvent(new root.Event('change'));
  const dialog = root.document.getElementById('promptLibraryImportPreview');
  const confirmButton = dialog.querySelectorAll('button').find((node) => node.textContent === 'İçe aktar');
  assert.equal(confirmButton.disabled, true, 'nothing to import means nothing to confirm');
  assert.ok(dialog.querySelector('.prompt-library-import-preview-empty'), 'and the list says so');
}

/* Bad input never reaches the dialog ----------------------------------- */

{
  const { root, storage, library, input, status } = setUp({ file: '{not json' });
  storage.setItem(library.STORAGE_KEY, JSON.stringify([prompt('a')]));
  input.files = [createFile('{not json')];
  input.dispatchEvent(new root.Event('change'));
  assert.equal(root.document.getElementById('promptLibraryImportPreview'), null, 'invalid JSON opens no dialog');
  assert.match(status.textContent, /Geçersiz istem yedeği/);
  assert.deepEqual(JSON.parse(storage.getItem(library.STORAGE_KEY)).map((item) => item.id), ['a']);
}

{
  const { root, preview, input, status } = setUp({ file: '[]' });
  input.files = [{ size: preview.MAX_FILE + 1, name: 'huge.json' }];
  input.dispatchEvent(new root.Event('change'));
  assert.equal(root.document.getElementById('promptLibraryImportPreview'), null, 'an oversized file opens no dialog');
  assert.match(status.textContent, /1 MB/);
}

{
  const { root, input, status } = setUp({ file: '[]' });
  root.FileReader = createFileReader('', { fail: true });
  input.files = [createFile('[]')];
  input.dispatchEvent(new root.Event('change'));
  assert.equal(root.document.getElementById('promptLibraryImportPreview'), null, 'a read failure opens no dialog');
  assert.match(status.textContent, /okunamadı/);
}

/* Other controls in the card are untouched ----------------------------- */

{
  const { root, card } = setUp({ file: '[]' });
  const select = root.document.createElement('select');
  card.append(select);
  let sawChange = false;
  select.addEventListener('change', () => { sawChange = true; });
  select.dispatchEvent(new root.Event('change'));
  assert.equal(sawChange, true, 'the capture listener only intercepts the file input');
  assert.equal(root.document.getElementById('promptLibraryImportPreview'), null);
}

console.log('prompt library import preview DOM: ok');
