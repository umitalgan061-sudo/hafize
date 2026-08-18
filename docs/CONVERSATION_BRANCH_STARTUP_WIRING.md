# Conversation branch startup wiring

Hafize'nin conversation branching zinciri yalnız dosyaların repoda bulunmasına veya PWA shell cache'inde yer almasına güvenmez. Normal web ve PWA başlangıcında gerekli runtime dosyaları `index.html` tarafından açık, same-origin ve dependency-order korunarak çalıştırılır.

## Yükleme sırası

1. `conversation-storage-guard.js`
2. `chat-run-controller.js`
3. `app.js`
4. `message-copy.js`
5. `conversation-model-state.js`
6. `conversation-fork.js`
7. `message-edit.js`
8. `response-retry-style.js`
9. `response-retry.js`

`message-edit.js`, kullanıcı mesajındaki action container'ı için `message-copy.js` tarafından oluşturulan güvenli action yüzeyini kullanır. Fork/edit model tercihini yalnız ayrı bounded model-state store üzerinden kopyalayabilir. Historical retry doğrudan provider'a otomatik submit etmez; `message-edit.js` üzerinden yeni bir düzenleme dalı hazırlar.

## Güvenlik sınırı

- Tüm startup asset'leri sabit same-origin path'lerdir.
- Yeni CDN, üçüncü taraf script, inline credential veya remote code loader eklenmez.
- Branch/edit/retry hiçbir yeni backend tool izni oluşturmaz.
- Retry kullanıcı eylemi olmadan provider isteği göndermez.
- Transcript persistence için `conversation-storage-guard.js` authoritative kalır.
- PWA API istekleri service worker açısından network-only kalır.

## PWA

`index.html` değiştiğinde shell cache sürümü yükseltilir. Yukarıdaki runtime dosyaları shell allowlist'inde kalır; bu yalnız offline startup bütünlüğü içindir ve `/api/*` cevaplarının cache'lenmesi anlamına gelmez.

## Definition of Done

Regresyon testi, tüm runtime dosyalarının `index.html` tarafından gerçekten çalıştırıldığını, dependency order'ın doğru olduğunu, shell allowlist'inde bulunduklarını ve external script/secret yüzeyi açılmadığını doğrular.
