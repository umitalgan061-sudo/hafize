# Device action runtime

`lib/device-action-runtime.mjs`, Hafize'nin model/provider tool isteği ile Electron device bridge arasındaki güvenilir orkestrasyon sınırıdır. Bu katman yeni bir işletim sistemi yeteneği eklemez; mevcut `system.info`, `browser.open` ve `app.open` sözleşmelerini tek, fail-closed akışta birleştirir.

## Neden ayrı runtime var?

Düşük seviye bridge yalnız teknik capability sınırını, tool boundary ajan yetkisini, review store kullanıcıya gösterilecek güvenli onay oturumunu ve lease store tek-kullanımlık onayı yönetir. Bunların çağıran tarafından yanlış sırada bağlanması onay token'ının UI/model katmanına sızmasına veya audit/review adımlarının atlanmasına yol açabilirdi.

`device-action-runtime` bu sırayı sabitler:

1. Ortak `traceId` zorunludur.
2. `system.info` yalnız salt-okunur yoldan doğrudan yürütülür.
3. Browser/app eylemleri önce backend default-deny ajan izninden geçer.
4. App açma isteği review oluşturulmadan önce bridge'in exact allowlist'iyle karşılaştırılır.
5. Review yalnız sanitize edilmiş hedefi döndürür; approval token dönmez.
6. Kullanıcı onayı sonrasında review internal lease üretir.
7. Audit sink yapılandırılmışsa approval öncesi event güvenle yazılmalıdır.
8. Audit yazımı başarısız olursa lease revoke edilir ve cihaz yan etkisi çalışmaz.
9. Tool boundary lease'i exact `traceId + action + target` ile tüketir.
10. Yalnız bundan sonra bridge'e backend tarafından `explicitUserIntent: true` eklenir.

## Public yüzey

Runtime'ın public metotları:

- `executeReadOnly(agent, request, { traceId })`
- `beginReview(agent, request, { traceId, ttlMs })`
- `confirmAndExecute(agent, request, { reviewId, traceId })`
- `cancelReview(reviewId)`

`confirmAndExecute` approval token'ını caller'a döndürmez. Token yalnız process içindeki review/lease/tool-boundary zincirinde yaşar.

## Audit davranışı

`auditSink` opsiyoneldir. Sağlanırsa sink'e yalnız `device-approval-audit` tarafından sanitize edilmiş event gönderilir. Raw query/fragment, approval token veya credential audit payload'ına girmez.

Audit sink'in hata vermesi güvenlik açısından **fail closed** kabul edilir:

- review başlangıcında hata olursa review iptal edilir;
- confirm sonrasında hata olursa yeni lease revoke edilir;
- iki durumda da browser/app yan etkisi çalışmaz.

## App allowlist

Review UI'da onaylanamayacak uygulamaları göstermemek için runtime, `deviceBridge.allowedApps` listesini review öncesi kontrol eder. Bu sadece erken doğrulamadır; düşük seviye bridge execution sırasında allowlist'i tekrar doğrular. Raw executable path veya shell komutu desteklenmez.

## Provider bağımsızlığı

NVIDIA NIM ana sağlayıcıdır. Local/Ollama veya gelecekteki başka bir provider yalnız tool isteği önerebilir. Runtime, ajan izinleri, review, lease ve device bridge kararlarını provider'dan bağımsız uygular.

## Güvenlik sınırları

- model approval veya `explicitUserIntent` assert edemez;
- approval token UI/model/ajan çıktısına verilmez;
- browser URL HTTPS-only kalır;
- URL credential reddedilir;
- app açma exact ürün allowlist'idir;
- raw shell, `child_process`, executable path veya deny-list komut güvenliği yoktur;
- secret ve credential değerleri ajan bağlamına taşınmaz;
- `.env`, credential ve `.github/workflows/` değişikliği gerekmez.

## Test

`scripts/test-device-action-runtime.mjs` salt-okunur system info, agent default-deny, redacted review, exact target binding, replay, wrong trace, expiry/cancel, app allowlist ve fail-closed audit davranışlarını kapsar.
