# Server-side auth principal adapter

Bu katman, schedule command boundary'nin ihtiyaç duyduğu doğrulanmış principal nesnesini üretmek için küçük ve provider-bağımsız bir ilk adımdır.

## Sözleşme

`createBearerPrincipalAuthenticator({ token, subject })` yalnızca server-side yapılandırma ile oluşturulur. Token istemci JavaScript'ine, ajan context'ine, task ledger'a veya response gövdesine yazılmaz.

Başarılı doğrulama yalnızca şu principal bilgisini üretir:

```json
{
  "authenticated": true,
  "subject": "..."
}
```

Bearer token principal nesnesine eklenmez.

## Güvenlik sınırları

- Token en az 32 karakter olmalıdır ve whitespace içeremez.
- Authorization şeması yalnızca `Bearer <token>` biçimini kabul eder.
- Token karşılaştırması `timingSafeEqual` ile sabit-zamanlı karşılaştırma yolunu kullanır.
- Yanlış token, eksik header ve yanlış auth scheme aynı `AUTH_REQUIRED` sonucunu verir.
- Secret veya hata ayrıntısı response sözleşmesine taşınmaz.
- Subject server-side config'ten gelir; client kendi owner/subject değerini belirleyemez.

## Bu PR'ın özellikle yapmadıkları

Bu adapter henüz OAuth/OIDC/JWT doğrulaması, session cookie, refresh token, login UI veya public schedule endpoint'i eklemez. `server.mjs` bu turda değişmez. Böylece auth yapılandırılmadan schedule create/cancel yüzeyi yanlışlıkla public hale gelmez.

İleride Google/Firebase/OIDC gibi bir kimlik sağlayıcı seçildiğinde aynı `{ authenticated, subject }` principal sözleşmesi korunabilir ve bearer adapter daha güçlü provider adapter'ıyla değiştirilebilir.
