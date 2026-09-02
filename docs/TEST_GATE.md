# Test gate

Hafize'nin statik/smoke doğrulama kapısı tek bir keşif tabanlı koşucudur:
`scripts/run-tests.mjs`.

## Komutlar

| Komut | Ne yapar |
| --- | --- |
| `npm test` / `npm run check` | Sözdizimi kontrolü + tüm gate script'leri |
| `npm run precheck` | Yalnız sözdizimi kontrolü (`node --check`) |
| `node scripts/run-tests.mjs gmail` | Adında `gmail` geçen gate script'leri |
| `node scripts/run-tests.mjs --tests` | Sözdizimi adımını atlar |

Gate başarısızsa çıkış kodu `1`'dir ve başarısız dosyanın tam çıktısı yazdırılır.

## Neden keşif tabanlı

Önceki gate, `package.json` içinde elle bakımı yapılan tek satırlık uzun bir
`node --check ... && node scripts/... && ...` zinciriydi. Yeni bir test dosyası
eklenip bu zincire eklenmeyi unuttuğunda test sessizce hiç çalışmıyordu.

Bu, gerçek bir soruna yol açtı: gate'e hiç eklenmemiş **32 test dosyası** vardı
(tüm OAuth, token şifreleme, kişisel bellek runtime, Canva/Google token exchange
ve screen-share testleri dahil) ve gate zincirinin kendisi de kırıktı.

Koşucu artık şunları diskten keşfeder:

- **Sözdizimi hedefleri:** `lib/*.mjs`, `scripts/*.mjs`, `public/*.js`
- **Gate script'leri:** `scripts/test-*.mjs` ve `scripts/validate-*.mjs`

Böylece dosyayı eklemek onu gate'e eklemek için yeterlidir; ayrıca bir kayıt
listesi tutulmaz.

## Gate'i koruyan test

`scripts/test-gate-coverage.mjs` aynı sürüklenmenin tekrarını engeller:

- `test`, `check` ve `precheck` komutları koşucuya bağlı kalmalı ve elle bakımı
  yapılan `&&` zincirine geri dönmemelidir;
- koşucu test listesini sabit kodlamamalı, dizinden okumalıdır;
- `scripts/` altındaki her `.mjs` dosyası ya bir gate script'i ya da koşucunun
  kendisi olmalıdır — gate dışında kalan dosya bırakılamaz.

## Yeni test eklerken

1. Dosyayı `scripts/test-<konu>.mjs` olarak oluştur.
2. Başarıda tek satırlık bir özet yazdır; koşucu bu satırı özet olarak gösterir.
3. Başarısızlıkta sıfırdan farklı çıkış kodu üret (`node:assert/strict` yeterlidir).
4. Harici canlı servis gerekiyorsa ortam değişkeni yoksa test kendini atlamalıdır
   (örnek: `scripts/test-redis-schedule-lease-live.mjs`).

Testler ayrı alt süreçlerde ve 120 saniyelik zaman sınırıyla çalışır; asılı kalan
bir test gate'i sonsuza kadar bloke etmez.
