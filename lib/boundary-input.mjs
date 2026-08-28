// Sınır girdisi normalizasyonu.
//
// JavaScript'te bir `= {}` varsayılan parametresi yalnız `undefined` için
// devreye girer. `null`, bir sayı veya bir dizi geçirildiğinde destructuring
// ham bir `TypeError` fırlatır ve sınırın kendi sözleşme hatası (`INVALID_*`)
// hiç üretilmez. Bu, çağıranın hatayı sözleşme ihlali olarak sınıflandırmasını
// engeller ve sınır doğrulamasının atlanmış gibi görünmesine yol açar.
//
// Bu yüzden sınır fonksiyonları girdilerini destructuring'den ÖNCE buradan
// geçirir.

/**
 * Girdiyi destructuring için güvenli bir düz nesneye indirger.
 *
 * @param {unknown} value Sınıra gelen ham girdi.
 * @param {string} field Sözleşme hatasında kullanılacak alan adı.
 * @param {(field: string) => Error | never} onInvalid Sözleşme hatasını
 *   fırlatan ya da döndüren sınır-yerel yardımcı.
 * @returns {object} `undefined` için boş nesne, geçerli nesne için kendisi.
 */
export function requireObjectInput(value, field, onInvalid) {
  if (value === undefined) return {};
  if (!value || Array.isArray(value) || typeof value !== 'object') {
    // `onInvalid` iki biçimde de yazılabilir: hatayı fırlatan (`fail`) ya da
    // hatayı döndüren (`invalid`). İkisi de burada fırlatmayla sonuçlanır.
    const error = onInvalid(field);
    throw error instanceof Error ? error : new Error(`INVALID_BOUNDARY_INPUT:${field}`);
  }
  return value;
}
