# Personal Memory HTTP Security

Bu belge authenticated personal-memory kontrol yüzeyinin HTTP giriş kurallarını sabitler.

## Temel ilke

`/api/memory` bir model tool'u değildir. Bellek yazma, export ve silme işlemleri yalnız açık kullanıcı niyetine bağlı HTTP kontrol yüzeyidir. Client veya model `ownerId`, token, secret ya da storage yolu seçemez.

## Read query sözleşmesi

GET `/api/memory` yalnız şu query alanlarını kabul eder:

- `query` — zorunlu, boş olamaz, personal-memory contract uzunluk sınırına tabidir.
- `kinds` — opsiyonel, virgülle ayrılmış ve yalnız contract içindeki memory kind değerleri.
- `limit` — opsiyonel, yalnız pozitif tam sayı ve contract `maxReadLimit` sınırı içinde.

Bilinmeyen query alanları, aynı alanın birden fazla kez verilmesi, duplicate/unknown kind, `NaN`, ondalık, exponent biçimli veya limit dışı değerler storage katmanına ulaşmadan 400 ile reddedilir.

## Mutation sözleşmesi

Write/export/delete body'leri exact-field doğrulamasından geçer. `ownerId`, bearer token veya bilinmeyen alan eklemek request'i geçersiz yapar.

- write: `explicitUserIntent:true` zorunlu;
- export: `explicitUserIntent:true` zorunlu;
- tek kayıt silme: `explicitUserIntent:true` ve `exactMatch:true` zorunlu;
- tüm owner belleğini silme: `explicitUserIntent:true` ve ayrıca `confirmDeleteAll:true` zorunlu.

## Hata sanitizasyonu

Storage/runtime katmanından gelen keyfi hata metni public response'a aynen taşınmaz. Başarısız storage sonucu `MEMORY_OPERATION_FAILED` olarak normalize edilir; dosya yolu, provider detayı, owner scope veya secret benzeri iç bilgiler response'a çıkmaz.

## Owner isolation

Authenticated principal backend'de opaque owner scope'a dönüştürülür. Request body/query üzerinden owner override yoktur. Başarılı record response'larında dahili `ownerId` alanı temizlenir.

## Bilinçli sınır

Bu güvenlik katmanı tek başına server route wiring açmaz. `server.mjs` entegrasyonu yalnız memory runtime gerçekten configured olduğunda route'u expose etmeli, health'te yalnız boolean capability yayınlamalı ve mevcut model tool catalog'a `memory.write`/`memory.delete` eklememelidir.
