// `public/*.mts` — tarayıcıda çalışan tiplenmiş modüllerin saf çekirdeği.
//
// Bu modüller DOM'a yazan bir `mount()` ve DOM'dan bağımsız saf yardımcılar
// olarak ikiye ayrılır. Burada yalnızca saf taraf sınanır: sıralama, sınırlar,
// bozuk `localStorage` karşısındaki davranış ve zaman biçimlendirme. `mount()`
// tarafının kendi DOM paketleri vardır.
//
// Modüller `globalThis` üzerinden kök alır (bkz. her dosyanın başındaki not),
// bu yüzden Node içinde global'leri doldurmak gerçek tarayıcı yolunu taklit
// eder — kaynak dosyada desen aramak yerine davranış ölçülür.
import assert from 'node:assert/strict';

/**
 * Bir global'i sınama süresince değiştirir ve geri alan bir fonksiyon döndürür.
 *
 * @param {string} name
 * @param {unknown} value
 * @returns {() => void}
 */
function stubGlobal(name, value) {
  const had = Object.hasOwn(globalThis, name);
  const previous = /** @type {any} */ (globalThis)[name];
  /** @type {any} */ (globalThis)[name] = value;
  return () => {
    if (had) /** @type {any} */ (globalThis)[name] = previous;
    else delete /** @type {any} */ (globalThis)[name];
  };
}

/** Prompt kütüphanesi çekirdeğinin sahte karşılığı. */
const promptLibraryCore = {
  STORAGE_KEY: 'hafize.prompt-library.v1',
  loadItems: (/** @type {Storage} */ storage) => JSON.parse(storage.getItem('hafize.prompt-library.v1') || '[]'),
  extractVariables: (/** @type {string} */ body) => [...body.matchAll(/\{\{\s*([A-Za-z0-9_-]+)\s*\}\}/g)].map((match) => match[1])
};

const restoreCore = stubGlobal('HafizePromptLibrary', promptLibraryCore);

/**
 * Yalnızca `getItem`/`setItem` sunan en küçük depolama ikizi.
 *
 * @param {string | null} raw `getItem` için sabit yanıt.
 * @param {(key: string, value: string) => void} [setItem] yazma gözlemcisi.
 * @returns {Storage}
 */
function storageDouble(raw, setItem = () => {}) {
  return { getItem: () => raw, setItem, removeItem: () => {}, clear: () => {}, key: () => null, length: 0 };
}

const { searchPromptLibrary } = await import('../public/prompt-library-command-palette.mts');
const { readPresets, writePresets, variableNames } = await import('../public/prompt-library-smart-fill.mts');
const { countdownLabel } = await import('../public/scheduled-tasks-countdown.mts');
const { paintSmartFillHints } = await import('../public/prompt-library-smart-fill-hints.mts');

// === Komut paleti araması ==================================================

// Sıralama: tam başlık > başlık ön eki > etiket > gövde.
{
  const restore = stubGlobal('localStorage', storageDouble(JSON.stringify([
    { id: 'body', title: 'Kod', body: 'asistan metni', tags: [], updatedAt: '2026-01-01T00:00:00Z' },
    { id: 'tag', title: 'Plan', body: 'başka', tags: ['asistan'], updatedAt: '2026-01-02T00:00:00Z' },
    { id: 'prefix', title: 'Asistan için plan', body: 'başka', tags: [], updatedAt: '2026-01-03T00:00:00Z' },
    { id: 'exact', title: 'Asistan', body: 'başka', tags: [], favorite: false, updatedAt: '2026-01-04T00:00:00Z' }
  ])));
  assert.deepEqual(searchPromptLibrary('Asistan').map((item) => item.id), ['exact', 'prefix', 'tag', 'body']);
  restore();
}

// Eşitlik bozucular belirlenimlidir: önce favori, sonra güncellenme tarihi.
{
  const restore = stubGlobal('localStorage', storageDouble(JSON.stringify([
    { id: 'old', title: 'A plan', body: '', tags: [], favorite: false, updatedAt: '2026-01-01T00:00:00Z' },
    { id: 'new', title: 'B plan', body: '', tags: [], favorite: false, updatedAt: '2026-02-01T00:00:00Z' },
    { id: 'fav', title: 'C plan', body: '', tags: [], favorite: true, updatedAt: '2026-01-05T00:00:00Z' }
  ])));
  const result = searchPromptLibrary('plan');
  assert.equal(result[0]?.id, 'fav');
  assert.equal(result.length, 3);
  restore();
}

// Sorgu uzunluğu ve sonuç sayısı sınırlıdır.
{
  const items = Array.from({ length: 40 }, (_, index) => ({
    id: String(index), title: `A ${index}`, body: 'A', tags: [], updatedAt: '2026-03-01T00:00:00Z'
  }));
  const restore = stubGlobal('localStorage', storageDouble(JSON.stringify(items)));
  assert.equal(searchPromptLibrary('A').length, 12, '40 eşleşen kayıt 12 ile sınırlanır');
  // Sorgu 120 karakterde kesilir: 500 karakterlik bir girdi ile onun kırpılmış
  // hâli aynı sonucu verir (ikisi de hiçbir başlıkla eşleşmez), yani sınır
  // gerçekten uygulanıyor ve uzun girdi sınırsız iş doğurmuyor.
  assert.deepEqual(searchPromptLibrary('A'.repeat(500)), searchPromptLibrary('A'.repeat(120)));
  assert.deepEqual(searchPromptLibrary('A'.repeat(500)), [], 'eşleşmeyen uzun sorgu boş döner');
  assert.doesNotThrow(() => searchPromptLibrary('A'.repeat(50_000)));
  restore();
}

// Bozuk depolama arama yolunu düşürmez.
{
  const restore = stubGlobal('localStorage', storageDouble('{broken'));
  assert.deepEqual(searchPromptLibrary('anything'), []);
  restore();
}

// === Akıllı doldurma ========================================================

// Değişken adları benzersiz ve sıralıdır.
assert.deepEqual(variableNames('{{konu}} {{konu}} {{format}}'), ['konu', 'format']);

// Bozuk kayıtlar düşer, sayı sınırlanır.
{
  const entries = Array.from({ length: 10 }, (_, index) => ({
    id: `id-${index}`, name: `Set ${index}`, values: { konu: `değer-${index}` }
  }));
  const restore = stubGlobal('localStorage', storageDouble(JSON.stringify([...entries, null, { id: '', name: '', values: {} }])));
  assert.equal(readPresets('prompt').length, 6);
  assert.equal(readPresets('prompt')[0]?.values.konu, 'değer-0');
  restore();
}

// Yazma, isteme özgü anahtar altında ve sınırlı sayıda yapılır.
{
  /** @type {Array<[string, string]>} */
  const writes = [];
  const restore = stubGlobal('localStorage', storageDouble(null, (key, raw) => { writes.push([key, raw]); }));
  const presets = Array.from({ length: 9 }, (_, index) => ({ id: `id-${index}`, name: `Set ${index}`, values: { konu: 'x' } }));
  assert.equal(writePresets('abc', presets), true);
  assert.equal(writes.length, 1);
  assert.equal(writes[0][0], 'hafize.prompt-library.smart-fill.v1.abc');
  assert.equal(JSON.parse(writes[0][1]).length, 6);
  restore();
}

// === Akıllı doldurma ipuçları ==============================================
//
// `paintSmartFillHints` bir panel düğümüne yazar; burada sayaçların metin
// düğümü olarak yazıldığı ve HTML birleştirmesi yapılmadığı doğrulanır.
{
  assert.equal(typeof paintSmartFillHints, 'function');
  const source = paintSmartFillHints.toString();
  assert.match(source, /textContent/, 'sayaçlar textContent ile yazılır');
  assert.doesNotMatch(source, /innerHTML/, 'HTML birleştirmesi yoktur');
  assert.doesNotMatch(source, /insertAdjacentHTML/);
}

// === Zamanlanmış görev geri sayımı =========================================
{
  const realNow = Date.now;
  /** @param {string} iso */
  const at = (iso) => { Date.now = () => new Date(iso).getTime(); };

  assert.equal(countdownLabel('not-a-date'), '', 'geçersiz zaman damgası etiketsizdir');

  at('2026-09-16T10:00:00Z');
  assert.equal(countdownLabel('2026-09-16T09:59:00Z'), 'Şimdi çalışması bekleniyor', 'gecikmiş görev negatif süre göstermez');
  assert.equal(countdownLabel('2026-09-18T12:30:00Z'), '2 gün 2 saat kaldı');
  assert.equal(countdownLabel('2026-09-16T10:45:00Z'), '45 dk kaldı');
  assert.equal(countdownLabel('2026-09-16T12:30:00Z'), '2 saat 30 dk kaldı');

  Date.now = realNow;
}

restoreCore();

console.log('typed browser modules OK: sıralama belirlenimli, sınırlar bağlayıcı, bozuk depolama yolu düşürmüyor');
