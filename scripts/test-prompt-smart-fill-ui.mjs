// Smart Fill, exercised through the panel it mounts.
//
// The rest of the Smart Fill suites assert on the source text, which is what
// broke when the module moved to TypeScript: the behaviour was intact and the
// contracts still failed. This one mounts the real module on a stand-in library
// card, clicks the real `Kullan` button and types into the real fields, so a
// rewrite is free as long as the panel still works.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createStorageStub } from './browser-storage-stub.mjs';
import { click, createDocument, createWindow, installDomGlobals, keydown } from './dom-harness.mjs';

const require = createRequire(import.meta.url);

installDomGlobals();
const storage = createStorageStub();
globalThis.localStorage = storage;
const library = require('../public/prompt-library.js');
globalThis.HafizePromptLibrary = library;
await import('../public/prompt-library-smart-fill.ts');
const smartFill = globalThis.HafizePromptLibrarySmartFill;
assert.ok(smartFill?.mount, 'smart fill exposes its panel on the global');

const PROMPT_KEY = library.STORAGE_KEY;

const prompt = (id, body, title = `İstem ${id}`) => ({
  id,
  title,
  body,
  tags: [],
  favorite: false,
  useCount: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z'
});

function setup(items, { answer = 'Set 1', confirmAnswer = true } = {}) {
  storage.clear();
  storage.setItem(PROMPT_KEY, JSON.stringify(library.normalizeCollection(items)));

  const documentRef = createDocument();
  const card = documentRef.createElement('section');
  card.id = 'promptLibraryCard';
  const list = documentRef.createElement('div');
  list.id = 'promptLibraryList';
  card.append(list);
  const composer = documentRef.createElement('textarea');
  composer.id = 'messageInput';
  documentRef.body.append(card, composer);

  for (const item of items) {
    const row = documentRef.createElement('article');
    row.className = 'prompt-item';
    row.dataset.promptId = item.id;
    const actions = documentRef.createElement('div');
    actions.className = 'prompt-item-actions';
    for (const label of ['Kullan', 'Düzenle', 'Sil']) {
      const action = documentRef.createElement('button');
      action.textContent = label;
      actions.append(action);
    }
    row.append(actions);
    list.append(row);
  }

  const storageEvents = [];
  const copied = [];
  const asked = [];
  const root = createWindow(documentRef, {
    prompt: (message) => { asked.push(message); return answer; },
    confirm: (message) => { asked.push(message); return confirmAnswer; },
    navigator: { clipboard: { writeText: async (value) => { copied.push(value); } } },
    crypto: { randomUUID: () => `id-${asked.length}-${copied.length}-${storageEvents.length}-${Math.random().toString(16).slice(2, 8)}` }
  });
  root.addEventListener('storage', (event) => storageEvents.push(event));

  const controller = smartFill.mount(documentRef, root);
  assert.ok(controller?.mounted, 'smart fill mounts on the library card');
  const dialog = documentRef.getElementById('promptLibrarySmartFill');
  const labelled = (label) => dialog.querySelectorAll('button').find((node) => node.textContent === label);
  return {
    documentRef,
    root,
    card,
    composer,
    dialog,
    controller,
    storageEvents,
    copied,
    asked,
    use: (id) => click(documentRef.querySelectorAll('.prompt-item').find((row) => row.dataset.promptId === id).querySelectorAll('button')[0]),
    fields: () => dialog.querySelectorAll('.prompt-smart-fill-field input'),
    field: (name) => dialog.querySelectorAll('input').find((node) => node.name === name),
    preview: () => dialog.querySelector('.prompt-smart-fill-preview').textContent,
    errors: () => dialog.querySelector('.prompt-smart-fill-errors').textContent,
    select: () => dialog.querySelector('select'),
    insert: () => labelled('Mesaja aktar'),
    cancel: () => labelled('Vazgeç'),
    copy: () => labelled('Önizlemeyi kopyala'),
    savePreset: () => labelled('Seti kaydet'),
    clearPresets: () => labelled('Setleri temizle'),
    type(name, value) {
      const input = this.field(name);
      input.value = value;
      input.dispatchEvent(new this.root.Event('input', { bubbles: true }));
    }
  };
}

/* A prompt with variables opens the panel instead of filling the composer --- */

{
  const ui = setup([prompt('p1', 'Merhaba {{ad}}, konu {{konu}}.')]);
  assert.equal(ui.dialog.hidden, true, 'the panel starts hidden');
  ui.use('p1');
  assert.equal(ui.dialog.hidden, false, 'Kullan opens the panel');
  assert.equal(ui.composer.value, '', 'the composer is not filled yet');
  assert.deepEqual(ui.fields().map((input) => input.name), ['ad', 'konu'], 'one field per variable, in order');
  assert.equal(ui.fields()[0].maxLength, 1000, 'each field carries the value bound');
  assert.equal(ui.dialog.getAttribute('role'), 'dialog');
  assert.equal(ui.dialog.getAttribute('aria-modal'), 'true');
  assert.equal(ui.controller.close(), undefined);
}

/* A prompt without variables is left to the library's own handler ---------- */

{
  const ui = setup([prompt('plain', 'Değişken yok.')]);
  let libraryHandled = false;
  ui.card.addEventListener('click', () => { libraryHandled = true; });
  ui.use('plain');
  assert.equal(ui.dialog.hidden, true, 'nothing to fill, so the panel stays closed');
  assert.equal(libraryHandled, true, 'the original Kullan handler still runs');
}

/* The preview follows what is typed ---------------------------------------- */

{
  const ui = setup([prompt('p1', 'Merhaba {{ad}}, konu {{konu}}.')]);
  ui.use('p1');
  ui.type('ad', 'Ümit');
  assert.match(ui.preview(), /Merhaba Ümit/, 'the preview repaints as the field changes');
  ui.type('konu', 'rapor');
  assert.equal(ui.preview(), 'Merhaba Ümit, konu rapor.');
}

/* An empty field blocks the transfer and names what is missing ------------- */

{
  const ui = setup([prompt('p1', 'Merhaba {{ad}}, konu {{konu}}.')]);
  ui.use('p1');
  ui.type('ad', 'Ümit');
  click(ui.insert());
  assert.equal(ui.composer.value, '', 'an unfilled prompt is never transferred');
  assert.match(ui.errors(), /konu/, 'the missing variable is named');
  assert.equal(ui.dialog.hidden, false, 'the panel stays open so the field can be filled');
}

/* A filled prompt lands in the composer, without being sent ---------------- */

{
  const ui = setup([prompt('p1', 'Merhaba {{ad}}, konu {{konu}}.')]);
  let submitted = false;
  ui.composer.addEventListener('submit', () => { submitted = true; });
  const inputEvents = [];
  ui.composer.addEventListener('input', () => inputEvents.push(ui.composer.value));

  ui.use('p1');
  ui.type('ad', 'Ümit');
  ui.type('konu', 'rapor');
  click(ui.insert());

  assert.equal(ui.composer.value, 'Merhaba Ümit, konu rapor.', 'the filled prompt reaches the composer');
  assert.deepEqual(inputEvents, ['Merhaba Ümit, konu rapor.'], 'the composer is told its value changed');
  assert.equal(submitted, false, 'nothing is sent');
  assert.equal(ui.dialog.hidden, true, 'the panel closes after the transfer');
  assert.equal(ui.documentRef.activeElement, ui.composer, 'focus moves to the composer');

  const stored = JSON.parse(storage.getItem(PROMPT_KEY));
  assert.equal(stored[0].useCount, 1, 'the use counter is incremented');
  assert.equal(ui.storageEvents.length, 1, 'the library card is told to repaint');
  assert.equal(ui.storageEvents[0].key, PROMPT_KEY);
}

/* Variable sets round-trip through the prompt-scoped key ------------------- */

{
  const ui = setup([prompt('p1', 'Merhaba {{ad}}.')]);
  ui.use('p1');
  ui.type('ad', 'Ümit');
  click(ui.savePreset());

  const key = `${smartFill.STORAGE_KEY}.p1`;
  const saved = JSON.parse(storage.getItem(key));
  assert.equal(saved.length, 1, 'the set is stored under the prompt-scoped key');
  assert.deepEqual(saved[0].values, { ad: 'Ümit' });
  assert.ok(!Object.keys(storage.snapshot()).includes(`${smartFill.STORAGE_KEY}.other`), 'no other prompt is touched');

  ui.type('ad', 'başka');
  const option = ui.select().children.find((node) => node.textContent === 'Set 1');
  ui.select().value = option.value;
  ui.select().dispatchEvent(new ui.root.Event('change', { bubbles: true }));
  assert.equal(ui.field('ad').value, 'Ümit', 'choosing the set restores its values');
  assert.match(ui.preview(), /Merhaba Ümit/, 'and repaints the preview');

  click(ui.clearPresets());
  assert.deepEqual(JSON.parse(storage.getItem(key)), [], 'clearing removes the sets after a confirmation');
  assert.ok(ui.asked.some((message) => /silinsin mi/i.test(message)), 'clearing asks first');
}

/* Refusing the confirmation keeps the sets -------------------------------- */

{
  const ui = setup([prompt('p1', 'Merhaba {{ad}}.')], { confirmAnswer: false });
  ui.use('p1');
  ui.type('ad', 'Ümit');
  click(ui.savePreset());
  const key = `${smartFill.STORAGE_KEY}.p1`;
  click(ui.clearPresets());
  assert.equal(JSON.parse(storage.getItem(key)).length, 1, 'a refused clear keeps the stored set');
}

/* The preview can be copied without touching the composer ----------------- */

{
  const ui = setup([prompt('p1', 'Merhaba {{ad}}.')]);
  ui.use('p1');
  ui.type('ad', 'Ümit');
  click(ui.copy());
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(ui.copied, ['Merhaba Ümit.'], 'the rendered preview is copied');
  assert.equal(ui.composer.value, '', 'copying does not fill the composer');
}

/* Escape closes the panel and hands focus back ---------------------------- */

{
  const ui = setup([prompt('p1', 'Merhaba {{ad}}.')]);
  const useButton = ui.documentRef.querySelector('.prompt-item-actions button');
  useButton.focus();
  ui.use('p1');
  keydown(ui.dialog, 'Escape');
  assert.equal(ui.dialog.hidden, true, 'Escape closes the panel');
  assert.equal(ui.composer.value, '', 'and transfers nothing');
  assert.equal(ui.documentRef.activeElement, useButton, 'focus returns to the button that opened it');
}

/* Tab stays inside the open panel ----------------------------------------- */

{
  const ui = setup([prompt('p1', 'Merhaba {{ad}}.')]);
  ui.use('p1');
  const focusables = ui.dialog.querySelectorAll('button,input,select').filter((node) => !node.disabled && !node.hidden);
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  last.focus();
  keydown(ui.dialog, 'Tab');
  assert.equal(ui.documentRef.activeElement, first, 'Tab wraps to the first control');
  keydown(ui.dialog, 'Tab', { shiftKey: true });
  assert.equal(ui.documentRef.activeElement, last, 'Shift+Tab wraps back to the last');
}

/* Values are bounded, and nothing leaks to another prompt ------------------ */

{
  const ui = setup([prompt('p1', '{{ad}}'), prompt('p2', '{{ad}}')]);
  ui.use('p1');
  ui.type('ad', 'x'.repeat(4000));
  click(ui.insert());
  assert.equal(ui.composer.value.length, 1000, 'a pasted value is clamped to the field bound');

  ui.use('p2');
  assert.equal(ui.field('ad').value, '', 'the next prompt starts from empty fields');
}

/* Mounting twice is a no-op, and destroy leaves the card as it was --------- */

{
  const ui = setup([prompt('p1', '{{ad}}')]);
  assert.equal(smartFill.mount(ui.documentRef, ui.root), null, 'mounting twice is a no-op');
  ui.controller.destroy();
  assert.equal(ui.documentRef.getElementById('promptLibrarySmartFill'), null, 'destroy removes the panel');
  ui.use('p1');
  assert.equal(ui.documentRef.getElementById('promptLibrarySmartFill'), null, 'the click interceptor is gone too');
}

console.log('prompt smart-fill UI: ok');
