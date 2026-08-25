# Device action HTTP boundary

`lib/device-action-http-boundary.mjs`, authenticated server katmanı ile `device-action-runtime` arasında dar bir façade sağlar. Bu modül kendi başına HTTP server açmaz ve Electron capability oluşturmaz; server yalnız doğrulanmış `principal`, `traceId` ve seçilmiş ajanı trusted context olarak geçirir.

## Endpoint sözleşmesi

- `POST /api/device/system-info`
- `POST /api/device/reviews`
- `POST /api/device/reviews/:reviewId/confirm`
- `DELETE /api/device/reviews/:reviewId`

Client body içinde `principal`, `traceId`, `approvalToken`, `explicitUserIntent` veya başka ek alan kabul edilmez. Browser/app request yalnız `action` ve ona ait `url`/`appId` alanlarını taşıyabilir.

## Güvenlik

Principal ve trace kimliği request body'den alınmaz; backend authentication/trace middleware tarafından context'e verilmelidir. Review cevabı sanitize edilmiş sunumu taşır, approval token hiçbir HTTP cevabında görünmez. Confirm aynı exact request'i runtime'a iletir; owner/trace/target bağları runtime + lease katmanında tekrar doğrulanır.

HTTP façade alt runtime'a güvenmekle yetinmez: browser review hedefinde query/fragment/credential varsa sonucu reddeder, app ID biçimini tekrar doğrular ve system-info cevabını yalnız `platform`, `arch`, `release`, `hostname` alanlarıyla sınırlar. Bilinmeyen runtime/internal hata metinleri public response'a taşınmaz.

Bu façade shell, executable path, HTTP URL, dış mesaj gönderme veya repo merge yetkisi sağlamaz. NVIDIA NIM ana sağlayıcı ve provider-independent backend default-deny tool policy değişmez.

## Server entegrasyonu

Gerçek `server.mjs` wiring yapılırken authentication middleware principal'ı doğrulamalı, trace middleware güvenilir trace üretmeli ve public body bu kimlikleri override edememelidir. Electron bridge yalnız backend runtime üzerinden çağrılmalıdır.

## Test

`scripts/test-device-action-http-boundary.mjs` strict body allowlist, trusted principal/trace context, owner mismatch, per-owner review sınırı, approval-token/query redaction, bağımsız response sanitization, route allowlist ve public error mapping davranışlarını doğrular.
