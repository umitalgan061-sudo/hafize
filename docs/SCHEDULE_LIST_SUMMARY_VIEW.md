# Schedule list summary view

## Amaç

Zamanlanmış görevlerin kalıcı kaydı görev metnini 20.000 karaktere kadar tutabilir. Bu veri worker ve görev yönetimi için gereklidir; ancak Hafize web/PWA kartı yalnız kısa bir görev önizlemesi, ajan kimliği, çalışma zamanı, durum ve deneme sayaçlarını gösterir. Tam kayıtların her liste sayfasında tarayıcıya taşınması gereksiz veri aktarımı ve gereksiz istemci veri yüzeyi oluşturur.

Bu sözleşme `GET /api/schedules` için isteğe bağlı `view=summary` görünümünü tanımlar. Mevcut API tüketicilerini kırmamak için `view` verilmediğinde önceki tam kayıt davranışı korunur. Hafize'nin kendi schedule kartı veri-minimum görünüm olarak `view=summary` kullanır.

## HTTP sözleşmesi

İlk sayfa örneği:

`GET /api/schedules?limit=100&view=summary`

Sonraki sayfa mevcut snapshot zincirini aynen korur:

`GET /api/schedules?limit=100&offset=100&snapshot=<43-char-snapshot>&view=summary`

Kurallar:

- `view` alanı isteğe bağlıdır.
- Alan mevcutsa tek geçerli değer tam olarak `summary` değeridir.
- `view=`, `view=full`, farklı büyük/küçük harf, duplicate `view` ve bilinmeyen query alanları fail-closed `400 INVALID_SCHEDULE_LIST_QUERY` üretir.
- `offset > 0` için snapshot zorunluluğu değişmez.
- İlk sayfada snapshot gönderme yasağı değişmez.
- Server-side list limitleri ve owner authentication önceki sözleşmeyi korur.
- Geçersiz query `commands.list` çalıştırmadan reddedilir.

## Summary kayıt alanları

Her geçerli kayıt yalnız şu alanları taşır:

- `scheduleId`
- `agentId`
- `task`
- `taskTruncated`
- `runAt`
- `status`
- `attempts`
- `maxAttempts`

`task` UI önizlemesidir; kalıcı kaydın tam görev gövdesi değildir. Whitespace normalize edilir, kontrol karakterleri güvenli boşluğa dönüştürülür ve çıktı hem en fazla 180 Unicode code point hem en fazla 720 UTF-8 byte olacak şekilde sınırlandırılır. Kısaltma yapıldığında `taskTruncated: true` ve görünür `…` sonlandırması kullanılır.

`runAt` geçerli ISO zamanına normalize edilir. Durum yalnız Hafize'nin beş schedule durumu (`scheduled`, `running`, `completed`, `failed`, `cancelled`) içinden kabul edilir. Deneme sayaçları mevcut 1–5 bounded retry sözleşmesiyle uyumlu olmak zorundadır. Bozuk bir kayıt summary görünümünde fail-closed atlanır.

## Bilerek taşınmayan veriler

Summary projection allowlist tabanlıdır. Kaynak kayıt üzerinde bulunsalar bile aşağıdaki türler tarayıcıya taşınmaz:

- owner/principal kimliği,
- `traceId` ve task-ledger iç ayrıntıları,
- provider veya worker `lastError` ayrıntıları,
- completion/result içeriği,
- retry altyapısının iç zamanlama ayrıntıları,
- `createdAt` / `updatedAt` gibi UI'nın göstermediği metadata,
- bearer/session/OAuth/connector credential değerleri,
- approval tokenları veya signing key materyali.

Projection deny-list ile "bilinen secret alanları silme" yaklaşımı kullanmaz. Yeni bir store alanı eklense bile summary response'a kendiliğinden girmez; response nesnesi yalnız yukarıdaki sekiz alanla yeniden kurulur.

## Pagination ve snapshot bütünlüğü

Summary projection pagination seçiminden **sonra** uygulanır. Snapshot, owner-scoped tam listenin mevcut canonical sıralamasından üretilmeye devam eder. Bunun iki sonucu vardır:

1. `view=summary` ile tam görünüm aynı liste durumunda aynı snapshot değerini kullanır.
2. Status/runAt gibi snapshot'a dahil bir alan değişirse sonraki offset isteği yine `409 SCHEDULE_LIST_SNAPSHOT_CHANGED` ile durur.

Projection `listMeta.total`, `offset`, `nextOffset`, `truncated` ve `snapshot` anlamlarını değiştirmez. Yalnız bozuk bir seçili kayıt fail-closed atılırsa `listMeta.returned` gerçekten dönen summary kayıt sayısına güncellenir.

## UI sınırı

Hafize schedule kartı her sayfada `view=summary` kullanır ve yine:

- yalnız same-origin `GET` yapar,
- `credentials: same-origin` kullanır,
- `cache: no-store` kullanır,
- `/api/*` PWA service-worker cache'ine alınmaz,
- en fazla 100 kayıt/sayfa ve 500 normalize edilmiş kayıt tutar,
- snapshot değişiminde eski/yeni sayfaları karıştırmadan ilk sayfayı yeniden yükler,
- task metnini yalnız `textContent` ile render eder.

Summary görünümü yeni create/cancel/reschedule/write yetkisi açmaz.

## Agent ve tool güvenliği

Bu değişiklik agent roster veya tool policy değildir. Aktif roster iki selector + iki specialist olmak üzere dört profil olarak kalır. Tool authorization backend `denyByDefault` politikasını korur. GitHub/Gmail/Canva gibi dış write/send/merge işlemleri kendi açık kullanıcı onaylarını ayrıca geçmek zorundadır. Model sağlayıcısı seçimi bu sözleşmeyi değiştirmez.

## Test / Definition of Done

Regresyonlar aşağıdakileri kilitler:

- 180 karakter / 720 byte görev önizleme sınırları,
- Unicode ve kontrol karakteri davranışı,
- yalnız sekiz allowlist alanının çıkması,
- owner/trace/error/result canary'lerinin serialized response'ta bulunmaması,
- 500 maksimum kayıtla bounded summary payload,
- tam görünümün geriye uyumluluğu,
- summary/full snapshot eşliği,
- snapshot pagination devamlılığı,
- malformed/duplicate `view` query'sinde sıfır command execution,
- UI'nın her sayfada `view=summary` istemesi,
- same-origin/no-store read-only client davranışı,
- dört profilli default-deny agent sözleşmesinin korunması.

Canonical suite `npm run check` ile çalıştırılır. Hosted runner başlamazsa PR açıklaması bunu kod assertion başarısızlığından ayrı olarak açıkça belirtmelidir.

## Geri alma

Geri almak için `schedule-list-summary.mjs`, summary query entegrasyonu, UI query parametresi, ilgili testler ve bu belge kaldırılır. Kalıcı veri şeması, schedule store kayıtları, worker davranışı veya migration bulunmadığı için veri geri dönüş işlemi gerekmez.
