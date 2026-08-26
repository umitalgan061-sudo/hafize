const EMPTY_INPUT = Object.freeze({});

export function isRecordInput(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Sınır (boundary) giriş nesnesini sözleşmeye bağlar.
 *
 * `function f({ a } = {})` biçimi yalnız `undefined` için varsayılan uygular; `null`,
 * dizi veya ilkel değerlerde ham `TypeError` fırlatır ve modülün kendi hata kodu
 * sözleşmesi atlanır. Bu yardımcı, geçersiz girişi her zaman modülün kendi hatasına
 * çevirir.
 *
 * @param {unknown} value Çağıranın verdiği ham giriş.
 * @param {(field: string) => Error | void} onInvalid Modülün hata üreticisi; hatayı
 *   döndürebilir veya doğrudan fırlatabilir.
 * @param {string} field Hata kodunda kullanılacak alan etiketi.
 * @returns {Record<string, unknown>} Doğrulanmış giriş nesnesi.
 */
export function requireRecordInput(value, onInvalid, field = 'input') {
  if (value === undefined) return EMPTY_INPUT;
  if (isRecordInput(value)) return value;

  let error = null;
  try {
    error = typeof onInvalid === 'function' ? onInvalid(field) : null;
  } catch (thrown) {
    error = thrown;
  }
  throw error instanceof Error ? error : new Error(`INVALID_BOUNDARY_INPUT:${field}`);
}

/**
 * Hata fırlatmak yerine sonuç nesnesi döndüren sınırlar için: geçerli girişi,
 * yoksa `null` döndürür. Çağıran kendi hata sözleşmesini uygular.
 *
 * @param {unknown} value Çağıranın verdiği ham giriş.
 * @returns {Record<string, unknown> | null}
 */
export function optionalRecordInput(value) {
  if (value === undefined) return EMPTY_INPUT;
  return isRecordInput(value) ? value : null;
}
