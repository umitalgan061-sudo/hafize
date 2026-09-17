// Akıllı doldurma paneli: gerçek DOM üzerinde uçtan uca davranış.
//
// Bu paket, aynı ~330 satırlık modülü hedefleyen 36 ayrı "acceptance /
// go-no-go / merge-gate / smoke / release / user-journey / final-*" paketinin
// yerini alır. Hepsi kaynak dosyada dize arıyordu: modül TypeScript'e
// taşındığında 36'sı birden kırıldı, oysa davranış hiç değişmemişti — ve
// mantık bozulsa hiçbiri bunu göremezdi.
//
// Burada modül `scripts/dom-harness.mjs` üzerinde gerçekten mount edilir ve
// ürettiği ağaç, odak sırası, olay yolları ve depolama etkileri ölçülür.
// Harness `innerHTML`i tümüyle reddeder, yani "HTML birleştirme yok" güvencesi
// bir desen araması değil, çalışma anında zorunlu bir değişmezdir.
import assert from 'node:assert/strict';
import { createEnvironment, createStorage, findByClass } from './dom-harness.mjs';

const PROMPTS = [
  { id: 'p1', title: 'Rapor', body: 'Merhaba {{ad}}, {{konu}} hakkında rapor yaz.', tags: [], useCount: 3 },
  { id: 'p2', title: 'Sabit', body: 'Değişkeni olmayan istem.', tags: [], useCount: 0 }
];

/** Prompt kütüphanesi çekirdeğinin, modülün gerçekten çağırdığı kadarı. */
function coreDouble(storage, { saveItems = true } = {}) {
  return {
    STORAGE_KEY: 'hafize.prompt-library.v1',
    loadItems: (store) => JSON.parse((store ?? storage).getItem('hafize.prompt-library.v1') || '[]'),
    saveItems: (store, items) => {
      if (!saveItems) return false;
      (store ?? storage).setItem('hafize.prompt-library.v1', JSON.stringify(items));
      return true;
    },
    normalizeItem: (item) => item,
    extractVariables: (body) => [...String(body).matchAll(/\{\{\s*([A-Za-z0-9_-]+)\s*\}\}/g)].map((match) => match[1]),
    replaceVariables: (body, values) => String(body).replace(/\{\{\s*([A-Za-z0-9_-]+)\s*\}\}/g, (_, name) => values[name] ?? '')
  };
}

/**
 * Modülü taze bir belge üzerine kurar.
 *
 * Modül içe aktarıldığında kendini bir kez global'e yazar ve otomatik mount
 * eder; ESM önbelleği yüzünden ikinci bir içe aktarma bunu tekrarlamaz. Bu
 * yüzden her senaryo kendi belgesini kurup `api.mount()`u elle çağırır.
 */
async function setup({ storage = createStorage(), core = coreDouble(storage), prompts = PROMPTS } = {}) {
  storage.setItem('hafize.prompt-library.v1', JSON.stringify(prompts));
  // `readyState: 'loading'` modülün kendi otomatik mount'unu DOMContentLoaded'a
  // erteler; o olay bu pakette hiç tetiklenmez, böylece her senaryo mount
  // anını kendisi belirler ve ilk içe aktarma diğerlerinden ayrışmaz.
  const env = createEnvironment({ storage, readyState: 'loading' });

  const card = env.document.createElement('section');
  card.id = 'promptLibraryCard';
  const list = env.document.createElement('div');
  list.id = 'promptLibraryList';
  card.append(list);
  const composer = env.document.createElement('textarea');
  composer.id = 'messageInput';
  env.body.append(card, composer);

  // Modül kökü `globalThis` üzerinden alır; sayfanın global'lerini doldur.
  const restore = [];
  const put = (name, value) => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, name);
    // Node bazı global'leri (`crypto`) yalnızca getter olarak tanımlar; düz
    // atama orada TypeError verir, bu yüzden tanım üzerinden yazılır.
    Object.defineProperty(globalThis, name, { value, writable: true, configurable: true, enumerable: true });
    restore.push(() => {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    });
  };
  for (const name of [
    'document', 'localStorage', 'CSS', 'crypto',
    'Event', 'StorageEvent', 'KeyboardEvent', 'MouseEvent',
    'Element', 'HTMLElement', 'HTMLInputElement', 'HTMLTextAreaElement', 'HTMLSelectElement', 'HTMLButtonElement', 'Node', 'Text'
  ]) {
    put(name, env.window[name] ?? env.document);
  }
  put('HafizePromptLibrary', core);
  // Modül ilk alana odağı `setTimeout` ile verir; kuyruğu anında boşalt.
  const timeouts = [];
  env.window.setTimeout = (fn) => { timeouts.push(fn); return timeouts.length; };
  env.window.prompt = () => env.window.__promptAnswer ?? '';
  env.window.confirm = () => env.window.__confirmAnswer !== false;

  const module = await import('../public/prompt-library-smart-fill.mts');
  const api = globalThis.HafizePromptLibrarySmartFill;
  assert.ok(api, 'modül kendini global olarak yayınlar');

  const controller = api.mount(env.document, env.window);
  assert.ok(controller?.mounted, 'panel mount edilebilmeli');

  const flush = () => { for (const fn of timeouts.splice(0)) fn(); };
  const dialog = env.document.getElementById('promptLibrarySmartFill');
  return { env, api, module, controller, card, list, composer, dialog, storage, core, flush, restore: () => { for (const fn of restore.splice(0)) fn(); } };
}

const key = (node, name, init = {}) => node.dispatchEvent(new (node.ownerDocument.defaultView.KeyboardEvent)('keydown', { key: name, bubbles: true, ...init }));

// === Panel açılışı: her değişken için bir alan ==============================
{
  const t = await setup();
  assert.equal(t.dialog.hidden, true, 'panel kapalı başlar');

  t.controller.open(PROMPTS[0]);
  assert.equal(t.dialog.hidden, false, 'açılınca görünür olur');

  const fields = findByClass(t.dialog, 'prompt-smart-fill-field');
  assert.equal(fields.length, 2, 'iki değişken için iki alan üretilir');
  assert.deepEqual(
    findByClass(t.dialog, 'prompt-smart-fill-label').map((node) => node.textContent),
    ['{{ad}}', '{{konu}}'],
    'etiketler değişken adlarını gösterir'
  );

  // Erişilebilirlik: diyalog rolü, modal işareti ve her alanın adı.
  assert.equal(t.dialog.getAttribute('role'), 'dialog');
  assert.equal(t.dialog.getAttribute('aria-modal'), 'true');
  assert.ok(t.dialog.getAttribute('aria-labelledby'), 'başlık bağlanmış');
  assert.ok(t.dialog.getAttribute('aria-describedby'), 'açıklama bağlanmış');
  for (const input of t.dialog.querySelectorAll('input')) {
    assert.ok(input.getAttribute('aria-label'), 'her alanın erişilebilir adı var');
    assert.equal(input.getAttribute('autocomplete'), 'off', 'değişken değerleri otomatik tamamlanmaz');
  }

  // Değişkeni olmayan istem bilgilendirir, panel yine de açılır.
  t.controller.open(PROMPTS[1]);
  assert.equal(findByClass(t.dialog, 'prompt-smart-fill-field').length, 0);
  assert.match(findByClass(t.dialog, 'prompt-smart-fill-errors')[0].textContent, /değişken içermiyor/i);
  t.restore();
}

// === Önizleme yazarken güncellenir, metin düğümü olarak yazılır =============
{
  const t = await setup();
  t.controller.open(PROMPTS[0]);
  const [ad, konu] = t.dialog.querySelectorAll('input');
  const preview = findByClass(t.dialog, 'prompt-smart-fill-preview')[0];

  ad.value = 'Hafize';
  ad.dispatchEvent(new t.env.window.Event('input', { bubbles: true }));
  assert.match(preview.textContent, /Merhaba Hafize/, 'önizleme ilk değişkeni yansıtır');

  konu.value = 'satış';
  konu.dispatchEvent(new t.env.window.Event('input', { bubbles: true }));
  assert.equal(preview.textContent, 'Merhaba Hafize, satış hakkında rapor yaz.');

  // Önizleme canlı bir bölgedir ki ekran okuyucu değişimi duyurabilsin.
  assert.equal(preview.getAttribute('aria-live'), 'polite');

  // Düşman girdi harfi harfine metin kalır: harness innerHTML'i reddettiği
  // için bir HTML birleştirme yolu olsaydı burada hata fırlardı.
  ad.value = '<img src=x onerror=alert(1)>';
  ad.dispatchEvent(new t.env.window.Event('input', { bubbles: true }));
  assert.match(preview.textContent, /<img src=x onerror=alert\(1\)>/, 'etiket metin olarak görünür');
  assert.equal(preview.children.length, 0, 'önizleme yalnızca metin düğümü taşır');
  t.restore();
}

// === Mesaja aktarma: eksik değişken engeller, tam değişken aktarır ==========
{
  const t = await setup();
  t.controller.open(PROMPTS[0]);
  const [ad, konu] = t.dialog.querySelectorAll('input');
  const insert = [...t.dialog.querySelectorAll('button')].find((node) => node.textContent === 'Mesaja aktar');
  const errors = findByClass(t.dialog, 'prompt-smart-fill-errors')[0];

  ad.value = 'Hafize';
  insert.dispatchEvent(new t.env.window.MouseEvent('click', { bubbles: true }));
  assert.match(errors.textContent, /\{\{konu\}\}/, 'eksik değişken adıyla bildirilir');
  assert.equal(t.composer.value, '', 'eksik değişkenle mesaja hiçbir şey yazılmaz');
  assert.equal(t.dialog.hidden, false, 'panel açık kalır');

  konu.value = 'satış';
  let composerInputEvents = 0;
  t.composer.addEventListener('input', () => { composerInputEvents += 1; });
  insert.dispatchEvent(new t.env.window.MouseEvent('click', { bubbles: true }));
  assert.equal(t.composer.value, 'Merhaba Hafize, satış hakkında rapor yaz.', 'tam istem mesaja aktarılır');
  assert.equal(composerInputEvents, 1, 'besteci girdi olayı alır, böylece taslak kaydı tetiklenir');
  assert.equal(t.dialog.hidden, true, 'aktarımdan sonra panel kapanır');

  // Kullanım sayacı artar ve depoya yazılır.
  const stored = JSON.parse(t.storage.getItem('hafize.prompt-library.v1'));
  assert.equal(stored.find((item) => item.id === 'p1').useCount, 4, 'kullanım sayacı bir artar');
  t.restore();
}

// === Odak tuzağı ve Escape =================================================
{
  const t = await setup();
  const opener = t.env.document.createElement('button');
  t.env.body.append(opener);
  opener.focus();

  t.controller.open(PROMPTS[0]);
  t.flush();
  const [ad] = t.dialog.querySelectorAll('input');
  assert.equal(t.env.document.activeElement, ad, 'ilk değişken alanı odaklanır');

  const focusables = [...t.dialog.querySelectorAll('button,input,select')].filter((node) => !node.hidden && !node.disabled);
  const first = focusables[0];
  const last = focusables[focusables.length - 1];

  last.focus();
  key(t.dialog, 'Tab');
  assert.equal(t.env.document.activeElement, first, 'son elemandan Tab başa sarar');

  first.focus();
  key(t.dialog, 'Tab', { shiftKey: true });
  assert.equal(t.env.document.activeElement, last, 'ilk elemandan Shift+Tab sona sarar');

  key(t.dialog, 'Escape');
  assert.equal(t.dialog.hidden, true, 'Escape paneli kapatır');
  assert.equal(t.env.document.activeElement, opener, 'kapanınca odak açan elemana döner');
  t.restore();
}

// === Alanlar arası ok tuşu gezinmesi, Enter form göndermez =================
{
  const t = await setup();
  t.controller.open(PROMPTS[0]);
  const [ad, konu] = t.dialog.querySelectorAll('input');

  ad.focus();
  const enter = new t.env.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
  ad.dispatchEvent(enter);
  assert.equal(enter.defaultPrevented, true, 'Enter varsayılanı engeller: form gönderilmez, sayfa yenilenmez');
  assert.equal(t.env.document.activeElement, konu, 'Enter bir sonraki alana geçer');

  konu.dispatchEvent(new t.env.window.KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
  assert.equal(t.env.document.activeElement, ad, 'ArrowUp bir önceki alana döner');

  // Son alanda ArrowDown sınırı aşmaz.
  konu.focus();
  konu.dispatchEvent(new t.env.window.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
  assert.equal(t.env.document.activeElement, konu, 'son alanda aşağı gitmek odağı kaybettirmez');
  t.restore();
}

// === Değişken setleri: kaydet, uygula, temizle ==============================
{
  const t = await setup();
  t.controller.open(PROMPTS[0]);
  const [ad, konu] = t.dialog.querySelectorAll('input');
  ad.value = 'Hafize';
  konu.value = 'satış';

  const save = [...t.dialog.querySelectorAll('button')].find((node) => node.textContent === 'Seti kaydet');
  t.env.window.__promptAnswer = 'Haftalık';
  save.dispatchEvent(new t.env.window.MouseEvent('click', { bubbles: true }));

  const raw = t.storage.getItem('hafize.prompt-library.smart-fill.v1.p1');
  assert.ok(raw, 'set isteme özgü anahtara yazılır');
  const [preset] = JSON.parse(raw);
  assert.equal(preset.name, 'Haftalık');
  assert.deepEqual(preset.values, { ad: 'Hafize', konu: 'satış' });

  // Alanları boşalt, seti seçince geri gelmeli.
  ad.value = '';
  konu.value = '';
  const select = t.dialog.querySelector('select');
  assert.ok([...select.children].some((option) => option.textContent === 'Haftalık'), 'set listeye girer');
  select.value = preset.id;
  select.dispatchEvent(new t.env.window.Event('change', { bubbles: true }));
  assert.equal(ad.value, 'Hafize', 'set seçilince değerler geri yüklenir');
  assert.equal(konu.value, 'satış');

  // Temizleme onay ister ve reddedilirse hiçbir şey silmez.
  const clear = [...t.dialog.querySelectorAll('button')].find((node) => node.textContent === 'Setleri temizle');
  t.env.window.__confirmAnswer = false;
  clear.dispatchEvent(new t.env.window.MouseEvent('click', { bubbles: true }));
  assert.ok(JSON.parse(t.storage.getItem('hafize.prompt-library.smart-fill.v1.p1')).length, 'onay verilmeden silinmez');

  t.env.window.__confirmAnswer = true;
  clear.dispatchEvent(new t.env.window.MouseEvent('click', { bubbles: true }));
  assert.deepEqual(JSON.parse(t.storage.getItem('hafize.prompt-library.smart-fill.v1.p1')), [], 'onaylanınca temizlenir');
  t.restore();
}

// === Depolama arızası paneli düşürmez ======================================
{
  const failing = createStorage();
  const core = coreDouble(failing, { saveItems: false });
  const t = await setup({ storage: failing, core });
  // Kota ancak panel kurulduktan sonra dolar: kurulum sırasında istem listesi
  // yazılabilmeli, kırılması gereken yer kullanıcı eylemidir.
  failing.setItem = () => { throw new Error('quota exceeded'); };

  t.controller.open(PROMPTS[0]);
  const [ad, konu] = t.dialog.querySelectorAll('input');
  ad.value = 'Hafize';
  konu.value = 'satış';

  const save = [...t.dialog.querySelectorAll('button')].find((node) => node.textContent === 'Seti kaydet');
  t.env.window.__promptAnswer = 'Set';
  assert.doesNotThrow(
    () => save.dispatchEvent(new t.env.window.MouseEvent('click', { bubbles: true })),
    'dolu kota bir istisna ile sayfayı düşürmez'
  );
  assert.match(findByClass(t.dialog, 'prompt-smart-fill-errors')[0].textContent, /kaydedilemedi/i, 'kullanıcı bilgilendirilir');

  // Yazılamayan kullanım sayacı yine de aktarımı engellemez.
  const insert = [...t.dialog.querySelectorAll('button')].find((node) => node.textContent === 'Mesaja aktar');
  assert.doesNotThrow(() => insert.dispatchEvent(new t.env.window.MouseEvent('click', { bubbles: true })));
  assert.equal(t.composer.value, 'Merhaba Hafize, satış hakkında rapor yaz.', 'aktarım depolama arızasından bağımsızdır');
  t.restore();
}

// === Depolama yalıtımı: her istem kendi anahtarını kullanır ================
{
  // Set çubuğu yalnızca değişkeni olan istemler için çizilir, bu yüzden iki
  // değişkenli istem kullanılır.
  const prompts = [
    { id: 'p1', title: 'Bir', body: '{{a}} metni', tags: [], useCount: 0 },
    { id: 'p2', title: 'İki', body: '{{b}} metni', tags: [], useCount: 0 }
  ];
  const t = await setup({ prompts });
  for (const [promptId, name] of [['p1', 'Bir'], ['p2', 'İki']]) {
    t.controller.open(prompts.find((item) => item.id === promptId));
    t.env.window.__promptAnswer = name;
    [...t.dialog.querySelectorAll('button')].find((node) => node.textContent === 'Seti kaydet')
      .dispatchEvent(new t.env.window.MouseEvent('click', { bubbles: true }));
  }
  const first = JSON.parse(t.storage.getItem('hafize.prompt-library.smart-fill.v1.p1'));
  const second = JSON.parse(t.storage.getItem('hafize.prompt-library.smart-fill.v1.p2'));
  assert.equal(first[0].name, 'Bir');
  assert.equal(second[0].name, 'İki');
  assert.notDeepEqual(first, second, 'iki istemin setleri birbirine karışmaz');
  t.restore();
}

// === Bozuk depolama sessizce boş listeye düşer ==============================
{
  const broken = createStorage();
  broken.setItem('hafize.prompt-library.smart-fill.v1.p1', '{bozuk');
  const t = await setup({ storage: broken, core: coreDouble(broken) });
  assert.doesNotThrow(() => t.controller.open(PROMPTS[0]), 'bozuk JSON paneli açmayı engellemez');
  assert.equal(t.dialog.hidden, false);
  t.restore();
}

// === `destroy()` ardında iz bırakmaz =======================================
{
  const t = await setup();
  t.controller.open(PROMPTS[0]);
  t.controller.destroy();
  assert.equal(t.env.document.getElementById('promptLibrarySmartFill'), null, 'panel DOM\'dan kaldırılır');
  assert.equal(t.card.getAttribute('data-smart-fill-ready'), null, 'yeniden mount edilebilmesi için işaret silinir');
  t.restore();
}

console.log('prompt smart fill OK: panel gerçek DOM üzerinde açılıyor, odak tuzağı kapanıyor, setler yalıtık, depolama arızası düşürmüyor');
