// Ayrımlı birleşim sonuçları için ortak doğrulayıcılar.
//
// `lib/` sınırlarının çoğu `{ ok: false, error }` ya da `{ ok: true, … }`
// döndürür. Kontrol paketleri uzun süre başarılı dalın alanını doğrudan
// okuyordu (`result.records.map(…)`); bu iki şeyi birden kaçırıyordu:
//
//   • `ok`un gerçekten `true` olduğunu kimse doğrulamıyordu, yani sessizce
//     başarısız olan bir çağrı `undefined.map is not a function` gibi alakasız
//     bir hatayla patlıyordu — gerçek nedeni söylemeden.
//   • TypeScript birleşimi daraltamıyordu, çünkü daraltma bir karşılaştırma
//     ister.
//
// Bu yardımcılar önce ayrımcıyı doğrular, sonra değeri verir. Böylece hata
// mesajı da doğru yeri gösterir.
//
// Bu dosya `test-*` deseniyle eşleşmediği için `run-checks.mjs` onu paket
// olarak çalıştırmaz; yalnızca içe aktarılır.
import assert from 'node:assert/strict';

/**
 * `ok: true` dalını doğrular ve sonucu döndürür.
 *
 * @param {{ ok?: unknown } | null | undefined} result
 * @param {string} [label] hata mesajına eklenecek bağlam
 * @returns {any}
 */
export function expectOk(result, label = 'sonuç') {
  assert.equal(result?.ok, true, `${label}: başarılı dal bekleniyordu, gelen: ${describe(result)}`);
  return result;
}

/**
 * `ok: false` dalını doğrular ve hata alanını döndürür.
 *
 * @param {{ ok?: unknown; error?: unknown } | null | undefined} result
 * @param {string} [label]
 * @returns {any}
 */
export function expectError(result, label = 'sonuç') {
  assert.equal(result?.ok, false, `${label}: başarısız dal bekleniyordu, gelen: ${describe(result)}`);
  return /** @type {any} */ (result).error;
}

/**
 * `matched: true` dalını doğrular ve yanıtı döndürür.
 *
 * HTTP yönlendirme yüzeyi `ok` yerine `matched` ile ayrılır.
 *
 * @param {{ matched?: unknown } | null | undefined} result
 * @param {string} [label]
 * @returns {any}
 */
export function expectMatched(result, label = 'yanıt') {
  assert.equal(result?.matched, true, `${label}: eşleşen yanıt bekleniyordu, gelen: ${describe(result)}`);
  return result;
}

/** Hata mesajı için kısa, güvenli bir özet. */
function describe(value) {
  try {
    const text = JSON.stringify(value);
    return text === undefined ? String(value) : text.slice(0, 200);
  } catch {
    return String(value);
  }
}
