# Schedule Cloud Session Authentication Boundary

## Amaç

Hafize'nin zamanlanmış görev HTTP API'si uzun süredir server-to-server kullanım için `HAFIZE_SCHEDULE_AUTH_TOKEN` bearer kimliğiyle korunur. Tarayıcıdaki görev kartı ise güvenlik gereği bearer token üretmez, okumaz veya saklamaz; yalnız `credentials: same-origin` ile HttpOnly Hafize cloud-session cookie'sini gönderir.

Bu sözleşme iki doğrulama yolunu aynı schedule command boundary'de güvenli biçimde birleştirir.

## Doğrulama sırası

`/api/schedules` ve `/api/schedules/:id` çağrılarında:

1. Mevcut schedule bearer authenticator denenir.
2. Bearer doğrulanmazsa, cloud-session yapılandırılmışsa HttpOnly session cookie doğrulanır.
3. İki yol da başarısızsa `AUTH_REQUIRED` / HTTP 401 döner.

Başarılı doğrulamanın ürettiği `principal.subject` değiştirilmez. Schedule store owner izolasyonu aynı subject üzerinden devam eder. Bir subject başka subject'in görevlerini göremez veya değiştiremez.

Bearer yolu kaldırılmadığı için worker, CLI veya kontrollü server-to-server istemciler geriye dönük uyumlu kalır. Browser tarafı bearer credential'a erişmez.

## Cloud-session yapılandırma eşliği

Schedule fallback authenticator yalnız mevcut cloud-session ortam alanları tam yapılandırılmışsa etkinleşir:

- `HAFIZE_CLOUD_SESSION_PASSWORD_HASH`
- `HAFIZE_CLOUD_SESSION_SIGNING_KEY`
- `HAFIZE_CLOUD_SESSION_SUBJECT`
- `HAFIZE_CLOUD_SESSION_ORIGIN`
- isteğe bağlı `HAFIZE_CLOUD_SESSION_TTL_MS`

Partial configuration fail-closed kabul edilir. Origin HTTPS kök origin olmak zorundadır. TTL varsa cloud-session runtime ile aynı 1 dakika–12 saat sınırına tabidir.

Schedule katmanı yeni cookie üretmez, login yapmaz ve parola doğrulamaz. Yalnız mevcut `createCloudSessionAuth(...).authenticate()` davranışını tekrar kullanır.

## Secret ve istemci sınırı

Bu değişiklik:

- schedule bearer tokenını browser'a taşımaz;
- signing key veya password hash'i response'a koymaz;
- cookie değerini JavaScript'e açmaz;
- localStorage/sessionStorage/IndexedDB/cookie JavaScript API'si eklemez;
- Authorization header üretmez;
- yeni public endpoint eklemez.

`__Host-hafize_session` cookie'si mevcut `HttpOnly; Secure; SameSite=Strict; Path=/` sözleşmesinde kalır.

## Yetki sınırı

Authentication yalnız kimliği belirler; authorization genişlemez. Schedule işlemleri hâlâ `schedule-command-boundary.mjs` üzerinden owner scope, ajan registry doğrulaması, durum geçişleri ve kapasite sınırlarıyla yürür.

Bu değişiklik model/tool policy'yi etkilemez. Ajanların dış write/send/merge izinleri backend default-deny ve explicit approval kurallarında kalır. Secret değerleri ajan context'ine girmez.

## Browser davranışı

`public/schedule-list.js` yalnız `GET /api/schedules` yapar ve `credentials: same-origin` kullanır. Cloud-session açıkken bu istek artık server tarafında doğrulanabilir.

UI yine read-only'dir. POST/PATCH/DELETE kontrolü eklenmez. Schedule oluşturma, yeniden zamanlama veya iptal için ayrı açık kullanıcı eylemi ve ayrıca ürün/approval tasarımı gerekir.

## Hata davranışı

- Cloud session yapılandırılmamışsa mevcut bearer-only davranış korunur.
- Cloud config partial veya geçersizse schedule API oluşturulurken fail-closed hata oluşur; sessizce zayıf doğrulamaya geçilmez.
- Bozuk/expired/sahte cookie authentication başarısı üretmez.
- Authenticator exception'ları credential ayrıntısı sızdırmadan başarısız doğrulama olarak ele alınır.
- Bearer başarılıysa session fallback çağrılmaz.

## Test sözleşmesi

Regresyon testleri şunları doğrular:

- bearer-first sıra ve session fallback;
- cloud principal subject'inin command katmanına aynen taşınması;
- bearer-only geriye uyumluluk;
- invalid/expired benzeri session sonuçlarının 401 üretmesi;
- cloud env complete/disabled/partial davranışı;
- HTTPS origin ve TTL doğrulaması;
- yeni auth modülünde network/storage/secret-response yüzeyi bulunmaması;
- schedule-list same-origin credential wiring'i ile server fallback'in birlikte mevcut olması.

## Geri alma

Revert için `schedule-session-auth.mjs`, `schedule-http-api.mjs` içindeki fallback wiring, ilgili testler ve bu belge kaldırılır. Schedule store schema, worker, lease runtime veya kayıtlı görevlerde migration yoktur.
