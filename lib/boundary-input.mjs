// Güvenlik sınırlarının ortak giriş koruması.
//
// `function f({ a, b } = {})` biçimindeki imzalar yalnızca `undefined` için
// varsayılan uygular; `null` geldiğinde ham bir `TypeError` sızar. Sınır
// modülleri bunun yerine kendi sözleşme hatalarını üretmelidir. Bu yardımcı,
// nesne olmayan her girdiyi boş nesneye indirger; böylece sonraki doğrulama
// adımları normal şekilde çalışır ve sınır fail-closed kalır.

const EMPTY = Object.freeze({});

export function isPlainInput(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function optionsOf(value) {
  return isPlainInput(value) ? value : EMPTY;
}
