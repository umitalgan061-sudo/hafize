# Zamanlanmış görev iptal UI sözleşmesi

## Amaç

Hafize kullanıcısı kendi planlanmış görevini uygulama içinden açıkça iptal edebilmelidir. Bu özellik yeni bir schedule yetkisi icat etmez; mevcut `DELETE /api/schedules/:id` command boundary'sini kullanıcı kontrollü bir UI eylemine bağlar.

## Yetki sınırı

Backend karar mercii olmaya devam eder. `schedule-command-boundary` yalnız authenticated principal'ın kendi kaydını bulur ve yalnız `status === "scheduled"` olan görevin iptaline izin verir. Başka owner'a ait kayıt `SCHEDULE_NOT_FOUND`, running/completed/failed/cancelled kayıt `SCHEDULE_NOT_CANCELLABLE` sonucu verir.

UI bu kuralları güvenlik garantisi olarak tek başına üstlenmez. Görünür iptal düğmesi yalnız `scheduled` satırlara eklenir; DELETE sonrasında backend aynı owner/status kontrolünü yeniden uygular.

## Açık kullanıcı niyeti

İptal iki ayrı kullanıcı eylemi ister:

1. Kullanıcı ilgili satırdaki `İptal et` düğmesine basar.
2. Tarayıcı onay penceresinde iptali ayrıca kabul eder.

Onay verilmezse ağ isteği oluşmaz. Model, agent çıktısı, MutationObserver, zamanlayıcı veya başka bir UI olayı kendi başına iptal isteği başlatamaz.

## İstek sözleşmesi

İstemci yalnız şu isteği yapabilir:

- method: `DELETE`
- path: `/api/schedules/<validated schedule id>`
- credentials: `same-origin`
- cache: `no-store`
- response: JSON

DELETE body taşımaz. Authorization header istemci tarafından oluşturulmaz; mevcut HttpOnly cloud-session cookie veya server-to-server bearer doğrulaması backend'de kalır.

Schedule ID en fazla 120 karakterdir ve yalnız `A-Z`, `a-z`, `0-9`, `.`, `_`, `:`, `-` karakterleri kabul edilir. Geçersiz kimlikte istek fail-closed üretilmez.

## Veri ve secret sınırı

İptal modülü task metnini, traceId'yi, ownerId'yi, lastError ayrıntısını veya credential bilgisini yeni bir depoya kopyalamaz. `localStorage`, `sessionStorage`, IndexedDB, cookie okuma, clipboard ve yeni persistent state yoktur.

Secret, bearer token, cloud signing key, OAuth token veya şifre istemci koduna taşınmaz. `.env`, credential dosyaları ve `.github/workflows/` bu değişiklik kapsamında değildir.

## Dış yan etkiler

Bir Hafize schedule kaydını iptal etmek GitHub/Gmail/Canva gibi dış sisteme yazma veya gönderme değildir. İptal yalnız gelecekteki Hafize görev yürütmesini durdurur. Planlanan görevin içeriği dış write/send/merge istese bile bu yetkiler mevcut backend approval sınırlarını ayrıca geçmek zorundadır.

## UI davranışı

401 durumunda cloud oturumu gereksinimi, 404 durumunda kaydın artık bulunmadığı, 409 durumunda görevin artık iptal edilebilir durumda olmadığı sanitize edilmiş metinle gösterilir. Ham server hata ayrıntıları gösterilmez.

Başarılı iptal sonrası satır yerelde `cancelled` olarak işaretlenir, tekrar iptal düğmesi kaldırılır ve liste yenileme olayı tetiklenir. Aynı schedule ID için eşzamanlı ikinci DELETE engellenir.

Mobilde iptal düğmesi en az 42px yüksekliğe genişler. `focus-visible`, reduced-motion ve forced-colors davranışları korunur.

## Geri alma

Revert için `schedule-cancel.js`, `schedule-cancel.css`, loader/PWA kayıtları, schedule-list'in yalnız ID metadata wiring'i, testler ve bu belge kaldırılır. Schedule store şeması, worker, lease, kayıtlı görevler veya backend command boundary için migration gerekmez.
