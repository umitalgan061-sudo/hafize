# Gmail connector güvenlik sınırı

Hafize'nin ilk Gmail tool yüzeyi yalnız **salt-okunur** çalışır. Model ve uzman ajanlar OAuth token, connector owner kimliği veya serbest Gmail API URL'si seçemez.

## Kimlik ve owner scope

- Connector HTTP erişimi backend bearer authenticator ile doğrulanır.
- Doğrulanmış subject, HMAC tabanlı opak owner kimliğine backend içinde çevrilir.
- Raw subject generic tool context'e girmez; request-scoped Gmail executor içine bağlanır.
- Access/refresh token yalnız encrypted OAuth token store'dan owner + `google` provider scope'uyla okunur.

## Süreklilik ve token yenileme

- Gmail access tokenı bitmek üzereyse backend, yalnız encrypted store'daki aynı owner'a ait Google refresh tokenını kullanabilir.
- Google client ID ve varsa client secret yalnız server ortamından alınır; frontend, model veya ajan bağlamına aktarılmaz.
- Refresh etkinse `HAFIZE_GOOGLE_REFRESH_REDIS_URL` zorunludur; eksik/tek taraflı config startup'ta fail-closed reddedilir.
- Aynı owner için process içi singleflight'a ek olarak Redis lease uygulanır; owner ID Redis key'ine düz yazılmaz, domain-separated SHA-256 digest kullanılır.
- Lease tokenı `SET NX + PX` ile alınır, token-doğrulamalı Lua renew/release kullanılır ve automatic reconnect kapalıdır.
- Holder, 30 saniyelik lease'i 10 saniyelik otomatik heartbeat ile canlı tutar; heartbeat veya timer altyapısı kaybı sticky fail-closed duruma dönüşür.
- İkinci instance lease'i aldıktan sonra encrypted token kaydını yeniden okur; ilk holder zaten fresh token yazdıysa Google'a ikinci refresh isteği göndermez.
- Provider sonucu token store'a yazılmadan hemen önce ve yazımdan hemen sonra lease sahipliği doğrulanır; uzun provider/store işlemleri boyunca heartbeat devam eder.
- Bekleyen instance bir dead-holder TTL'sini aşan sınırlı bir pencere bekler; heartbeat'i durmuş holder'ın lease'i süresi dolunca güvenli devralma yapabilir.
- Google refresh response'u yeni refresh token vermiyorsa mevcut token korunur; verirse encrypted store içinde döndürülür.
- Provider'ın döndürdüğü scope listesi önceki grant'i **genişletemez**. Yeni bir scope görülürse refresh fail-closed reddedilir ve token kaydı üzerine yazılmaz.
- Refresh sonrası `gmail.readonly` scope'u veya yeterli ömür yoksa Gmail API çağrısı yapılmaz ve yeniden yetkilendirme gerekir.
- Token yenileme bir tool permission değişikliği değildir; `gmail.send`/`gmail.modify` gibi yazma yetkilerini açmaz.

## Provider network sınırı

- Google token endpoint JSON'u en fazla 64 KiB, Gmail read JSON'u en fazla 2 MiB kabul edilir.
- Native fetch response'u stream halinde okunur; byte bütçesi aşılır aşılmaz reader iptal edilir, tam response önce belleğe alınmaz.
- Geçerli `Content-Length` sınırı aşıyorsa body açılmadan fail-closed reddedilir.
- Google refresh isteği varsayılan 15 saniye, Gmail read isteği varsayılan 20 saniye deadline ile çalışır; deadline alttaki fetch'i `AbortSignal` ile keser.
- Provider socket/parse ayrıntıları public sonuca taşınmaz; yalnız sabit Gmail/Google boundary hata kodları dışarı çıkar.
- Oversized, timeout veya bozuk refresh response token store'a yazılamaz.

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

## Değişmeyen ilkeler

- NVIDIA veya başka model sağlayıcısı tool yetkisini değiştiremez.
- Secret değerleri model/ajan bağlamına girmez.
- `.env` veya credential dosyaları repo kapsamına alınmaz.
- `/api/chat` connector request context'i taşımaz; connector tool çalıştırma yolu `/api/agent/run` ile sınırlıdır.
