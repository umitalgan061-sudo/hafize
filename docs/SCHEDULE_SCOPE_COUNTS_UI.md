# Schedule scope counts UI contract

## Davranış

Zamanlanmış görev filtreleri, yalnız yüklenmiş DOM satırlarını saymak yerine authenticated backend'in metadata-only `GET /api/schedules?view=counts` cevabını kullanır.

- `Tümü`, `Aktif`, `Geçmiş`, `Başarısız` sayaçları gerçek owner-scoped toplamı gösterir.
- Count görünümü `schedules: []` döndürür; task gövdesi, owner, trace veya hata ayrıntısı tarayıcıya taşınmaz.
- İstek yalnız same-origin GET, `credentials: same-origin`, `cache: no-store` ve JSON Accept header ile yapılır.
- Create/cancel/reschedule event'leri sayacı yeniler. Aynı anda birden fazla event gelirse yalnız bir pending yenileme tutulur.
- Geçersiz/malformed count metadata fail-closed olarak yok sayılır; lokal DOM sayısı global toplam diye sunulmaz.
- Sayaç state'i yalnız sayfa belleğindedir. localStorage, sessionStorage, IndexedDB, cookie veya clipboard kullanılmaz.

## Veri minimizasyonu

Count UI yalnız dört bounded tam sayıyı kabul eder. `all = active + history` ve `failed <= history` invariant'ları istemcide tekrar doğrulanır. Maksimum kabul edilen değer 1.000.000'dur.

## PWA

`schedule-scope-counts-ui.js` shell asset'tir; cache sürümü v87'dir. `/api/*` istekleri service worker tarafından network-only bırakılır ve schedule metadata cache'e yazılmaz.

## Yetki sınırı

Bu özellik yeni schedule write, agent tool, connector, external send veya merge yetkisi açmaz. Backend default-deny ve explicit approval sözleşmeleri değişmez.
