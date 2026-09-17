// İstem seçici (komut paleti): gerçek DOM üzerinde uçtan uca davranış.
//
// `/prompt` yazımı, sonuç listesi, klavye gezinmesi, mesaja ekleme ve akıllı
// doldurmaya devretme burada modül gerçekten mount edilerek ölçülür. Önceki
// "lifecycle / query-bounds / source / command-syntax" paketleri kaynak
// dosyada dize arıyordu; modül TypeScript'e taşınınca dördü birden kırıldı,
// oysa davranış aynıydı.
//
// Sıralama mantığının saf tarafı `test-typed-browser-modules.mjs` içinde
// ayrıca sınanır; burada arayüz tarafı vardır.
import assert from 'node:assert/strict';
import { createEnvironment, createStorage, findByClass } from './dom-harness.mjs';

const PROMPTS = [
  { id: 'duz', title: 'Düz istem', body: 'Değişkensiz gövde.', tags: ['kısa'], favorite: false, updatedAt: '2026-01-01T00:00:00Z' },
  { id: 'degiskenli', title: 'Değişkenli istem', body: 'Merhaba {{ad}}.', tags: [], favorite: false, updatedAt: '2026-01-02T00:00:00Z' },
  { id: 'favori', title: 'Favori plan', body: 'Plan gövdesi.', tags: ['plan'], favorite: true, updatedAt: '2026-01-03T00:00:00Z' }
];

function coreDouble(storage) {
  return {
    STORAGE_KEY: 'hafize.prompt-library.v1',
    loadItems: (store) => JSON.parse((store ?? storage).getItem('hafize.prompt-library.v1') || '[]'),
    extractVariables: (body) => [...String(body).matchAll(/\{\{\s*([A-Za-z0-9_-]+)\s*\}\}/g)].map((match) => match[1])
  };
}

async function setup({ prompts = PROMPTS, smartFill = null } = {}) {
  const storage = createStorage();
  storage.setItem('hafize.prompt-library.v1', JSON.stringify(prompts));
  const env = createEnvironment({ storage, readyState: 'loading' });

  const composer = env.document.createElement('textarea');
  composer.id = 'messageInput';
  env.body.append(composer);

  const restore = [];
  const put = (name, value) => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, { value, writable: true, configurable: true, enumerable: true });
    restore.push(() => {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    });
  };
  for (const name of [
    'document', 'localStorage', 'CSS', 'crypto',
    'Event', 'CustomEvent', 'KeyboardEvent', 'MouseEvent', 'StorageEvent',
    'Element', 'HTMLElement', 'HTMLInputElement', 'HTMLTextAreaElement', 'HTMLButtonElement', 'Node', 'Text'
  ]) {
    put(name, env.window[name] ?? env.document);
  }
  put('HafizePromptLibrary', coreDouble(storage));
  put('HafizePromptLibrarySmartFill', smartFill ?? undefined);
  env.window.HafizePromptLibrarySmartFill = smartFill ?? undefined;

  await import('../public/prompt-library-command-palette.mts');
  const api = globalThis.PromptLibraryCommandPalette;
  assert.ok(api, 'modül kendini global olarak yayınlar');

  const controller = api.mount(env.document, env.window);
  assert.ok(controller?.mounted, 'palet mount edilebilmeli');

  const palette = env.document.getElementById('promptLibraryCommandPalette');
  const query = palette.querySelector('input');
  const list = findByClass(palette, 'prompt-command-palette-list')[0];
  const status = findByClass(palette, 'prompt-command-palette-status')[0];

  /** Bestecide imleci sona alarak metin yazar ve `input` olayı yayar. */
  const type = (text) => {
    composer.value = text;
    composer.selectionStart = text.length;
    composer.dispatchEvent(new env.window.Event('input', { bubbles: true }));
  };
  const key = (node, name, init = {}) => {
    const event = new env.window.KeyboardEvent('keydown', { key: name, bubbles: true, ...init });
    node.dispatchEvent(event);
    return event;
  };

  return {
    env, api, controller, composer, palette, query, list, status, storage, type, key,
    restore: () => { for (const fn of restore.splice(0)) fn(); }
  };
}

// === `/prompt` yazımı paleti açar ==========================================
{
  const t = await setup();
  assert.equal(t.palette.hidden, true, 'palet kapalı başlar');

  t.type('bir şeyler /prompt');
  assert.equal(t.palette.hidden, false, '/prompt yazımı paleti açar');
  assert.equal(t.list.children.length, 3, 'tüm istemler listelenir');
  assert.match(t.status.textContent, /3 istem bulundu/);

  // Erişilebilirlik: liste kutusu, seçenek rolleri, canlı durum.
  assert.equal(t.palette.getAttribute('role'), 'dialog');
  assert.equal(t.list.getAttribute('role'), 'listbox');
  assert.equal(t.status.getAttribute('aria-live'), 'polite');
  for (const option of t.list.children) assert.equal(option.getAttribute('role'), 'option');
  assert.equal(t.list.children[0].getAttribute('aria-selected'), 'true', 'ilk seçenek seçili başlar');
  assert.ok(t.query.getAttribute('aria-label'), 'arama alanının erişilebilir adı var');

  // Tetikleyicinin ardındaki metin sorguya geçer.
  t.type('/prompt plan');
  assert.equal(t.query.value, 'plan', 'tetikleyiciden sonraki metin arama kutusuna yazılır');
  assert.equal(t.list.children.length, 1);
  assert.equal(t.list.children[0].dataset.promptId, 'favori');
  t.restore();
}

// === Tetikleyici olmayan metin paleti açmaz ================================
{
  const t = await setup();
  for (const text of ['prompt', 'x/prompt', 'merhaba dünya', '/pro']) {
    t.type(text);
    assert.equal(t.palette.hidden, true, `"${text}" paleti açmamalı`);
  }
  // Kelime sınırı: satır başı ya da boşluktan sonra gelmeli.
  t.type('/prompt');
  assert.equal(t.palette.hidden, false, 'satır başındaki /prompt açar');
  t.restore();
}

// === Klavye gezinmesi dairesel, Enter seçer =================================
{
  const t = await setup();
  t.type('/prompt');
  const ids = () => [...t.list.children].map((node) => node.dataset.promptId);
  const selected = () => [...t.list.children].findIndex((node) => node.getAttribute('aria-selected') === 'true');

  assert.equal(selected(), 0);
  const down = t.key(t.composer, 'ArrowDown');
  assert.equal(down.defaultPrevented, true, 'ArrowDown bestecinin imlecini oynatmaz');
  assert.equal(selected(), 1);

  t.key(t.composer, 'ArrowUp');
  assert.equal(selected(), 0);
  t.key(t.composer, 'ArrowUp');
  assert.equal(selected(), ids().length - 1, 'başta yukarı gitmek sona sarar');
  t.key(t.composer, 'ArrowDown');
  assert.equal(selected(), 0, 'sonda aşağı gitmek başa sarar');
  t.restore();
}

// === Değişkensiz istem doğrudan mesaja girer ================================
{
  const t = await setup();
  t.type('Merhaba /prompt düz');

  let inserted = null;
  t.env.window.addEventListener('hafize:prompt-command-inserted', (event) => { inserted = event.detail; });
  let composerInputs = 0;
  t.composer.addEventListener('input', () => { composerInputs += 1; });

  t.key(t.composer, 'Enter');
  assert.equal(t.composer.value, 'Merhaba Değişkensiz gövde.', 'tetikleyici metni istem gövdesiyle değişir');
  assert.equal(t.palette.hidden, true, 'ekledikten sonra palet kapanır');
  assert.equal(composerInputs, 1, 'besteci girdi olayı alır');
  assert.deepEqual(inserted, { id: 'duz', title: 'Düz istem' }, 'ekleme olayı yayınlanır');
  t.restore();
}

// === Değişkenli istem akıllı doldurmaya devredilir ==========================
{
  const opened = [];
  const t = await setup({ smartFill: { open: (item) => opened.push(item.id) } });
  t.type('/prompt değişkenli');
  t.key(t.composer, 'Enter');

  assert.deepEqual(opened, ['degiskenli'], 'değişkenli istem doğrudan yapıştırılmaz, doldurma paneline devredilir');
  assert.equal(t.composer.value, '/prompt değişkenli', 'besteci metni doldurma tamamlanana kadar değişmez');
  assert.equal(t.palette.hidden, true, 'devrederken palet kapanır');
  t.restore();
}

// Akıllı doldurma yüklü değilse istem yine de eklenir: eksik bir modül
// kullanıcıyı çıkmaza sokmamalı.
{
  const t = await setup({ smartFill: null });
  t.type('/prompt değişkenli');
  t.key(t.composer, 'Enter');
  assert.equal(t.composer.value, 'Merhaba {{ad}}.', 'doldurma modülü yokken ham gövde eklenir');
  t.restore();
}

// === Fare ile seçim de aynı yolu izler ======================================
{
  const t = await setup();
  t.type('/prompt plan');
  t.list.children[0].dispatchEvent(new t.env.window.MouseEvent('click', { bubbles: true }));
  assert.equal(t.composer.value, 'Plan gövdesi.');
  assert.equal(t.palette.hidden, true);
  t.restore();
}

// === Escape kapatır ve odağı geri verir =====================================
{
  const t = await setup();
  t.composer.focus();
  t.type('/prompt');
  assert.equal(t.env.document.activeElement, t.query, 'açılınca odak arama kutusuna geçer');

  t.key(t.palette, 'Escape');
  assert.equal(t.palette.hidden, true, 'Escape kapatır');
  assert.equal(t.env.document.activeElement, t.composer, 'odak besteciye döner');
  assert.equal(t.list.children.length, 0, 'kapanınca liste boşaltılır');
  assert.equal(t.query.value, '', 'kapanınca sorgu temizlenir');
  t.restore();
}

// === Sınırlar ve boş durumlar ===============================================
{
  const t = await setup();
  assert.equal(t.query.maxLength, 120, 'arama kutusu 120 karakterle sınırlıdır');

  t.type('/prompt eşleşmeyenbirşey');
  assert.equal(t.list.children.length, 0);
  assert.match(t.status.textContent, /bulunamadı/i, 'sonuç yokken kullanıcı bilgilendirilir');
  t.key(t.composer, 'Enter');
  assert.equal(t.composer.value, '/prompt eşleşmeyenbirşey', 'boş listede Enter hiçbir şey eklemez');
  t.restore();
}
{
  const t = await setup({ prompts: [] });
  t.type('/prompt');
  assert.match(t.status.textContent, /Kütüphanede istem yok/i, 'boş kütüphane ayrı bir mesaj gösterir');
  t.restore();
}
{
  // 40 istem, hepsi eşleşiyor: liste 12 ile sınırlıdır.
  const many = Array.from({ length: 40 }, (_, index) => ({
    id: `p${index}`, title: `Aynı ${index}`, body: 'gövde', tags: [], favorite: false, updatedAt: '2026-01-01T00:00:00Z'
  }));
  const t = await setup({ prompts: many });
  t.type('/prompt Aynı');
  assert.equal(t.list.children.length, 12, 'sonuç listesi 12 ile sınırlıdır');
  t.restore();
}

// === Bozuk depolama paleti düşürmez =========================================
{
  const t = await setup();
  t.storage.setItem('hafize.prompt-library.v1', '{bozuk');
  assert.doesNotThrow(() => t.type('/prompt'), 'bozuk JSON paleti açmayı engellemez');
  assert.equal(t.list.children.length, 0);
  t.restore();
}

// === `destroy()` ardında iz bırakmaz ========================================
{
  const t = await setup();
  t.controller.destroy();
  assert.equal(t.env.document.getElementById('promptLibraryCommandPalette'), null, 'palet DOM\'dan kaldırılır');
  t.type('/prompt');
  assert.equal(t.env.document.getElementById('promptLibraryCommandPalette'), null, 'kaldırıldıktan sonra tetikleyici yeniden çizmez');
  t.restore();
}

console.log('prompt command palette OK: /prompt açıyor, klavye dairesel, değişkenli istem doldurmaya devrediliyor, Escape odağı geri veriyor');
