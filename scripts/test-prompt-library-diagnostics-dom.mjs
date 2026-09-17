// Mounts the real health panel in the DOM harness. The runtime suite covers the
// inspection; this one covers the part a user touches: what the panel renders,
// that the repair is off while the library is healthy, and that it never writes
// without a confirmation.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createStorageStub } from './browser-storage-stub.mjs';
import { createWindow } from './dom-harness.mjs';

const require = createRequire(import.meta.url);
const modulePath = require.resolve('../public/prompt-library-diagnostics.js');

const prompt = (id) => ({
  id,
  title: `Başlık ${id}`,
  body: `gövde ${id}`,
  tags: [],
  favorite: false,
  useCount: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z'
});

const collection = (promptIds) => ({
  id: 'c1',
  name: 'Koleksiyon',
  description: '',
  color: 'default',
  promptIds,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z'
});

function setUp({ items = [], collections = [], confirmAnswer = true } = {}) {
  const storage = createStorageStub();
  const root = createWindow({ storage, confirmAnswer });
  const card = root.document.createElement('section');
  card.id = 'promptLibraryCard';
  root.document.body.append(card);

  globalThis.localStorage = storage;
  const library = require('../public/prompt-library.js');
  globalThis.HafizePromptLibrary = library;
  const collectionApi = require('../public/prompt-library-collections.js') ?? globalThis.HafizePromptLibraryCollections;
  globalThis.HafizePromptLibraryCollections = globalThis.HafizePromptLibraryCollections ?? collectionApi;

  storage.setItem(library.STORAGE_KEY, JSON.stringify(items));
  storage.setItem(globalThis.HafizePromptLibraryCollections.STORAGE_KEY, JSON.stringify(collections));

  delete require.cache[modulePath];
  const diagnostics = require(modulePath);
  const controller = diagnostics.mount(root.document, root);
  assert.ok(controller?.mounted, 'the panel mounts onto the card');
  return { root, storage, library, diagnostics, controller, card };
}

const panelOf = (root) => root.document.getElementById('promptLibraryDiagnostics');
const rowsOf = (panel) => panel.querySelectorAll('.prompt-library-diagnostics-row')
  .map((row) => [row.querySelector('span').textContent, row.querySelector('strong').textContent]);
const repairButton = (panel) => panel.querySelector('[data-diagnostics-repair]');
const statusOf = (panel) => panel.querySelector('.prompt-library-diagnostics-status').textContent;

/* A healthy library reports so and offers no repair -------------------- */

{
  const { root } = setUp({ items: [prompt('a'), prompt('b')], collections: [collection(['a'])] });
  const panel = panelOf(root);
  assert.ok(panel, 'the panel is in the card');
  assert.equal(panel.getAttribute('aria-labelledby'), 'promptLibraryDiagnosticsTitle');
  assert.ok(root.document.getElementById('promptLibraryDiagnosticsTitle'), 'the label it points at exists');

  assert.deepEqual(rowsOf(panel), [
    ['Ham kayıt', '2'],
    ['Normalize edilebilen', '2'],
    ['Bozuk kayıt', '0'],
    ['Yinelenen id', '0'],
    ['Koleksiyon', '1'],
    ['Yetim koleksiyon üyesi', '0']
  ]);
  assert.equal(repairButton(panel).disabled, true, 'a healthy library has nothing to repair');
  assert.match(statusOf(panel), /sağlıklı/);
}

/* Damage is counted, and the repair asks first ------------------------- */

{
  const { root, storage, library } = setUp({
    items: [prompt('a'), prompt('a'), { id: 'no-body' }, prompt('d')],
    collections: [collection(['a', 'gone'])],
    confirmAnswer: false
  });
  const panel = panelOf(root);
  assert.deepEqual(rowsOf(panel), [
    ['Ham kayıt', '4'],
    ['Normalize edilebilen', '3'],
    ['Bozuk kayıt', '1'],
    ['Yinelenen id', '1'],
    ['Koleksiyon', '1'],
    ['Yetim koleksiyon üyesi', '1']
  ]);

  const fix = repairButton(panel);
  assert.equal(fix.disabled, false, 'a damaged library can be repaired');

  const before = storage.snapshot();
  fix.dispatchEvent(new root.Event('click'));
  assert.equal(root.confirms.length, 1, 'the repair asks before writing');
  assert.deepEqual(storage.snapshot(), before, 'and writes nothing when the answer is no');

  // Saying yes narrows the library and turns the panel healthy.
  root.confirm = () => true;
  fix.dispatchEvent(new root.Event('click'));
  assert.deepEqual(
    JSON.parse(storage.getItem(library.STORAGE_KEY)).map((item) => item.id),
    ['a', 'd'],
    'the duplicate and the record with no body are gone'
  );
  assert.match(statusOf(panel), /onarıldı/);
  assert.equal(repairButton(panelOf(root)).disabled, true, 'and there is nothing left to repair');
}

/* An invalid root is called out by name -------------------------------- */

{
  const { root, storage, library } = setUp({ items: [prompt('a')] });
  storage.setItem(library.STORAGE_KEY, '{not json');
  panelOf(root).querySelectorAll('button').find((node) => node.textContent === 'Yeniden tara')
    .dispatchEvent(new root.Event('click'));
  const notes = panelOf(root).querySelectorAll('.prompt-library-diagnostics-note').map((node) => node.textContent);
  assert.ok(notes.some((note) => /İstem deposu dizi biçiminde değil/.test(note)), 'the invalid root is reported');
  assert.equal(repairButton(panelOf(root)).disabled, false);
}

/* Hiding the panel keeps the toggle state honest ----------------------- */

{
  const { root } = setUp({ items: [prompt('a')] });
  const panel = panelOf(root);
  const toggle = panel.querySelectorAll('button').find((node) => node.getAttribute('aria-expanded') !== null);
  const body = root.document.getElementById('promptLibraryDiagnosticsBody');
  assert.equal(toggle.getAttribute('aria-controls'), 'promptLibraryDiagnosticsBody');
  assert.equal(body.hidden, false);

  toggle.dispatchEvent(new root.Event('click'));
  assert.equal(body.hidden, true);
  assert.equal(toggle.getAttribute('aria-expanded'), 'false');
  assert.equal(toggle.textContent, 'Göster');

  toggle.dispatchEvent(new root.Event('click'));
  assert.equal(body.hidden, false);
  assert.equal(toggle.getAttribute('aria-expanded'), 'true');
  assert.equal(toggle.textContent, 'Gizle');
}

/* Mounting twice does not stack panels --------------------------------- */

{
  const { root, diagnostics } = setUp({ items: [prompt('a')] });
  assert.equal(diagnostics.mount(root.document, root), null, 'a second mount is a no-op');
  assert.equal(root.document.querySelectorAll('.prompt-library-diagnostics').length, 1);
}

console.log('prompt library diagnostics DOM: ok');
