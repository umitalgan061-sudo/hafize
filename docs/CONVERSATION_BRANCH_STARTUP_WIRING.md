# Conversation branch startup wiring

Hafize'nin conversation branching zinciri yalnız dosyaların repoda bulunmasına veya PWA shell cache'inde yer almasına güvenmez. `index.html` çekirdek uygulama ve `ui-shell.js` dosyalarını yükler; UI shell daha sonra branching enhancement dosyalarını sabit same-origin path'lerden ve deterministik dependency order ile çalıştırır.

## Yükleme sırası

1. `conversation-storage-guard.js` (`index.html`)
2. `chat-run-controller.js` (`index.html`)
3. `app.js` (`index.html`)
4. `ui-shell.js` içindeki branching loader:
   1. `message-copy.js`
   2. `conversation-model-state.js`
   3. `conversation-fork.js`
   4. `message-edit.js`
   5. `response-retry-style.js`
   6. `response-retry.js`

`message-edit.js`, kullanıcı mesajındaki action container'ı için `message-copy.js` tarafından oluşturulan güvenli action yüzeyini kullanır. Fork/edit model tercihini yalnız ayrı bounded model-state store üzerinden kopyalayabilir. Historical retry doğrudan provider'a otomatik submit etmez; `message-edit.js` üzerinden yeni bir düzenleme dalı hazırlar.

## Güvenlik sınırı

- Tüm startup asset'leri sabit same-origin path'lerdir; runtime'dan serbest URL veya remote script seçilemez.
- Dynamic classic script'lerde `async=false` kullanılarak dependency order korunur.
- Loader ID tabanlı idempotent davranır; aynı enhancement iki kez eklenmez.
- Yeni CDN, üçüncü taraf script, inline credential veya remote code loader eklenmez.
- Branch/edit/retry hiçbir yeni backend tool izni oluşturmaz.
- Retry kullanıcı eylemi olmadan provider isteği göndermez.
- Transcript persistence için `conversation-storage-guard.js` authoritative kalır.
- PWA API istekleri service worker açısından network-only kalır.

## PWA

Startup wiring değiştiğinde shell cache sürümü yükseltilir. Branching runtime dosyaları shell allowlist'inde kalır; bu yalnız offline startup bütünlüğü içindir ve `/api/*` cevaplarının cache'lenmesi anlamına gelmez.

## Definition of Done

Regresyon testleri çekirdek `index.html` sırasını, UI shell branching loader sırasını, idempotent fixed-path script installation'ı, shell allowlist kapsamını ve external script/secret yüzeyi açılmadığını doğrular.
