# Zamanlanmış görev filtreleme sözleşmesi

## Amaç

Hafize zamanlanmış görev kartı pagination ile yüzlerce görevi gösterebilir. Bu sözleşme, kullanıcıya zaten indirilmiş summary kayıtları içinde hızlı durum filtresi ve metin araması sunar. Özellik yeni bir schedule API, server query veya write yetkisi açmaz.

## Kullanıcı davranışı

Filtre yüzeyi dört görünüm sunar:

- **Tümü:** yüklenmiş bütün görevler.
- **Aktif:** yalnız `scheduled` ve `running` görevler.
- **Geçmiş:** `completed`, `failed` ve `cancelled` görevler.
- **Başarısız:** yalnız `failed` görevler.

Ayrıca kullanıcı en fazla 120 karakterlik sorguyla görünür görev özeti ve ajan kimliği içinde arama yapabilir. Durum filtresi ile arama birlikte uygulanır. Arama Türkçe küçük/büyük harf dönüşümünü kullanır.

Filtre seçimleri yalnız mevcut sayfa belleğinde yaşar. Yenileme, yeni sekme veya uygulamanın yeniden başlatılması filtreyi varsayılan `Tümü` durumuna döndürür. Bu bilinçli bir veri-minimizasyonu tercihidir.

## Veri sınırı

Filtre katmanı yalnız `schedule-list.js` tarafından DOM'a zaten yazılmış şu üç bilgiye bakar:

1. `article.dataset.state` durum değeri,
2. `.schedule-list-agent` görünür ajan adı/kimliği,
3. `.schedule-list-task` görünür, bounded görev özeti.

Filtre katmanı `scheduleId`, owner, trace, retry metadata, hata ayrıntısı, tam görev gövdesi, token, cookie veya credential okumaz. Yeni `fetch`, XHR, WebSocket, EventSource veya başka ağ isteği yoktur.

## Güvenlik

- Filtreler server-side authorization yerine geçmez ve hiçbir tool permission değiştirmez.
- `/api/schedules` mevcut same-origin authenticated summary akışında kalır.
- `localStorage`, `sessionStorage`, IndexedDB, cookie veya clipboard kullanılmaz.
- Kullanıcı metni HTML olarak parse edilmez; mevcut schedule kartının `textContent` çıktısı aranır.
- Dış write/send/merge approval sınırları değişmez.
- Dört profilli selector/specialist roster değişmez.
- `.env`, credential ve `.github/workflows/` dosyaları kapsam dışıdır.

## Dinamik liste davranışı

Schedule listesi ilk sayfa yükleme, `Daha eski görevleri yükle`, create/cancel/reschedule refresh veya snapshot değişimi nedeniyle DOM'u yenileyebilir. Filtre controller'ı listeyi `MutationObserver` ile izler ve değişiklikleri tek bir `requestAnimationFrame` kuyruğunda tekrar değerlendirir.

Bu observer ağ isteği yapmaz. Controller destroy edildiğinde observer ve event listener'lar temizlenir, filtre nedeniyle gizlenmiş görevler tekrar görünür hale getirilir.

Script schedule kartından önce yüklenirse bounded auto-mount en fazla 10 saniye kartı bekler. Kart bulununca observer kapanır; timeout sonunda da kaynak bırakılır.

## Erişilebilirlik

- Durum filtreleri `aria-pressed` kullanır.
- Filtre sayıları görsel yardımcı bilgidir; button erişilebilir adı görev sayısını içerir.
- Arama alanının açık `aria-label` değeri vardır.
- Eşleşme sayısı `role=status` + `aria-live=polite` ile bildirilir.
- Mobil dokunma hedefleri en az 44 px'tir.
- `focus-visible`, reduced-motion ve forced-colors davranışları tanımlıdır.
- Arama alanı odaktayken `Escape` sorguyu temizler.

## PWA sözleşmesi

`/schedule-list-filter.js` ve `/schedule-list-filter.css` shell asset'tir. Cache sürümü `hafize-shell-v85` olarak artırılmıştır. Bu değişiklik `/api/*` için mevcut network-only politikasını değiştirmez; schedule API cevapları service-worker cache'ine girmez.

## Test kapsamı

Regresyon testleri şunları kilitler:

- filtre durum kümeleri ve sayaçları,
- Türkçe case-fold + 120 karakter sorgu sınırı,
- aktif/geçmiş/başarısız eşleşmeleri,
- fake DOM üzerinde gerçek hide/show ve destroy cleanup,
- forbidden network/storage/secret/shell yüzeyleri,
- fixed same-origin asset loader,
- PWA v85 shell wiring ve `/api/schedules` network-only davranışı,
- mobil 44 px, focus-visible, reduced-motion ve forced-colors CSS sınırları.

## Geri alma

Geri almak için `schedule-list-filter.js`, `schedule-list-filter.css`, ilgili test/belge dosyaları kaldırılır; `ui-shell.js` loader satırları çıkarılır ve PWA shell cache bir sonraki geçerli sürüme taşınır. Schedule storage, API schema veya kalıcı kullanıcı verisi migrasyonu yoktur.
