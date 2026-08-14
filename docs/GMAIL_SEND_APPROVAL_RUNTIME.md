# Gmail send exact-message approval runtime

Bu katman Gmail gönderimini doğrudan production tool olarak açmaz. Amaç, gelecekteki `gmail_send` yürütmesinden önce kullanıcı onayını exact message içeriğine bağlayan backend sınırını sabitlemektir.

## Güvenlik sözleşmesi

- Onay yalnız authenticated connector principal için üretilebilir.
- `userConfirmed: true` olmadan approval token üretilemez.
- Token ownerId + alıcı listesi + konu + düz metin gövdenin SHA-256 fingerprint'ine bağlıdır.
- HMAC anahtarı `HAFIZE_GMAIL_SEND_APPROVAL_KEY_B64` ile server-side tutulur; model veya istemci bundle'ına girmez.
- Token varsayılan 120 saniye yaşar ve aynı process içinde tek kullanımlıdır.
- Token değişmiş recipient, subject, body veya başka owner için geçersizdir.
- Raw principal, ownerId, approval secret ve token generic ajan context'ine taşınmaz; token request-scoped closure içinde tutulur.
- Send client ayrıca owner-scoped Google token kaydı ve `gmail.send` OAuth scope'unu zorunlu tutmaya devam eder.

## Geriye uyumluluk

Approval secret yapılandırılmamışsa mevcut Gmail runtime read-only çalışmaya devam eder ve önceki status/context response shape'i korunur. Bu sayede read-only connector davranışı send özelliğine bağlı hale gelmez.

## Production'a açılmadan önce

`gmail_send` hâlâ `lib/tool-runtime.mjs`, agent registry veya server route'a kayıt edilmemelidir. Production aktivasyonu için ayrıca:

1. UI'da kullanıcıya exact alıcı/konu/gövdeyi gösteren açık onay aksiyonu,
2. approval token'ını yalnız bu aksiyondan sonra alan server endpoint'i,
3. token'ın `/api/agent/run` request context'ine model girdisinden ayrı taşınması,
4. `external.send` backend permission enforcement,
5. çoklu server replica kullanılacaksa paylaşımlı replay/nonce store

gereklidir.

Bu gereksinimler tamamlanmadan yalnız `explicitUserIntent` veya model tarafından üretilebilen herhangi bir boolean gönderim yetkisi sayılmaz.