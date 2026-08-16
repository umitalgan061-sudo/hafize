# Schedule List UI Contract

## Amaç

Hafize kullanıcısının kendi zamanlanmış agent görevlerini, mevcut güvenli cloud oturumu üzerinden salt-okunur biçimde görmesini sağlar. Bu katman görev oluşturma, yeniden zamanlama, iptal veya dış sistem yazma yetkisi açmaz.

## Veri kaynağı

Tek veri kaynağı authenticated same-origin `GET /api/schedules` isteğidir. İstek `credentials: same-origin` ve `cache: no-store` ile yapılır. Bearer token, OAuth tokenı veya başka credential JavaScript tarafından okunmaz ya da oluşturulmaz.

Backend `schedule-command-boundary` owner subject üzerinden filtre uygular; istemci ownerId göndermez ve başka kullanıcının görevini seçmeye çalışmaz.

## Görünür alanlar

UI yalnız şu alanları işler:

- `scheduleId`: yalnız deduplication/identity için; görünür metin olarak gösterilmez.
- `agentId`: en fazla 120 karakter.
- `task`: yalnız 180 karakterlik düz metin önizlemesi.
- `runAt`: geçerli tarih-saat olarak normalize edilir.
- `status`: `scheduled`, `running`, `completed`, `failed`, `cancelled` allowlist'i.
- `attempts` ve `maxAttempts`: yalnız 0–5 / 1–5 aralığında kabul edilir.

`traceId`, `lastError`, `retryDelayMs`, `createdAt`, `updatedAt`, owner kimliği ve herhangi bir credential UI modeline alınmaz.

## Güvenlik sınırı

- POST/PATCH/DELETE çağrısı yoktur.
- Form submit veya otomatik task mutation yoktur.
- `localStorage`, `sessionStorage`, IndexedDB, cookie okuma/yazma yoktur.
- HTML string parse edilmez; görev önizlemeleri yalnız `textContent` ile render edilir.
- Secret, trace, tool activity veya agent prompt metadata'sı görünür hale getirilmez.
- Backend default-deny tool permission sözleşmesi değişmez.
- Dış write/send/merge işlemlerinde mevcut explicit approval sınırı korunur.

## Session davranışı

Kart mount olduğunda bir kez listeyi okur. `#sessionBadge` kararlı durumu değiştiğinde tekrar okur; `loading` geçişleri request tetiklemez. 401 durumunda görev içeriği gösterilmez ve cloud oturumu gerektiği belirtilir.

Manuel `Yenile` kullanıcı eylemi yalnız aynı salt-okunur GET isteğini tekrarlar. Aynı anda ikinci request başlatılmaz.

## Fail-closed davranış

Geçersiz schedule objeleri tek tek yok sayılır. Aynı `scheduleId` tekrar ederse ilk geçerli kayıt korunur. En fazla 100 geçerli görev render edilir.

HTTP hata, geçersiz payload veya network failure durumunda mevcut liste temizlenir ve generic hata metni gösterilir. Upstream hata ayrıntıları, `lastError` veya server stack kullanıcıya basılmaz.

## Erişilebilirlik

Kart `aria-busy` kullanır; durum satırı `role=status` ve `aria-live=polite` taşır. Mobil refresh hedefi en az 40px'tir. Reduced-motion ve forced-colors stilleri desteklenir.

## Geri alma

Revert için `schedule-list.js`, `schedule-list.css`, ilgili testler/belge ve shell loader/cache kayıtları kaldırılır. Schedule backend, worker, encrypted storage ve lease davranışlarında migrasyon yoktur.
