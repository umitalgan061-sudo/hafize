// Ortak istek girişi normalizasyonu.
//
// Sınır (boundary) fonksiyonlarının çoğu `function f({ a, b } = {})` biçiminde
// yazılmıştır. Bu varsayılan yalnızca argüman `undefined` olduğunda devreye
// girer; `null`, dizi veya ilkel bir değer geldiğinde JavaScript dilin kendi
// `TypeError`'ını fırlatır. Bu durumda modülün kendi `INVALID_*` doğrulama
// sözleşmesi atlanır ve çağıran taraf beklemediği bir hata tipiyle karşılaşır.
//
// Bu yardımcı, girişi doğrulama katmanına girmeden önce güvenli bir nesneye
// indirger; uygun olmayan girişlerde modülün kendi `fail` fonksiyonunu çağırır.

export function isPlainRequestObject(value) {
  return Boolean(value) && !Array.isArray(value) && typeof value === 'object';
}

export function normalizeRequestInput(value, fail, field = 'request') {
  if (typeof fail !== 'function') throw new TypeError('INVALID_REQUEST_NORMALIZER');
  if (value === undefined) return {};
  if (isPlainRequestObject(value)) return value;
  fail(field);
  // `fail` her zaman fırlatmalıdır; fırlatmayan bir uygulama geçersiz girişi
  // doğrulama katmanına sızdırmasın diye burada kesin olarak durdurulur.
  throw new Error(`INVALID_REQUEST_INPUT:${field}`);
}
