// The health panel as the user meets it: what it renders, when the repair
// button is live, and what a confirmation actually changes.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

import { createStorageStub } from './browser-storage-stub.mjs';
import { createPanelWindow } from './panel-dom-harness.mjs';

const require = createRequire(import.meta.url);

const PROMPT_KEY = 'hafize.prompt-library.v1';
const COLLECTION_KEY = 'hafize.prompt-library.collections.v1';

const storage = createStorageStub();
globalThis.localStorage = storage;
const library = require('../public/prompt-library.js');
globalThis.HafizePromptLibrary = library;
require('../public/prompt-library-collections.js');
const diagnostics = require('../public/prompt-library-diagnostics.js');

const prompt = (id) => ({
  id,
  title: `İstem ${id}`,
  body: 'gövde',
  tags: [],
  favorite: false,
  useCount: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z'
});

function mountPanel({ prompts, collections, confirmResponses = [] }) {
  storage.clear();
  storage.setItem(PROMPT_KEY, typeof prompts === 'string' ? prompts : JSON.stringify(prompts));
  storage.setItem(COLLECTION_KEY, JSON.stringify(collections));
  const root = createPanelWindow({ storage, confirmResponses });
  const card = root.document.createElement('section');
  card.id = 'promptLibraryCard';
  root.document.body.append(card);
  const controller = diagnostics.mount(root.document, root);
  return { root, card, controller, panel: root.document.getElementById('promptLibraryDiagnostics') };
}

const click = (root, node) => root.document.dispatchEvent({ type: 'click', target: node });

/* A healthy library renders its counts and offers nothing to repair ------ */

let view = mountPanel({ prompts: [prompt('a')], collections: [] });
assert.ok(view.controller?.mounted, 'the panel mounts into the prompt library card');
assert.equal(view.panel.getAttribute('aria-labelledby'), 'promptLibraryDiagnosticsTitle');

const report = view.panel.querySelector('.prompt-library-diagnostics-report');
assert.deepEqual(report.querySelectorAll('dt').map((node) => node.textContent), [
  'Depodaki kayıt', 'Geçerli kayıt', 'Bozuk kayıt', 'Yinelenen id', 'Koleksiyon', 'Yetim üye'
]);
assert.deepEqual(report.querySelectorAll('dd').map((node) => node.textContent), ['1', '1', '0', '0', '0', '0']);

const status = view.panel.querySelector('.prompt-library-diagnostics-status');
assert.equal(status.getAttribute('role'), 'status');
assert.equal(status.textContent, 'Kütüphane sağlıklı.');

const repairButton = view.panel.querySelector('[data-diagnostics-repair]');
assert.equal(repairButton.disabled, true, 'nothing to repair means nothing to press');

/* Pressing a disabled repair button cannot reach storage ----------------- */

const healthySnapshot = storage.snapshot();
click(view.root, repairButton);
assert.deepEqual(storage.snapshot(), healthySnapshot);
assert.deepEqual(view.root.confirmCalls, [], 'a disabled button never even asks');

/* The Gizle/Göster toggle carries its state in aria-expanded ------------- */

const toggle = view.panel.querySelector('.prompt-library-diagnostics-head button');
const body = view.panel.querySelector('.prompt-library-diagnostics-body');
assert.equal(toggle.getAttribute('aria-expanded'), 'true');
assert.equal(toggle.getAttribute('aria-controls'), body.id);
click(view.root, toggle);
assert.equal(toggle.getAttribute('aria-expanded'), 'false');
assert.equal(toggle.textContent, 'Göster');
assert.equal(body.hidden, true);
click(view.root, toggle);
assert.equal(toggle.getAttribute('aria-expanded'), 'true');
assert.equal(body.hidden, false);

/* A damaged library offers a repair, and declining it changes nothing ---- */

view = mountPanel({
  prompts: [prompt('a'), prompt('a'), null, { id: 'x' }],
  collections: [{ id: 'c1', name: 'Set', promptIds: ['a', 'gone'], createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' }],
  confirmResponses: [false, true]
});
const damagedRepair = view.panel.querySelector('[data-diagnostics-repair]');
assert.equal(damagedRepair.disabled, false);
assert.match(view.panel.querySelector('.prompt-library-diagnostics-status').textContent, /Sorun bulundu/);

const beforeDecline = storage.snapshot();
click(view.root, damagedRepair);
assert.equal(view.root.confirmCalls.length, 1, 'the repair asks before writing');
assert.deepEqual(storage.snapshot(), beforeDecline, 'declining leaves storage untouched');

/* Confirming rewrites both keys and tells the rest of the page ----------- */

click(view.root, damagedRepair);
assert.equal(view.root.confirmCalls.length, 2);
assert.deepEqual(JSON.parse(storage.getItem(PROMPT_KEY)).map((item) => item.id), ['a']);
assert.deepEqual(JSON.parse(storage.getItem(COLLECTION_KEY))[0].promptIds, ['a']);
assert.equal(view.panel.querySelector('.prompt-library-diagnostics-status').textContent, 'Onarım tamamlandı.');
assert.equal(view.panel.querySelector('[data-diagnostics-repair]').disabled, true, 'a repaired library has nothing left to fix');

const storageEvents = view.root.dispatched.filter((event) => event.type === 'storage');
assert.equal(storageEvents.length, 1, 'the library is told to repaint');
assert.equal(storageEvents[0].key, library.STORAGE_KEY);

/* Mounting twice is a no-op, and destroy() takes the panel back out ------ */

assert.equal(diagnostics.mount(view.root.document, view.root), null, 'the panel mounts once per card');
view.controller.destroy();
assert.equal(view.root.document.getElementById('promptLibraryDiagnostics'), null);

console.log('prompt diagnostics panel: ok');
