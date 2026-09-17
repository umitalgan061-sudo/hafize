// Koleksiyonlar ve sürüm geçmişi: yayınlanan yüzey ve bağlayıcı sınırlar.
//
// Bu paket, dört ayrı "contracts / regression / release / smoke" paketinin
// yerini alır. Dördü de aynı iki dosyada aynı dizeleri arıyordu: bir sabitin
// adı değiştiğinde dördü birden kırmızıya düşüyor, sabitin *değeri* yanlış
// olduğunda ise dördü birden yeşil kalıyordu. Burada sabitin kaynakta yazılı
// olması değil, sınırın gerçekten uygulanması ölçülür.
//
// Önbellek sürümü bilerek sabitlenmez: `shell-cache-contract.mjs` sürümden
// bağımsız değişmezleri zaten doğrular, literal bir `v36` ise her kabuk
// değişiminde anlamsızca kırılır.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { assertShellCacheContract } from './shell-cache-contract.mjs';

/** Yalnızca gerçekten kullanılan yüzeyi sunan depolama ikizi. */
class StorageDouble {
  #data = new Map();
  getItem(key) { return this.#data.has(key) ? this.#data.get(key) : null; }
  setItem(key, value) { this.#data.set(key, String(value)); }
  removeItem(key) { this.#data.delete(key); }
  clear() { this.#data.clear(); }
  key() { return null; }
  get length() { return this.#data.size; }
}

const storage = new StorageDouble();
globalThis.localStorage = /** @type {Storage} */ (/** @type {unknown} */ (storage));

await import('../public/prompt-library-collections.js');
await import('../public/prompt-library-revisions.js');

const collections = /** @type {any} */ (globalThis).HafizePromptLibraryCollections;
const revisions = /** @type {any} */ (globalThis).HafizePromptLibraryRevisions;

// === Yayınlanan yüzey =======================================================
//
// Ad listesi bir sözleşmedir: aşağı akıştaki geliştirme modülleri ve kontrol
// paketleri bu adları çağırır. Kaynakta geçmesi değil, çağrılabilir olması
// aranır.
for (const name of [
  'normalizeCollection', 'normalizeCollections', 'readCollections', 'saveCollections',
  'pruneMembers', 'createCollection', 'updateCollection', 'deleteCollection',
  'setMembership', 'addMembers', 'removeMembers', 'exportPayload', 'importPayload', 'mount'
]) {
  assert.equal(typeof collections?.[name], 'function', `koleksiyon yüzeyi eksik: ${name}`);
}
for (const name of [
  'normalizeSnapshot', 'normalizeRevision', 'readRevisions', 'saveRevisions',
  'revisionsFor', 'sameContent', 'capture', 'removePromptRevisions',
  'pruneOrphans', 'restore', 'exportPromptRevisions', 'summarizeRevision', 'mount'
]) {
  assert.equal(typeof revisions?.[name], 'function', `sürüm yüzeyi eksik: ${name}`);
}

// === Depolama anahtarları ===================================================
//
// İki modül aynı istem listesini okur; anahtarların ayrışması sessiz veri
// kaybı demektir.
{
  storage.clear();
  const prompts = [{ id: 'p1', title: 'Başlık', body: 'Gövde', tags: [], useCount: 0 }];
  storage.setItem('hafize.prompt-library.v1', JSON.stringify(prompts));
  const created = collections.createCollection({ name: 'Set' }, storage);
  assert.ok(created, 'koleksiyon oluşturulabilmeli');
  assert.ok(storage.getItem('hafize.prompt-library.collections.v1'), 'koleksiyonlar kendi anahtarına yazılır');

  revisions.capture({ id: 'p1', title: 'Başlık', body: 'Yeni gövde', tags: [], useCount: 0 }, 'edit', storage);
  assert.ok(storage.getItem('hafize.prompt-library.revisions.v1'), 'sürümler kendi anahtarına yazılır');
  assert.equal(
    JSON.parse(storage.getItem('hafize.prompt-library.v1')).length,
    1,
    'istem listesi iki modül tarafından da bozulmadan bırakılır'
  );
}

// === Sınırlar gerçekten uygulanıyor mu? =====================================

// Koleksiyon sayısı üst sınırı.
{
  storage.clear();
  let lastAccepted = 0;
  for (let index = 0; index < 60; index += 1) {
    if (collections.createCollection({ name: `Set ${index}` }, storage)) lastAccepted = index + 1;
  }
  const stored = collections.readCollections(storage);
  assert.ok(stored.length <= 40, `koleksiyon sayısı sınırlı olmalı, bulunan: ${stored.length}`);
  assert.equal(stored.length, 40, 'sınır tam olarak 40 koleksiyondur');
  assert.ok(lastAccepted >= 40);
}

// Üye sayısı üst sınırı.
{
  storage.clear();
  const prompts = Array.from({ length: 200 }, (_, index) => ({ id: `p${index}`, title: `T${index}`, body: 'b', tags: [], useCount: 0 }));
  storage.setItem('hafize.prompt-library.v1', JSON.stringify(prompts));
  const created = collections.createCollection({ name: 'Büyük' }, storage);
  collections.addMembers(created.id, prompts.map((item) => item.id), storage);
  const [reloaded] = collections.readCollections(storage).filter((entry) => entry.id === created.id);
  assert.ok(reloaded.promptIds.length <= 120, `üye sayısı sınırlı olmalı, bulunan: ${reloaded.promptIds.length}`);
  assert.equal(reloaded.promptIds.length, 120, 'sınır tam olarak 120 üyedir');
  assert.equal(new Set(reloaded.promptIds).size, reloaded.promptIds.length, 'üyeler benzersizdir');
}

// Metin alanları kırpılır.
{
  const normalized = collections.normalizeCollection({
    id: 'x', name: 'n'.repeat(400), description: 'd'.repeat(900), promptIds: []
  });
  assert.equal(normalized.name.length, 80, 'ad 80 karakterde kırpılır');
  assert.equal(normalized.description.length, 240, 'açıklama 240 karakterde kırpılır');
}

// İstem başına ve toplam sürüm sayısı sınırlıdır.
{
  storage.clear();
  storage.setItem('hafize.prompt-library.v1', JSON.stringify([{ id: 'p1', title: 'T', body: 'b', tags: [], useCount: 0 }]));
  for (let index = 0; index < 40; index += 1) {
    revisions.capture({ id: 'p1', title: 'T', body: `gövde ${index}`, tags: [], useCount: 0 }, 'edit', storage);
  }
  const kept = revisions.revisionsFor('p1', storage);
  assert.ok(kept.length <= 20, `istem başına sürüm sınırlı olmalı, bulunan: ${kept.length}`);
  assert.equal(kept.length, 20, 'sınır tam olarak 20 sürümdür');
  // En yeni kayıt korunur, en eskiler düşer.
  assert.match(JSON.stringify(kept), /gövde 39/, 'en yeni sürüm korunur');
  assert.doesNotMatch(JSON.stringify(kept), /gövde 0"/, 'en eski sürüm düşer');
}

// Aynı içerik ikinci bir sürüm doğurmaz.
{
  storage.clear();
  storage.setItem('hafize.prompt-library.v1', JSON.stringify([{ id: 'p1', title: 'T', body: 'b', tags: [], useCount: 0 }]));
  const record = { id: 'p1', title: 'T', body: 'aynı', tags: [], useCount: 0 };
  revisions.capture(record, 'edit', storage);
  const first = revisions.revisionsFor('p1', storage).length;
  revisions.capture(record, 'edit', storage);
  assert.equal(revisions.revisionsFor('p1', storage).length, first, 'değişmemiş içerik yeni sürüm üretmez');
  assert.equal(revisions.sameContent({ title: 'T', body: 'aynı' }, { title: 'T', body: 'aynı' }), true);
  assert.equal(revisions.sameContent({ title: 'T', body: 'aynı' }, { title: 'T', body: 'başka' }), false);
}

// Sürüm gövdesi ve etiketleri kırpılır.
{
  const snapshot = revisions.normalizeSnapshot({
    id: 'p1',
    title: 't'.repeat(400),
    body: 'b'.repeat(20_000),
    tags: Array.from({ length: 40 }, (_, index) => `etiket-${index}`.repeat(10))
  });
  assert.equal(snapshot.title.length, 100, 'başlık 100 karakterde kırpılır');
  assert.equal(snapshot.body.length, 8000, 'gövde 8000 karakterde kırpılır');
  assert.ok(snapshot.tags.length <= 8, 'etiket sayısı sınırlı');
  for (const tag of snapshot.tags) assert.ok(tag.length <= 24, 'her etiket 24 karakterde kırpılır');
}

// === Geri yükleme sayaçları korur ===========================================
{
  storage.clear();
  storage.setItem('hafize.prompt-library.v1', JSON.stringify([
    { id: 'p1', title: 'Eski', body: 'eski gövde', tags: [], useCount: 7, createdAt: '2026-01-01T00:00:00.000Z' }
  ]));
  revisions.capture({ id: 'p1', title: 'Yeni', body: 'yeni gövde', tags: [], useCount: 7 }, 'edit', storage);
  const [snapshot] = revisions.revisionsFor('p1', storage);
  assert.ok(snapshot, 'geri yüklenecek bir sürüm bulunmalı');
  revisions.restore('p1', snapshot.id, storage);
  const [restored] = JSON.parse(storage.getItem('hafize.prompt-library.v1'));
  assert.equal(restored.useCount, 7, 'geri yükleme kullanım sayacını sıfırlamaz');
  assert.equal(restored.createdAt, '2026-01-01T00:00:00.000Z', 'geri yükleme oluşturma tarihini korur');
}

// Artık var olmayan istemlerin sürümleri temizlenir.
{
  storage.clear();
  storage.setItem('hafize.prompt-library.v1', JSON.stringify([{ id: 'kalan', title: 'T', body: 'b', tags: [], useCount: 0 }]));
  revisions.capture({ id: 'kalan', title: 'T', body: 'x', tags: [], useCount: 0 }, 'edit', storage);
  revisions.capture({ id: 'silinmiş', title: 'T', body: 'y', tags: [], useCount: 0 }, 'edit', storage);
  revisions.pruneOrphans(storage);
  assert.equal(revisions.revisionsFor('silinmiş', storage).length, 0, 'yetim sürümler temizlenir');
  assert.ok(revisions.revisionsFor('kalan', storage).length >= 1, 'var olan istemin geçmişi korunur');
}

// === Üye budama: silinmiş istemlerin kimlikleri koleksiyonda kalmaz ========
{
  storage.clear();
  const prompts = [{ id: 'kalan', title: 'T', body: 'b', tags: [], useCount: 0 }];
  storage.setItem('hafize.prompt-library.v1', JSON.stringify(prompts));
  const created = collections.createCollection({ name: 'Karışık' }, storage);
  collections.addMembers(created.id, ['kalan', 'silinmiş', 'hiç-olmayan'], storage);

  const [pruned] = collections.pruneMembers(collections.readCollections(storage), storage);
  assert.deepEqual(pruned.promptIds, ['kalan'], 'var olmayan istem kimlikleri düşer');

  // Budama yalnızca üyelikten çıkarır; istemin kendisine dokunmaz.
  assert.equal(JSON.parse(storage.getItem('hafize.prompt-library.v1')).length, 1, 'istem listesi budamadan etkilenmez');
}

// === Dışa/içe aktarma ======================================================
{
  storage.clear();
  storage.setItem('hafize.prompt-library.v1', JSON.stringify([{ id: 'p1', title: 'T', body: 'b', tags: [], useCount: 0 }]));
  const created = collections.createCollection({ name: 'Dışarı', description: 'açıklama' }, storage);
  collections.addMembers(created.id, ['p1'], storage);

  const payload = JSON.parse(collections.exportPayload(storage));
  assert.equal(payload.source, 'hafize-prompt-library-collections', 'yük kaynağını bildirir');
  assert.equal(typeof payload.version, 'number');
  assert.equal(payload.collections.length, 1);

  // Aynı adı taşıyan kayıt ikinci kez içe aktarılmaz.
  const again = collections.importPayload(payload, storage);
  assert.equal(again.imported, 0);
  assert.equal(again.skipped, 1, 'ad çakışması atlanır, üzerine yazılmaz');

  // Nesne olmayan yük atmaz.
  for (const bad of [null, undefined, 'metin', 42, []]) {
    assert.doesNotThrow(() => collections.importPayload(bad, storage));
  }
  assert.deepEqual(collections.importPayload(null, storage), { imported: 0, skipped: 0 });

  // İçe aktarma koleksiyon sınırını aşamaz.
  const flood = { collections: Array.from({ length: 80 }, (_, index) => ({ id: `x${index}`, name: `Yeni ${index}`, description: '', promptIds: [] })) };
  collections.importPayload(flood, storage);
  assert.equal(collections.readCollections(storage).length, 40, 'içe aktarma 40 sınırını aşmaz');
}

// === Varlıklar sayfaya ve çevrimdışı kabuğa birlikte girer ==================
{
  const html = fs.readFileSync('public/index.html', 'utf8');
  for (const asset of [
    '/prompt-library-collections.css', '/prompt-library-collections.js', '/prompt-library-collections-enhancements.js',
    '/prompt-library-revisions.css', '/prompt-library-revisions.js', '/prompt-library-revisions-enhancements.js'
  ]) {
    assert.ok(html.includes(asset), `${asset} index.html tarafından yüklenmiyor`);
  }
  // Sürüm literali yerine değişmezler: kabuk adı biçimli, eski sürümler
  // temizleniyor, her varlığın arkasında gerçek bir dosya var.
  assertShellCacheContract();
}

console.log('prompt library collections + revisions OK: yüzey çağrılabilir, sınırlar uygulanıyor, geri yükleme sayaçları koruyor');
