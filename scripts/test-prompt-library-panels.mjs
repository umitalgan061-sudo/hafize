// Koleksiyon ve sürüm panelleri: mount, güncelleme ve temiz kapanış.
//
// Bu paket dört grep paketinin (`collections-bounds`, `collections-orphans`,
// `collections-enhancements`, `revisions-lifecycle`, `collections-revisions-ui`)
// davranışsal karşılığıdır. Onlar kaynakta `MutationObserver`, `disconnect`,
// `setInterval` gibi dizeleri arıyordu; burada gözlemcinin gerçekten
// bağlandığı, `destroy()` sonrası kesildiği ve arkada zamanlayıcı kalmadığı
// ölçülür.
//
// Harness iki katılık uygular ve ikisi de burada bir güvenceye dönüşür:
// `innerHTML` erişimi hata verir (HTML birleştirme yok), `setInterval` hata
// verir (yinelenen iş sızıntısı yok).
import assert from 'node:assert/strict';
import { FakeMutationObserver, createEnvironment, createStorage, findByClass } from './dom-harness.mjs';

const PROMPTS = [
  { id: 'p1', title: 'Birinci', body: 'gövde bir', tags: ['a'], useCount: 0 },
  { id: 'p2', title: 'İkinci', body: 'gövde iki', tags: ['b'], useCount: 0 }
];

/**
 * Bir UMD `public/*.js` modülünü taze bir belge üzerine kurar.
 *
 * @param {string} specifier modül yolu
 * @param {string} globalName modülün kendini yazdığı global ad
 */
async function mountModule(specifier, globalName, { prompts = PROMPTS, extraGlobals = {} } = {}) {
  const storage = createStorage();
  storage.setItem('hafize.prompt-library.v1', JSON.stringify(prompts));
  const env = createEnvironment({ storage, readyState: 'loading' });
  FakeMutationObserver.reset();

  // Panellerin tutunduğu kart ve liste.
  const card = env.document.createElement('section');
  card.id = 'promptLibraryCard';
  const list = env.document.createElement('div');
  list.id = 'promptLibraryList';
  for (const prompt of prompts) {
    const row = env.document.createElement('div');
    row.className = 'prompt-item';
    row.dataset.promptId = prompt.id;
    const actions = env.document.createElement('div');
    actions.className = 'prompt-item-actions';
    const use = env.document.createElement('button');
    use.textContent = 'Kullan';
    actions.append(use);
    row.append(actions);
    list.append(row);
  }
  card.append(list);
  env.body.append(card);

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
    'document', 'localStorage', 'CSS', 'crypto', 'MutationObserver',
    'Event', 'CustomEvent', 'KeyboardEvent', 'MouseEvent', 'StorageEvent',
    'Element', 'HTMLElement', 'HTMLInputElement', 'HTMLTextAreaElement', 'HTMLSelectElement', 'HTMLButtonElement', 'Node', 'Text'
  ]) {
    put(name, env.window[name] ?? env.document);
  }
  // Tarayıcıda `globalThis === window`. Modüller kökü `globalThis` üzerinden
  // aldığı için pencere olay yüzeyi de oraya bağlanır; aksi hâlde modülün
  // kaydettiği `beforeunload` dinleyicisi paketin gönderdiği olayı hiç görmez.
  for (const name of ['addEventListener', 'removeEventListener', 'dispatchEvent', 'setTimeout', 'clearTimeout', 'confirm', 'prompt']) {
    put(name, (...args) => env.window[name](...args));
  }
  for (const [name, value] of Object.entries(extraGlobals)) put(name, value);

  await import(specifier);
  // Bazı geliştirme modülleri global yayınlamaz, yalnızca kendi kendine
  // başlar; o durumda `globalName` verilmez.
  const api = globalName ? globalThis[globalName] : undefined;
  if (globalName) assert.ok(api, `${globalName} global olarak yayınlanmalı`);

  return { env, api, card, list, storage, restore: () => { for (const fn of restore.splice(0)) fn(); } };
}
// === Koleksiyon paneli: mount ve temiz kapanış ==============================
{
  const t = await mountModule('../public/prompt-library-collections.js', 'HafizePromptLibraryCollections');
  const controller = t.api.mount(t.env.document, t.env.window);
  assert.ok(controller, 'panel mount edilebilmeli');

  const panel = t.env.document.getElementById('promptLibraryCollections');
  assert.ok(panel, 'panel belgeye eklenir');

  // Arama kutusu sınırlıdır ve erişilebilir adı vardır.
  const search = panel.querySelector('input[type="search"]');
  assert.ok(search, 'arama kutusu çizilir');
  assert.equal(search.maxLength, 100, 'arama kutusu 100 karakterle sınırlıdır');
  assert.ok(search.getAttribute('aria-label'), 'arama kutusunun erişilebilir adı var');

  // Gözlemci bağlandı.
  assert.ok(FakeMutationObserver.active.length >= 1, 'panel listeyi gözlemler');

  // `destroy()` her şeyi geri alır: düğüm, gözlemci ve bekleyen zamanlayıcı.
  controller.destroy?.();
  assert.equal(t.env.document.getElementById('promptLibraryCollections'), null, 'panel kaldırılır');
  assert.equal(FakeMutationObserver.active.length, 0, 'gözlemci kesilir, sızıntı kalmaz');
  assert.equal(t.env.window.timers.pending, 0, 'arkada bekleyen zamanlayıcı kalmaz');
  t.restore();
}
// === Koleksiyon geliştirmeleri: kendi kendine başlar, temiz kapanır ========
//
// Bu modül global yayınlamaz; `DOMContentLoaded` ile başlar ve `beforeunload`
// ile kendini toplar. Sızıntı denetimi bu yüzden kapanış olayı üzerinden
// yapılır.
{
  await import('../public/prompt-library-collections.js');
  const t = await mountModule('../public/prompt-library-collections-enhancements.js', null, {
    extraGlobals: { HafizePromptLibraryCollections: globalThis.HafizePromptLibraryCollections }
  });

  // Koleksiyon paneli yerinde olmalı ki geliştirme katmanı tutunabilsin.
  // Onun kendi gözlemcisi `destroy()` ile kapanır; burada ölçülen yalnızca
  // geliştirme katmanının `beforeunload` sonrası arkasında ne bıraktığıdır.
  const panelController = globalThis.HafizePromptLibraryCollections.mount(t.env.document, t.env.window);
  const baseline = FakeMutationObserver.active.length;
  t.env.document.dispatchEvent(new t.env.window.Event('DOMContentLoaded', { bubbles: false }));
  assert.ok(
    FakeMutationObserver.active.length > baseline,
    'geliştirme katmanı da kendi gözlemcisini bağlar'
  );

  // Her istem satırına seçim kutusu ekle; modülün okuduğu yüzey budur.
  for (const row of t.list.children) {
    const box = t.env.document.createElement('input');
    box.type = 'checkbox';
    box.dataset.promptSelection = row.dataset.promptId;
    box.checked = true;
    row.append(box);
  }
  assert.equal(
    t.env.document.querySelectorAll('#promptLibraryList [data-prompt-selection]:checked').length,
    2,
    'işaretli kutular seçilebilir durumda'
  );
  // Kapanış olayı bütün gözlemcileri ve dinleyicileri toplar.
  t.env.window.dispatchEvent(new t.env.window.Event('beforeunload', { bubbles: false }));
  assert.equal(
    FakeMutationObserver.active.length,
    baseline,
    'beforeunload geliştirme katmanının gözlemcisini keser, panelinkine dokunmaz'
  );
  assert.equal(t.env.window.timers.pending, 0, 'beforeunload sonrası bekleyen zamanlayıcı kalmaz');

  // Panel de kapandığında geriye hiçbir gözlemci kalmamalı.
  panelController?.destroy?.();
  assert.equal(FakeMutationObserver.active.length, 0, 'panel kapanınca gözlemci kalmaz');
  t.restore();
}
// === Sürüm paneli: mount, depolama olayı ve temiz kapanış ===================
{
  const t = await mountModule('../public/prompt-library-revisions.js', 'HafizePromptLibraryRevisions');
  const controller = t.api.mount(t.env.document, t.env.window);
  assert.ok(controller, 'sürüm paneli mount edilebilmeli');

  const panel = t.env.document.getElementById('promptLibraryRevisions');
  assert.ok(panel, 'panel belgeye eklenir');
  assert.ok(FakeMutationObserver.active.length >= 1, 'panel değişiklikleri gözlemler');

  // Bir sürüm yakala ve panelin yeniden çizilebildiğini doğrula.
  t.api.capture({ id: 'p1', title: 'Birinci', body: 'yeni gövde', tags: [], useCount: 0 }, 'edit', t.storage);
  assert.doesNotThrow(
    () => t.env.window.dispatchEvent(new t.env.window.StorageEvent('storage', {})),
    'depolama olayı paneli düşürmez'
  );

  controller.destroy?.();
  assert.equal(t.env.document.getElementById('promptLibraryRevisions'), null, 'panel kaldırılır');
  assert.equal(FakeMutationObserver.active.length, 0, 'gözlemci kesilir');
  assert.equal(t.env.window.timers.pending, 0, 'bekleyen zamanlayıcı kalmaz');

  // Kapanıştan sonra gelen bir depolama olayı da hata üretmemeli.
  assert.doesNotThrow(() => t.env.window.dispatchEvent(new t.env.window.StorageEvent('storage', {})));
  t.restore();
}

console.log('prompt library panels OK: paneller mount oluyor, gözlemciler kesiliyor, arkada zamanlayıcı kalmıyor');
