(function exposeHafizeModelPreference(root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module?.exports) module.exports = api;
  else {
    root.HafizeModelPreference = api;
    const install = () => api.install(root.document, root);
    if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', install, { once: true });
    else install();
  }
})(typeof globalThis !== 'undefined' ? globalThis : self, function createHafizeModelPreference() {
  'use strict';

  // Model listesi `/api/models` yanıtından doldurulur ve seçim tarayıcı
  // varsayılanı olarak her zaman ilk seçeneğe düşer. Kullanıcının seçtiği NIM
  // modeli bu yüzden her yeniden yüklemede kayboluyordu. Tercih yalnız bu
  // cihazda, düz metin model kimliği olarak saklanır; secret veya oturum
  // bilgisi taşımaz.
  const STORAGE_KEY = 'hafize.model.v1';
  const MAX_MODEL_LENGTH = 200;
  // NVIDIA NIM kimlikleri `publisher/model-name` biçimindedir. Desen, bozuk
  // veya enjekte edilmiş bir depolama değerinin seçeneklerle karşılaştırılmadan
  // önce elenmesini sağlar.
  const MODEL_PATTERN = /^[a-z0-9][a-z0-9._-]*(?:\/[a-z0-9][a-z0-9._-]*)*$/i;

  function isStorableModel(value) {
    return typeof value === 'string'
      && value.length > 0
      && value.length <= MAX_MODEL_LENGTH
      && MODEL_PATTERN.test(value);
  }

  function readStoredModel(storage) {
    try {
      const value = storage?.getItem?.(STORAGE_KEY);
      return isStorableModel(value) ? value : '';
    } catch {
      // Depolama erişimi reddedilebilir (private mode, kota, kilitli profil);
      // tercih okunamaması sohbeti engellemez.
      return '';
    }
  }

  function writeStoredModel(storage, value) {
    try {
      if (!isStorableModel(value)) {
        storage?.removeItem?.(STORAGE_KEY);
        return false;
      }
      storage?.setItem?.(STORAGE_KEY, value);
      return true;
    } catch {
      return false;
    }
  }

  function listSelectableModels(select) {
    const options = select?.options ? [...select.options] : [];
    return options
      .map((option) => (typeof option?.value === 'string' ? option.value : ''))
      .filter((value) => value.length > 0);
  }

  function resolvePreferredModel(stored, models) {
    if (!isStorableModel(stored)) return '';
    const available = Array.isArray(models) ? models : [];
    // Silinmiş veya erişilemeyen bir model seçilmeye çalışılmaz; liste
    // yeniden geldiğinde tercih hâlâ geçerliyse tekrar uygulanabilsin diye
    // saklanan değer temizlenmez.
    return available.includes(stored) ? stored : '';
  }

  function install(documentRef, root) {
    const select = documentRef?.querySelector?.('#modelSelect');
    if (!select) return null;
    const storage = root?.localStorage;

    function applyStoredModel() {
      const preferred = resolvePreferredModel(readStoredModel(storage), listSelectableModels(select));
      if (!preferred || select.value === preferred) return '';
      select.value = preferred;
      // Seçenek listesi tercihi kabul etmediyse (option kaldırılmış) tarayıcı
      // değeri boşa çeker; bu durumda uygulanmış sayılmaz.
      return select.value === preferred ? preferred : '';
    }

    function rememberSelection() {
      const value = typeof select.value === 'string' ? select.value : '';
      // "Modeller yükleniyor…" gibi boş değerli placeholder seçenekler tercih
      // olarak kaydedilmez.
      if (!value) return false;
      return writeStoredModel(storage, value);
    }

    const applied = applyStoredModel();
    select.addEventListener?.('change', rememberSelection);

    // Liste `/api/models` yanıtı geldiğinde tek seferde değiştirilir; tercih o
    // andan önce uygulanamaz. Gözlemci, seçenekler yenilendiğinde tercihi
    // yeniden dener ve kullanıcının bu oturumdaki seçimini geri almaz.
    const observer = typeof root?.MutationObserver === 'function'
      ? new root.MutationObserver(() => { applyStoredModel(); })
      : null;
    observer?.observe?.(select, { childList: true });

    return Object.freeze({
      applyStoredModel,
      rememberSelection,
      appliedModel: applied,
      destroy: () => observer?.disconnect?.()
    });
  }

  return Object.freeze({
    STORAGE_KEY,
    MAX_MODEL_LENGTH,
    isStorableModel,
    readStoredModel,
    writeStoredModel,
    listSelectableModels,
    resolvePreferredModel,
    install
  });
});
