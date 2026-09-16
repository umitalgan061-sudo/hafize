# Prompt Library Migration Contract

Yeni trust araçları mevcut Prompt Library kaydını yerinde dönüştürmez; yalnız okuma, normalize etme ve kullanıcı onaylı yazma katmanı sağlar.

## V1 storage

Ana prompt storage `hafize.prompt-library.v1` olarak kalır. Prompt id formatı değişmez. Başlık, gövde, tags, variables, favorite, useCount, createdAt ve updatedAt mevcut normalizer ile işlenir.

## Yeni storage

Smart profile, session veya diagnostic gibi ek veriler ayrı sürümlü anahtarlarda tutulur. Hiçbir yeni anahtar eski prompt storage'ına ham veri enjekte etmez.

## Import migration

Eski export array biçiminde ise `normalizeImportedPayload` bunu doğrudan kabul eder. Yeni object biçimi `version`, `source`, `exportedAt` ve `items` alanlarını destekler. Bilinmeyen metadata alanları kaydedilmez.

## Collision policy

Aynı id ile gelen import kaydı mevcut prompt'un yerine geçmez. Merge katmanı yeni id üretir. Böylece import bir overwrite mekanizması değildir.

## Capacity policy

Kütüphane 120 kaydı geçmez. Import kapasiteyi aşıyorsa kullanılabilir slot kadar kayıt alınır. Kullanıcı preview aşamasında overflow sayısını görür.

## Collections

Collection üyeleri prompt id referanslarıdır. Prompt silindiğinde collection verisi otomatik olarak sessizce bozulmuş bırakılmaz; diagnostics ile yetim referanslar bulunup kullanıcı onayıyla budanabilir.

## Rollback

Yeni modüller kaldırıldığında ana storage alanı okunabilir kalır. Trust modüllerinin kaldırılması mevcut prompt kayıtlarını otomatik silmez.

## Compatibility

Import preview başarısız olursa temel import yolu güvenli biçimde hata verir. Diagnostics çalışmazsa temel Prompt Library devam eder. Bulk organizer çalışmazsa tekli prompt actions etkilenmez.

## DoD

- eski prompt export içe alınabilir,
- duplicate id overwrite oluşturmaz,
- capacity bounded kalır,
- yeni metadata eski kayda karışmaz,
- eski prompt kullanımı yeni UI tarafından okunabilir.
