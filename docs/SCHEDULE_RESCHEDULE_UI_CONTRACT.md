# Schedule Reschedule UI Contract

## Amaç

Hafize'nin zamanlanmış görev kartı, mevcut bir `scheduled` görevin çalışma zamanını açık kullanıcı eylemiyle değiştirebilir. Bu özellik yeni bir schedule backend yetkisi oluşturmaz; mevcut `PATCH /api/schedules/:id` ve `schedule-command-boundary` sözleşmesini görünür UI üzerinden kullanır.

## Açık kullanıcı onayı

Yeniden zamanlama iki aşamalıdır:

1. Kullanıcı ilgili görev satırındaki **Zamanı değiştir** düğmesini açar ve yeni tarihi/saatini seçer.
2. **Yeni zamanı kaydet** sonrasında ayrıca tarayıcı confirmation onayı verilir.

Confirmation reddedilirse PATCH isteği gönderilmez. Streaming/model/tool çıktısı veya başka bir otomasyon bu UI eylemini kendiliğinden tetiklemez.

## İstemci doğrulaması

- Yalnız `scheduled` durumundaki satırlarda kontrol oluşturulur.
- Schedule ID en fazla 120 karakterdir ve `[A-Za-z0-9._:-]` allowlist'ine uymalıdır.
- Yeni zaman `datetime-local` girdisinden parse edilir ve geçerli anın kesin olarak sonrasında olmalıdır.
- Ağ isteği yalnız `PATCH /api/schedules/:id` şeklindedir.
- Request body yalnız `{ "runAt": "<RFC3339/ISO>" }` alanını taşır.
- `credentials: same-origin` ve `cache: no-store` kullanılır.

İstemci doğrulaması authorization değildir. Esas yetki kararı server-side kalır.

## Backend güvenlik sınırı

Mevcut schedule command boundary yeniden zamanlamada şunları tekrar doğrular:

- authenticated principal mevcut olmalı;
- schedule gerçekten principal'ın `ownerId` değerine ait olmalı;
- schedule durumu tam olarak `scheduled` olmalı;
- body yalnız allowlist `runAt` / `retryDelayMs` alanlarından oluşmalı;
- `runAt` RFC3339 biçiminde ve store sözleşmesine uygun olmalı.

Başka owner'a ait görev `SCHEDULE_NOT_FOUND`, artık uygun durumda olmayan görev `SCHEDULE_NOT_RESCHEDULABLE` olarak fail-closed reddedilir.

## Secret ve veri sınırı

Renderer şunları okumaz veya üretmez:

- Authorization/Bearer token;
- HttpOnly session cookie değeri;
- ownerId veya traceId;
- cloud signing key veya password hash;
- Gmail, GitHub, Canva ya da NVIDIA credential'ları.

Form taslağı localStorage, sessionStorage veya IndexedDB'ye kaydedilmez. Clipboard, WebSocket, EventSource veya sendBeacon kullanılmaz.

## Görünürlük ve senkronizasyon

Başarılı PATCH sonrası `hafize:schedule-rescheduled` olayı yayınlanır. Schedule listesi bu olayı dinler ve authoritative `GET /api/schedules` ile yeniden yüklenir; böylece UI yalnız PATCH yanıtına güvenerek kalıcı state uydurmaz.

Liste satırı normalleştirilmiş `runAt` değerini yalnız mevcut DOM düğümünde `data-run-at` olarak tutar. Bu değer persistent client storage değildir ve form ön-doldurması dışında yeni bir veri kanalı oluşturmaz.

## Erişilebilirlik

- Kontroller native button/form/input öğeleridir.
- Aç/kapa düğmesi `aria-expanded` kullanır.
- Sonuç metni `role=status` ve `aria-live=polite` taşır.
- Escape açık ve busy olmayan formu kapatıp odağı toggle düğmesine döndürür.
- Mobil kontrol hedefleri en az 44px'dir.
- reduced-motion ve forced-colors kullanıcı tercihleri korunur.

## Failure davranışı

401, 404, 409 ve 400 durumları ayrı fakat sanitize edilmiş kullanıcı mesajlarına çevrilir. Ham backend hata detayları, stack trace veya credential hiçbir zaman UI'ya basılmaz. Ağ hatasında görev state'i değiştirilmez.

Dinamik shell yükleme yarışında modül schedule list kartını en fazla 10 saniye bekler. Mount gerçekleşince veya süre dolunca observer/timer temizlenir.

## PWA

Yeni JS/CSS assetleri shell cache allowlist'indedir. Cache sürümü `v68` olur. Service worker GET dışındaki PATCH isteğini `ignore` sınıfında bırakır; schedule mutation hiçbir zaman cache'e girmez.

## Geri alma

Revert için `schedule-reschedule.js`, `schedule-reschedule.css`, ilgili testler/belge ve loader/PWA wiring kaldırılır; `schedule-list.js` içindeki reschedule event/runAt data wiring geri alınır. Backend schedule store, worker, lease veya kayıtlı görevler için migration yoktur.
