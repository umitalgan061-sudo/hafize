# Schedule liste yanıtı sınırı

`GET /api/schedules` authenticated owner'ın tüm kayıtlarını sınırsız JSON olarak istemciye taşımamalıdır. Hafize bu nedenle HTTP boundary'de bounded bir liste sözleşmesi uygular.

## Varsayılan politika

- En fazla **200** schedule kaydı döndürülür.
- Test/enjeksiyon için limit **1–500** aralığında olmalıdır.
- Liste 200 veya daha az kayıtsa mevcut command çıktısı değiştirilmeden korunur.
- Liste kesildiyse `listMeta.returned`, `listMeta.total` ve `listMeta.truncated: true` eklenir.

## Aktif görev önceliği

Owner başına aktif schedule sınırı varsayılan 100 olduğundan bounded liste tüm aktif görevleri görünür tutacak şekilde tasarlanmıştır.

Öncelik sırası:

1. `scheduled`
2. `running`
3. kalan kapasite kadar en yeni terminal kayıtlar

Aktif ve terminal grupların kendi içinde en güncel zaman önce gelir. `updatedAt`, ardından `createdAt`, ardından `runAt` kullanılır; eşitlikte numeric `schedule_N` kimliği tie-break sağlar.

Aktif görev sayısı liste limitini aşarsa yalnız en yeni aktif kayıtlar döner. Production owner aktif sınırı 100 ve production liste limiti 200 olduğu için normal Hafize akışında bu durum beklenmez; helper yine fail-safe bounded kalır.

## Neden HTTP boundary?

Command boundary owner isolation ve authorization kararını verir; storage authoritative geçmişi korur. Liste truncation yalnız transport/response-size politikasıdır. Bu nedenle:

- kalıcı kayıt silinmez;
- snapshot schema değişmez;
- worker davranışı değişmez;
- create/reschedule/cancel yolları etkilenmez;
- UI'nın istemeden çok büyük geçmiş yüklemesi önlenir.

## Güvenlik

Authentication liste command'ından önce uygulanmaya devam eder. Boundary yeni fetch, connector, token, cookie veya secret okumaz. Ajan tool policy, external write/send/merge approval ve dört profilli roster değişmez.

## Geri alma

`schedule-list-boundary.mjs` ve `schedule-http-api.mjs` içindeki tek GET wiring'i kaldırılır. Kalıcı veri veya schema değişmediği için migration gerekmez.
