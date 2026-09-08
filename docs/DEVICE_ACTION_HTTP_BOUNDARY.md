# Device action HTTP boundary

`lib/device-action-http-boundary.mjs`, authenticated server katmanı ile `device-action-runtime` arasında dar bir façade sağlar. Modül kendi başına HTTP server açmaz ve Electron capability oluşturmaz.

## Endpoint sözleşmesi

- `POST /api/device/system-info`
- `POST /api/device/reviews`
- `POST /api/device/reviews/:reviewId/confirm`
- `DELETE /api/device/reviews/:reviewId`

Public body içinde `principal`, `traceId`, `approvalToken`, `explicitUserIntent` veya başka ek alan kabul edilmez. Principal ve trace yalnız güvenilir server context'ten runtime'a geçirilir.

Browser/app request'i yalnız action ve ilgili target alanını taşıyabilir. Request allowlist dışındaki alanlarla fail-closed reddedilir.

## Response izolasyonu

Review response'u yalnız güvenli sunum alanlarını döndürür. Browser hedefinde yalnız origin + pathname gösterilir; query string, fragment ve credential değerleri dışarı çıkmaz. Approval token hiçbir HTTP response'una eklenmez.

Runtime sonucundan dönen system info yalnız `platform`, `arch`, `release`, `hostname` alanlarıyla sınırlandırılır. Bilinmeyen runtime/internal hata metinleri public response'a taşınmaz.

## Güvenlik sınırı

Bu façade shell, executable path, HTTP URL, external send veya repo merge yetkisi sağlamaz. Device permission ve user approval kararları provider'dan bağımsız backend runtime'da kalır.

Gerçek `server.mjs` entegrasyonunda authentication middleware principal'ı, trace middleware trace kimliğini üretmeli; public request body bunları override edememelidir. Electron bridge yalnız güvenli runtime zinciri üzerinden çağrılmalıdır.

## Test

`scripts/test-device-action-http-boundary.mjs` strict request body allowlist, trusted principal/trace forwarding, owner mismatch/limit, app deny, cancellation, route allowlist, query/token redaction ve bağımsız response sanitization regresyonlarını doğrular.
