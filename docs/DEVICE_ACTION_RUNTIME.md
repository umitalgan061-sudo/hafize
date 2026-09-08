# Device action runtime

`lib/device-action-runtime.mjs`, Hafize'nin model/provider tool isteği ile Electron device bridge arasındaki güvenilir orkestrasyon sınırıdır. Yeni işletim sistemi yeteneği eklemez; mevcut `system.info`, `browser.open` ve `app.open` sözleşmelerini tek fail-closed akışta birleştirir.

## Akış

1. Ortak `traceId` zorunludur.
2. `system.info` salt-okunur yoldan doğrudan yürütülür.
3. Browser/app eylemleri backend agent permission'dan geçer.
4. App açma isteği review öncesinde exact bridge allowlist ile kontrol edilir.
5. Review yalnız sanitize edilmiş hedefi dışarı verir; approval token caller'a dönmez.
6. Kullanıcı confirm'i internal approval lease üretir.
7. Audit sink varsa redacted event yazılır.
8. Audit yazımı başarısızsa review/lease iptal edilir ve yan etki çalışmaz.
9. Tool boundary lease'i exact `traceId + action + target` ile tüketir.
10. Ancak bundan sonra backend `explicitUserIntent: true` değerini bridge'e ekler.

## Public yüzey

- `executeReadOnly(agent, request, { traceId })`
- `beginReview(agent, request, { traceId, ttlMs })`
- `confirmAndExecute(agent, request, { reviewId, traceId })`
- `cancelReview(reviewId)`

`confirmAndExecute` token'ı caller/model/UI'ya vermez.

## Güvenlik

Browser URL HTTPS-only ve credential-free kalır. App açma yalnız ürün allowlist'i ile yapılır. Raw shell, `child_process`, executable path ve model-generated approval/intention alanları yoktur. Provider seçimi bu authorization akışını değiştiremez.
