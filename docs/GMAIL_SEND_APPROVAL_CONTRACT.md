# Gmail send onay sözleşmesi

Bu katman gelecekteki Gmail gönderme aracının güvenlik sınırını tanımlar; **mevcut production tool catalog'a `gmail_send` kaydı eklemez ve kendi başına ağ çağrısı yapmaz.**

## İki ayrı onay

1. Model argümanında `explicitUserIntent: true` bulunmalıdır.
2. `approvalGranted` yalnız backend context/option üzerinden `true` olabilir.

Modelin `approvalGranted`, owner kimliği, token, `from`, raw MIME, serbest URL veya attachment alanı vermesine izin verilmez. Böylece model kendi onayını üretemez.

## İlk sürüm kapsamı

- En fazla 10 doğrudan alıcı.
- Düz metin gövde; HTML ve attachment yok.
- Subject ve recipient alanlarında CR/LF header injection reddedilir.
- Duplicate recipient case-insensitive olarak reddedilir.
- `from` bağlı Gmail hesabı tarafından backend'de belirlenmek üzere model şemasının dışındadır.

## Boundary davranışı

`createGmailSendToolBoundary()` yalnız injected `sendClient` ve authenticated owner resolver ile çalışır. Approval başarısızsa owner çözümleme veya send client çağrısı yapılmaz. Başarılı client sonucu modele doğrudan verilmez; yalnız `sent`, `messageId` ve opsiyonel `threadId` alanlarına sanitize edilir.

## Production'a açılma koşulu

Gelecekte tool catalog kaydı yapılacaksa ayrıca `external.send` backend permission/approval gate'i, owner-scoped `gmail.send` OAuth scope kontrolü ve gerçek Gmail send client testi tamamlanmalıdır. OAuth scope tek başına gönderme yetkisi sayılmaz.
