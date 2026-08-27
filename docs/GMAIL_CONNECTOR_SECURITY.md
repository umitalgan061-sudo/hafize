# Gmail connector güvenlik sınırı

Hafize'nin ilk Gmail tool yüzeyi yalnız **salt-okunur** çalışır. Model ve uzman ajanlar OAuth token, connector owner kimliği veya serbest Gmail API URL'si seçemez.

## Kimlik ve owner scope

- Connector HTTP erişimi backend bearer authenticator ile doğrulanır.
- Doğrulanmış subject, HMAC tabanlı opak owner kimliğine backend içinde çevrilir.
- Raw subject generic tool context'e girmez; request-scoped Gmail executor içine bağlanır.
- Access/refresh token yalnız encrypted OAuth token store'dan owner + `google` provider scope'uyla okunur.

## Tool sınırı

`gmail_read` yalnız şu operasyonları destekler:

- `profile.get`
- `message.list`
- `message.get`

Gönderme, silme, etiket değiştirme, mail modify ve serbest URL çağrısı bu tool'un parçası değildir. Tool yalnız `connector.gmail.read` backend izni bulunan ajanlara ve doğrulanmış Gmail request context'i mevcutsa sunulur.

## HTTP durumu

`GET /api/connectors/gmail/status` yalnız bağlantının var olup olmadığını `{ linked: boolean }` biçiminde verir. Owner ID, subject, scope listesi veya token değerleri response'a eklenmez.

## Yazma işlemleri

Gelecekte e-posta gönderme veya mailbox değiştirme ayrı tool/permission sözleşmesi olmalıdır. `gmail.send` / `gmail.modify` OAuth scope'ları tek başına tool yetkisi vermez; external send/write için backend approval gate ve açık kullanıcı niyeti zorunludur.

## İstek doğrulama

Read client'ın istek objesi strict doğrulanır: `null`, dizi, string veya `ownerId` / `operation` / `params` dışında alan taşıyan istek `INVALID_GMAIL_READ:request` ile reddedilir. Daha önce `null` istek destructuring `TypeError`'ı üretiyordu; bu, fail-closed hata sözleşmesinin dışına çıkan bir sızıntı yüzeyiydi.

## Değişmeyen ilkeler

- NVIDIA veya başka model sağlayıcısı tool yetkisini değiştiremez.
- Secret değerleri model/ajan bağlamına girmez.
- `.env` veya credential dosyaları repo kapsamına alınmaz.
- `/api/chat` connector request context'i taşımaz; connector tool çalıştırma yolu `/api/agent/run` ile sınırlıdır.
