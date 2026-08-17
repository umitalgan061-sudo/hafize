# Schedule Retry Policy UI Contract

## Amaç

Hafize'nin zamanlanmış görev altyapısı backend'de `retryDelayMs` politikasını zaten destekler. Bu UI katmanı yeni bir yetki veya yeni bir schedule komutu açmadan, planlanmış ve birden fazla deneme hakkı bulunan görevlerde yeniden deneme bekleme süresini görünür kullanıcı eylemiyle değiştirmeyi sağlar.

## Kullanıcı niyeti

Kontrol yalnız `status=scheduled` ve `maxAttempts > 1` olan görevlerde görünür. Kullanıcı önce `Yeniden deneme aralığı` kontrolünü açar, allowlist içinden bir süre seçer ve `Aralığı kaydet` düğmesine basar. PATCH gönderilmeden önce ayrıca açık confirmation gerekir. Confirmation reddedilirse network isteği yapılmaz.

## Bounded seçenekler

Renderer serbest sayı kabul etmez. İzinli süreler:

- 1 dakika
- 5 dakika
- 15 dakika
- 1 saat
- 6 saat
- 24 saat

Bu değerler backend'in mevcut güvenli aralığının içinde kalır. Beklenmeyen, NaN, kesirli veya allowlist dışı süreler istemci tarafında network öncesi reddedilir.

## HTTP sözleşmesi

İstek yalnız `PATCH /api/schedules/:scheduleId` yoluna gider. Body exact olarak `{ "retryDelayMs": <allowlisted integer> }` biçimindedir. `credentials: same-origin` ve `cache: no-store` kullanılır. Authorization header, bearer token veya cookie değeri renderer tarafından okunmaz ya da üretilmez.

Backend tarafında mevcut schedule command boundary değişmeden kalır: authenticated principal zorunludur, kayıt aynı owner'a ait olmalıdır ve yalnız `scheduled` görev yeniden düzenlenebilir. Running/completed/failed/cancelled görevler fail-closed reddedilir.

## Veri ve secret sınırı

Bu UI localStorage, sessionStorage, IndexedDB, document.cookie veya clipboard kullanmaz. `ownerId`, `traceId`, token, signing key, OAuth secret veya provider credential istemci durumuna taşınmaz. Görev metni yeni bir storage alanına kopyalanmaz.

## Tool permission sınırı

Retry aralığını değiştirmek ajan tool yetkisini genişletmez. Görev daha sonra çalıştığında agent registry, provider sınırı ve backend default-deny tool policy normal biçimde uygulanır. GitHub/Gmail/Canva gibi dış write/send/merge işlemleri kendi açık approval sınırlarını ayrıca geçmek zorundadır.

## Lifecycle

Başarılı PATCH sonrasında mevcut `hafize:schedule-rescheduled` olayı yayınlanır ve schedule listesi authoritative backend GET ile yenilenir. Dinamik enhancement yükleme yarışında kart henüz oluşmamışsa auto-mount en fazla 10 saniye bekler; timeout veya mount sonrasında observer/timer temizlenir. Escape açık formu kapatır ve odağı toggle düğmesine geri verir.

## Geri alma

Revert için `schedule-retry-policy.js/.css`, ilgili loader/PWA kayıtları, schedule-list `data-max-attempts` görünürlük metadata'sı, testler ve bu belge kaldırılır. Backend schedule store veya persistent schema migrasyonu yoktur.
