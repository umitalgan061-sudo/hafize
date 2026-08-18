# Schedule history load-more UI

Hafize'nin zamanlanmış görev kartı schedule geçmişini tek seferde sınırsız DOM'a taşımak yerine bounded olarak genişletir.

## Davranış

- İlk sayfa `GET /api/schedules?limit=100` ile alınır.
- Server `nextOffset` ve geçerli `snapshot` döndürürse `Daha eski görevleri yükle` düğmesi görünür.
- Sonraki sayfa aynı snapshot ile `limit=100&offset=...&snapshot=...` biçiminde istenir.
- UI belleğinde ve DOM'da en fazla 500 normalize edilmiş schedule tutulur.
- Aynı `scheduleId` ikinci kez gelirse ikinci kopya eklenmez.
- Manuel yenileme, session değişimi veya create/cancel/reschedule olayı eski pagination state'ini bırakıp ilk sayfadan başlar.

## Liste değişikliği

Sonraki sayfa `409 SCHEDULE_LIST_SNAPSHOT_CHANGED` döndürürse Hafize eski sayfalarla yeni schedule kümesini birleştirmez. `snapshot`, `nextOffset` ve loaded item state temizlenir; kullanıcıya listenin değiştiği bildirilir ve güncel ilk sayfa otomatik yüklenir.

Bu davranış tam bir server-side snapshot saklamaz. Ama canlı worker güncellemeleri sırasında offset drift'inin sessiz duplicate veya missing kayıt üretmesini engeller.

## Güvenlik ve veri minimizasyonu

- İstekler yalnız same-origin `GET /api/schedules`, `credentials: same-origin`, `cache: no-store` kullanır.
- Snapshot yalnız pagination fingerprint'idir; authorization veya credential değildir.
- Renderer bearer token, HttpOnly cookie değeri, owner kimliği, trace, provider secret veya connector credential okumaz.
- Pagination state yalnız sayfa belleğinde tutulur; localStorage, sessionStorage, IndexedDB, cookie veya clipboard'a yazılmaz.
- Task metni `textContent` ile render edilmeye devam eder; HTML parse eklenmez.
- API yolları service worker tarafından `network-only` kalır; schedule cevapları PWA cache'e girmez.
- Yeni schedule write, agent tool permission veya external send/merge yetkisi eklenmez.

## Erişilebilirlik

Load-more kontrolü gerçek `button` elemanıdır, busy durumda disable edilir ve mobilde minimum 44 px dokunma yüksekliği kullanır. `focus-visible`, forced-colors ve reduced-motion davranışları mevcut schedule kartı erişilebilirlik sözleşmesine dahildir.
