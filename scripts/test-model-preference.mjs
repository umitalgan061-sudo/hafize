import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const preference = require('../public/model-preference.js');

function createSelect(values) {
  const select = {
    options: [],
    listeners: new Map(),
    observers: [],
    addEventListener(type, handler) { this.listeners.set(type, handler); },
    dispatch(type) { return this.listeners.get(type)?.(); },
    setOptions(next) {
      this.options = next.map((value) => ({ value }));
      // Tarayıcı davranışı: seçenekler değişince seçim ilk seçeneğe döner.
      this._value = next[0] ?? '';
      for (const observer of this.observers) observer();
    }
  };
  Object.defineProperty(select, 'value', {
    get() { return this._value ?? ''; },
    // Gerçek <select> yalnız listede bulunan bir değeri kabul eder; bulunmayan
    // değer atandığında seçim boşalır.
    set(next) { this._value = this.options.some((option) => option.value === next) ? next : ''; }
  });
  select.setOptions(values);
  return select;
}

function createRoot(select, { storage, mutationObserver = true } = {}) {
  const root = {
    document: { querySelector: (selector) => (selector === '#modelSelect' ? select : null) },
    localStorage: storage
  };
  if (mutationObserver) {
    root.MutationObserver = class {
      constructor(callback) { this.callback = callback; }
      observe() { select.observers.push(this.callback); }
      disconnect() { select.observers = select.observers.filter((item) => item !== this.callback); }
    };
  }
  return root;
}

function createStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    map,
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => { map.set(key, String(value)); },
    removeItem: (key) => { map.delete(key); }
  };
}

const NIM_MODELS = ['meta/llama-3.3-70b-instruct', 'nvidia/nemotron-4-340b-instruct', 'mistralai/mixtral-8x22b-instruct-v0.1'];

assert.equal(preference.STORAGE_KEY, 'hafize.model.v1');
assert.ok(Object.isFrozen(preference));

assert.equal(preference.isStorableModel('meta/llama-3.3-70b-instruct'), true);
assert.equal(preference.isStorableModel('nvidia/nemotron-4-340b-instruct'), true);
assert.equal(preference.isStorableModel(''), false);
assert.equal(preference.isStorableModel(null), false);
assert.equal(preference.isStorableModel('<script>alert(1)</script>'), false);
assert.equal(preference.isStorableModel('meta/llama 3.3'), false);
assert.equal(preference.isStorableModel('/leading-slash'), false);
assert.equal(preference.isStorableModel(`meta/${'x'.repeat(preference.MAX_MODEL_LENGTH)}`), false);

assert.equal(preference.resolvePreferredModel('meta/llama-3.3-70b-instruct', NIM_MODELS), 'meta/llama-3.3-70b-instruct');
assert.equal(preference.resolvePreferredModel('meta/removed-model', NIM_MODELS), '');
assert.equal(preference.resolvePreferredModel('meta/llama-3.3-70b-instruct', []), '');
assert.equal(preference.resolvePreferredModel('', NIM_MODELS), '');
assert.equal(preference.resolvePreferredModel('meta/llama-3.3-70b-instruct', null), '');

const readable = createStorage({ 'hafize.model.v1': 'nvidia/nemotron-4-340b-instruct' });
assert.equal(preference.readStoredModel(readable), 'nvidia/nemotron-4-340b-instruct');
assert.equal(preference.readStoredModel(createStorage({ 'hafize.model.v1': 'bozuk değer' })), '');
assert.equal(preference.readStoredModel(undefined), '');

const throwing = {
  getItem() { throw new Error('DENIED'); },
  setItem() { throw new Error('DENIED'); },
  removeItem() { throw new Error('DENIED'); }
};
assert.equal(preference.readStoredModel(throwing), '');
assert.equal(preference.writeStoredModel(throwing, 'meta/llama-3.3-70b-instruct'), false);

const writable = createStorage();
assert.equal(preference.writeStoredModel(writable, 'meta/llama-3.3-70b-instruct'), true);
assert.equal(writable.map.get('hafize.model.v1'), 'meta/llama-3.3-70b-instruct');
assert.equal(preference.writeStoredModel(writable, ''), false);
assert.equal(writable.map.has('hafize.model.v1'), false);

// Kayıtlı tercih listede varsa yükleme sırasında geri getirilir.
const restoreSelect = createSelect(NIM_MODELS);
const restoreRoot = createRoot(restoreSelect, { storage: createStorage({ 'hafize.model.v1': 'mistralai/mixtral-8x22b-instruct-v0.1' }) });
const restored = preference.install(restoreRoot.document, restoreRoot);
assert.equal(restoreSelect.value, 'mistralai/mixtral-8x22b-instruct-v0.1');
assert.equal(restored.appliedModel, 'mistralai/mixtral-8x22b-instruct-v0.1');

// Model listesi `/api/models` yanıtıyla sonradan dolduğunda tercih yeniden uygulanır.
const lateSelect = createSelect(['']);
const lateStorage = createStorage({ 'hafize.model.v1': 'meta/llama-3.3-70b-instruct' });
const lateRoot = createRoot(lateSelect, { storage: lateStorage });
const late = preference.install(lateRoot.document, lateRoot);
assert.equal(late.appliedModel, '');
assert.equal(lateSelect.value, '');
lateSelect.setOptions(NIM_MODELS);
assert.equal(lateSelect.value, 'meta/llama-3.3-70b-instruct');

// Kullanıcı seçimi kaydedilir, placeholder seçenek kaydedilmez.
const changeSelect = createSelect(NIM_MODELS);
const changeStorage = createStorage();
const changeRoot = createRoot(changeSelect, { storage: changeStorage });
const change = preference.install(changeRoot.document, changeRoot);
changeSelect.value = 'nvidia/nemotron-4-340b-instruct';
assert.equal(changeSelect.dispatch('change'), true);
assert.equal(changeStorage.map.get('hafize.model.v1'), 'nvidia/nemotron-4-340b-instruct');
changeSelect.setOptions(['']);
assert.equal(change.rememberSelection(), false);
assert.equal(changeStorage.map.get('hafize.model.v1'), 'nvidia/nemotron-4-340b-instruct', 'placeholder seçenek kayıtlı tercihi silmez');

// Kullanıcının bu oturumdaki seçimi liste yenilense de geri alınmaz.
const keepSelect = createSelect(NIM_MODELS);
const keepRoot = createRoot(keepSelect, { storage: createStorage({ 'hafize.model.v1': 'meta/llama-3.3-70b-instruct' }) });
preference.install(keepRoot.document, keepRoot);
assert.equal(keepSelect.value, 'meta/llama-3.3-70b-instruct');
keepSelect.value = 'nvidia/nemotron-4-340b-instruct';
keepSelect.dispatch('change');
assert.equal(keepSelect.value, 'nvidia/nemotron-4-340b-instruct');

// Kayıtlı model listeden kalktıysa seçim tarayıcı varsayılanında kalır ve
// tercih ileride geri gelebilmek üzere korunur.
const missingStorage = createStorage({ 'hafize.model.v1': 'meta/kaldirilmis-model' });
const missingSelect = createSelect(NIM_MODELS);
const missingRoot = createRoot(missingSelect, { storage: missingStorage });
const missing = preference.install(missingRoot.document, missingRoot);
assert.equal(missing.appliedModel, '');
assert.equal(missingSelect.value, NIM_MODELS[0]);
assert.equal(missingStorage.map.get('hafize.model.v1'), 'meta/kaldirilmis-model');

// Depolama tamamen reddedilse bile kurulum hata vermez.
const deniedSelect = createSelect(NIM_MODELS);
const deniedRoot = createRoot(deniedSelect, { storage: throwing });
const denied = preference.install(deniedRoot.document, deniedRoot);
assert.equal(denied.appliedModel, '');
deniedSelect.value = 'nvidia/nemotron-4-340b-instruct';
assert.equal(deniedSelect.dispatch('change'), false);
assert.equal(deniedSelect.value, 'nvidia/nemotron-4-340b-instruct');

// MutationObserver bulunmayan ortamda tercih yine ilk kurulumda uygulanır.
const bareSelect = createSelect(NIM_MODELS);
const bareRoot = createRoot(bareSelect, { storage: createStorage({ 'hafize.model.v1': 'nvidia/nemotron-4-340b-instruct' }), mutationObserver: false });
const bare = preference.install(bareRoot.document, bareRoot);
assert.equal(bareSelect.value, 'nvidia/nemotron-4-340b-instruct');
bare.destroy();
assert.equal(preference.listSelectableModels(bareSelect).length, NIM_MODELS.length);
assert.deepEqual(preference.listSelectableModels(createSelect([''])), []);
assert.equal(preference.install({ querySelector: () => null }, {}), null);
assert.equal(preference.install(undefined, undefined), null);

console.log('model preference OK: NIM model seçimi cihazda kalıcı, doğrulanmış ve liste değişimine dayanıklı');
