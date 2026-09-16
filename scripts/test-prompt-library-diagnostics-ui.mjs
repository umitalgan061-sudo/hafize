// The health panel, exercised through the UI it mounts.
//
// `inspect()` and `repair()` are covered by the runtime suite; what this suite
// protects is the part a user touches: the panel stays collapsed until asked
// for, the report shows the numbers, repair is offered only when it can help,
// and nothing is written without a confirmation.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createStorageStub } from './browser-storage-stub.mjs';
import { click, createDocument, createWindow } from './dom-harness.mjs';

const require = createRequire(import.meta.url);

const storage = createStorageStub();
globalThis.localStorage = storage;
const library = require('../public/prompt-library.js');
globalThis.HafizePromptLibrary = library;
require('../public/prompt-library-collections.js');
const collections = globalThis.HafizePromptLibraryCollections;
const diagnostics = require('../public/prompt-library-diagnostics.js');

const PROMPT_KEY = library.STORAGE_KEY;
const COLLECTION_KEY = collections.STORAGE_KEY;

const prompt = (id) => ({
  id,
  title: `İstem ${id}`,
  body: 'gövde',
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

function setup({ prompts, collectionMembers, confirmAnswer = true } = {}) {
  storage.clear();
  if (prompts !== undefined) storage.setItem(PROMPT_KEY, typeof prompts === 'string' ? prompts : JSON.stringify(prompts));
  if (collectionMembers) storage.setItem(COLLECTION_KEY, JSON.stringify([collection(collectionMembers)]));
  const documentRef = createDocument();
  const card = documentRef.createElement('section');
  card.id = 'promptLibraryCard';
  documentRef.body.append(card);
  const asked = [];
  const previousConfirm = globalThis.confirm;
  globalThis.confirm = (message) => { asked.push(message); return confirmAnswer; };
  const root = createWindow(documentRef);
  const controller = diagnostics.mount(documentRef);
  assert.ok(controller?.mounted, 'the panel mounts on the library card');
  const panel = documentRef.getElementById('promptLibraryDiagnostics');
  const buttons = () => panel.querySelectorAll('button');
  const labelled = (label) => buttons().find((node) => node.textContent === label);
  return {
    documentRef,
    root,
    panel,
    controller,
    asked,
    restore: () => { globalThis.confirm = previousConfirm; },
    report: () => documentRef.getElementById('promptLibraryDiagnosticsReport'),
    toggle: () => buttons()[0],
    rescan: () => labelled('Yeniden tara'),
    repair: () => panel.querySelector('button[data-diagnostics-repair]'),
    status: () => panel.querySelector('.prompt-library-diagnostics-status').textContent,
    values: () => {
      const list = panel.querySelector('.prompt-library-diagnostics-list');
      const entries = {};
      const nodes = list.children;
      for (let index = 0; index + 1 < nodes.length; index += 2) entries[nodes[index].textContent] = nodes[index + 1].textContent;
      return entries;
    }
  };
}

/* The panel costs one line until it is opened ------------------------------ */

{
  const ui = setup({ prompts: [prompt('a')] });
  assert.equal(ui.report().hidden, true, 'the report starts collapsed');
  assert.equal(ui.toggle().getAttribute('aria-expanded'), 'false');
  assert.equal(ui.panel.getAttribute('aria-labelledby'), 'promptLibraryDiagnosticsTitle');
  assert.equal(ui.toggle().getAttribute('aria-controls'), 'promptLibraryDiagnosticsReport');

  click(ui.toggle());
  assert.equal(ui.report().hidden, false, 'the report opens');
  assert.equal(ui.toggle().getAttribute('aria-expanded'), 'true');
  assert.equal(ui.toggle().textContent, 'Gizle');

  click(ui.toggle());
  assert.equal(ui.report().hidden, true, 'and closes again');
  assert.equal(ui.toggle().getAttribute('aria-expanded'), 'false');
  ui.restore();
}

/* A healthy library says so, and offers no repair -------------------------- */

{
  const ui = setup({ prompts: [prompt('a'), prompt('b')], collectionMembers: ['a'] });
  click(ui.toggle());
  assert.equal(ui.status(), 'Kütüphane sağlıklı.');
  assert.equal(ui.repair().disabled, true, 'a healthy library has nothing to repair');
  assert.deepEqual(ui.values(), {
    'Ham kayıt': '2',
    'Okunabilir': '2',
    'Bozuk': '0',
    'Yinelenen id': '0',
    'Koleksiyon': '1',
    'Yetim üye': '0'
  });
  ui.restore();
}

/* Damage is named in the status and counted in the report ------------------ */

{
  const ui = setup({
    prompts: [prompt('a'), prompt('a'), { id: 'bozuk', title: '', body: '' }],
    collectionMembers: ['a', 'silinmiş']
  });
  click(ui.toggle());
  const values = ui.values();
  assert.equal(values['Yinelenen id'], '1');
  assert.equal(values['Bozuk'], '1');
  assert.equal(values['Yetim üye'], '1');
  assert.match(ui.status(), /yinelenen id/i);
  assert.match(ui.status(), /yetim/i);
  assert.equal(ui.repair().disabled, false, 'repair is offered when it can help');
  ui.restore();
}

/* Repair asks first, and a refusal writes nothing -------------------------- */

{
  const ui = setup({ prompts: [prompt('a'), prompt('a')], confirmAnswer: false });
  click(ui.toggle());
  const before = storage.snapshot();
  click(ui.repair());
  assert.equal(ui.asked.length, 1, 'the user is asked before anything is written');
  assert.deepEqual(storage.snapshot(), before, 'a refused repair writes nothing');
  ui.restore();
}

/* A confirmed repair fixes the library and the panel re-reads it ----------- */

{
  const ui = setup({ prompts: [prompt('a'), prompt('a'), { id: 'bozuk', title: '' }], collectionMembers: ['a', 'silinmiş'] });
  click(ui.toggle());
  click(ui.repair());
  assert.equal(ui.asked.length, 1);
  assert.equal(ui.status(), 'Kütüphane sağlıklı.', 'the panel reports the repaired state');
  assert.equal(ui.repair().disabled, true, 'there is nothing left to repair');
  assert.deepEqual(JSON.parse(storage.getItem(PROMPT_KEY)).map((item) => item.id), ['a']);
  assert.deepEqual(JSON.parse(storage.getItem(COLLECTION_KEY))[0].promptIds, ['a']);
  ui.restore();
}

/* An unreadable store is reported, and repair is not offered --------------- */

{
  const ui = setup({ prompts: 'kırık json' });
  click(ui.toggle());
  assert.match(ui.status(), /okunamadı|dizi/i);
  assert.equal(ui.repair().disabled, true, 'a store that cannot be read is never overwritten');
  ui.restore();
}

/* Rescanning picks up a change made elsewhere ------------------------------ */

{
  const ui = setup({ prompts: [prompt('a')] });
  click(ui.toggle());
  assert.equal(ui.values()['Ham kayıt'], '1');
  storage.setItem(PROMPT_KEY, JSON.stringify([prompt('a'), prompt('b'), prompt('c')]));
  click(ui.rescan());
  assert.equal(ui.values()['Ham kayıt'], '3', 'the report is re-read on demand');
  ui.restore();
}

/* Mounting is idempotent and destroy leaves the card as it was ------------- */

{
  const ui = setup({ prompts: [prompt('a')] });
  assert.equal(diagnostics.mount(ui.documentRef), null, 'mounting twice is a no-op');
  ui.controller.destroy();
  assert.equal(ui.documentRef.getElementById('promptLibraryDiagnostics'), null, 'destroy removes the panel');
  ui.restore();
}

console.log('prompt library diagnostics UI: ok');
