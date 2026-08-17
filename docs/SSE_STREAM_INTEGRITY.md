# SSE Stream Integrity Contract

## Amaç

Hafize sohbet istemcisi NVIDIA NIM sohbeti ve agent/tool çalıştırmasını `text/event-stream` üzerinden tüketir. Tarayıcıdaki mevcut parser event bloklarını `\n\n` ile ayırır. Bir proxy, runtime veya upstream bağlantısı son geçerli event'i ayraç yazmadan kapatırsa bu son event önceki davranışta buffer içinde kalıp görünmeden kaybolabilirdi.

Bu sözleşme istemci ile mevcut parser arasına dar bir framing katmanı koyar. Model/provider davranışını, tool permission sözleşmesini veya agent registry'yi değiştirmez.

## Kapsam

Guard yalnız aşağıdaki exact same-origin POST yollarını kapsar:

- `/api/chat`
- `/api/agent/run`

Query/hash taşıyan varyantlar, path lookalike'ları, farklı HTTP metodları ve farklı origin'ler guard dışında kalır. `/api/schedules`, memory, screen-analysis, Gmail, Canva ve GitHub write yolları etkilenmez.

Yanıtın `Content-Type` değeri exact MIME olarak `text/event-stream` değilse response hiçbir dönüşüm yapılmadan döndürülür. Bu özellikle JSON hata cevaplarının mevcut hata işleme yolunu korur.

## Framing davranışı

- UTF-8 byte chunk'ları `TextDecoder` ile incremental çözülür.
- `CRLF`, tek `CR` ve chunk sınırında bölünmüş `CRLF` güvenli biçimde `LF`'ye normalize edilir.
- Tamamlanmış event blokları `\n\n` sonlandırıcısıyla gecikmeden downstream'e aktarılır.
- Stream kapanırken pending son blok boş değilse tek `\n\n` eklenerek flush edilir.
- `[DONE]`, comment/keepalive ve çok satırlı `data:` blokları içerik olarak yorumlanmaz; yalnız framing korunur. JSON parse işi mevcut uygulama parser'ında kalır.

## Bellek sınırı

Tek tamamlanmamış SSE frame için üst sınır **256 KiB karakter**dir. Sınır aşılırsa `SSE_FRAME_TOO_LARGE` ile stream fail-closed kapanır. Bu sınır kontrolsüz pending buffer büyümesini engeller ve normal token/tool-activity event'lerinden çok daha yüksek tutulmuştur.

Guard tüm yanıtı bellekte biriktirmez. Tamamlanan bloklar anında downstream'e verilir; yalnız henüz delimiter almamış frame tutulur.

## İstek bütünlüğü

Guard yeni bir istek üretmez. Orijinal `fetch(input, init)` çağrısına aynı input/init nesneleri aktarılır. Bu nedenle:

- `AbortSignal` değiştirilmez,
- request body yeniden yazılmaz,
- auth/header eklenmez,
- retry yapılmaz,
- başka endpoint'e yönlendirme yapılmaz.

Response yalnız SSE guard şartlarının tamamı sağlandığında yeni streaming Response ile sarılır. Status, statusText ve header'lar korunur; normalize edilmiş canlı stream için `Cache-Control: no-store` uygulanır.

## Uyumluluk ve fail-safe

`TransformStream`, `TextDecoder`, `TextEncoder` veya `Response` bulunmayan eski/uyumsuz browser ortamında guard response'u değiştirmeden native davranışa döner. Bu fallback yeni network veya storage davranışı oluşturmaz.

Install idempotent'tir. Aynı sayfada ikinci kez yüklenirse fetch tekrar tekrar wrap edilmez. Test/cleanup için restore controller'ı yalnız kendi kurduğu wrapper halen aktifse orijinal fetch'i geri yükler.

## Güvenlik sınırı

Bu katman:

- localStorage/sessionStorage/IndexedDB/cookie/clipboard kullanmaz,
- credential veya Authorization değeri okumaz/üretmez,
- tool permission genişletmez,
- external write/send/merge işlemi başlatmaz,
- secret değerlerini agent context'e taşımaz,
- shell/exec/spawn yolu açmaz.

Backend default-deny tool policy, explicit external-write approval, dört profilli selector/specialist roster ve shared trace/task ledger aynen korunur.

## PWA

`chat-run-controller.js` zaten offline shell asset'idir. Davranış değişikliğinin eski cached controller ile karışmaması için shell cache `v80` olarak ilerletilir. `/api/*` istekleri service worker açısından network-only/POST ignore olmaya devam eder; SSE response'u cache'lenmez.

## Test / DoD

Regresyon testleri şunları kapsar:

- exact route/method/origin allowlist'i,
- CRLF ve chunk-boundary normalizasyonu,
- delimiter olmadan kapanan final event flush,
- çok satırlı data/comment frame'leri,
- 256 KiB pending sınırı,
- non-SSE ve external request passthrough,
- caller body/header/signal bütünlüğü,
- install idempotence ve restore,
- unsupported TransformStream fail-safe,
- shell yükleme sırası ve PWA cache sözleşmesi,
- storage/secret/shell yüzeylerinin yokluğu.

## Geri alma

Revert için `chat-run-controller.js` içindeki SSE integrity helper/install katmanı ve ilgili test/belge kaldırılır, PWA cache önceki sürüme döndürülür. Server schema, conversation storage veya provider migrasyonu yoktur.
