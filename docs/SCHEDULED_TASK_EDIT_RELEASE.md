# Schedule Edit Release

## Kod
- [x] Store `update` mutationı eklendi.
- [x] Persistence update'i sıraya alıyor.
- [x] Command boundary ownership ve credential kontrolü yapıyor.
- [x] HTTP API PATCH sunuyor.
- [x] UI edit ve quick postpone akışlarını sunuyor.

## Güvenlik
- [x] ownerId response'dan çıkarılıyor.
- [x] `/api/` cache dışı tutuluyor.
- [x] Credential policy create/update sırasında uygulanıyor.
- [x] Çalışan görev edit edilemiyor.

## UX
- [x] Mevcut değerler forma taşınıyor.
- [x] Düzenleme iptali var.
- [x] Mobil düğme yerleşimi var.
- [x] Status mesajları erişilebilir.

## Test
Store, persistence, API, HTTP, auth, credential, validation, UI, keyboard, PWA, no-cache, state ve regression kontrolleri eklenmiştir.

## Rollback
PR revert edilir. Önceki GET/POST/DELETE endpointleri ve worker state machine çalışmaya devam eder.
