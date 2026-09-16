# Modern TypeScript Runtime

## Amaç

Hafize'nin sunucu giriş noktasını Node 24+ üzerinde native TypeScript'e taşımak, mevcut HTTP davranışını korurken yeni geliştirmelerin typed bir sınırdan başlamasını sağlamak.

## Mimari

- `server.ts`: tekil production bootstrap.
- `server-runtime.mjs`: mevcut HTTP/API motorunun uyumluluk katmanı.
- `lib/runtime-config.ts`: ortam değişkenlerini normalize eden ve güvenli sınırlar uygulayan typed configuration.
- `lib/runtime-observability.ts`: istek sayısı, aktif istek, hata ve gecikme metrikleri.
- `lib/model-response-contract.ts`: NVIDIA yanıtlarını normalize eden typed response contract.
- `lib/request-failure.ts`: JSON/SSE hata teslimini normalize eden typed boundary.
- `lib/server-auth.ts`: Bearer kimlik doğrulaması için timing-safe karşılaştırma kullanan typed boundary.
- Eski `.mjs` dosyaları yalnızca bridge olarak tutulur; canonical implementasyon yeni `.ts` dosyasıdır.

## Neden bu yaklaşım

Tek seferde bütün repository'yi yeniden yazmak davranış regresyonlarını büyütür. Bunun yerine execution boundary önce TypeScript olur; küçük runtime modülleri tek tek typed canonical implementation'a taşınır.

Bu yaklaşım şunları sağlar:

1. Production startup yolu tek bir TS entrypoint'ten geçer.
2. Eski import yolları kontrollü biçimde çalışmaya devam eder.
3. Yeni sınır modülleri `unknown`, immutable snapshot ve explicit result type kullanabilir.
4. Node 24 native TypeScript desteği sayesinde ayrıca transpiler runtime zorunluluğu oluşmaz.
5. Frontend Vite hattı ile backend NodeNext hattı birbirinden bağımsız doğrulanabilir.

## Runtime ilkeleri

### Configuration

Port, body limit, upstream timeout, context limit ve scheduler timeout değerleri bounded okunur. Geçersiz veya aşırı değerler güvenli varsayılanlara döner.

NVIDIA endpoint'i HTTPS olmak zorundadır. Runtime config validation production başlangıcında başarısızsa process başlatılmaz.

### Request safety

JSON request body bounded tutulur. Upstream NVIDIA çağrılarında request abort sinyali ile timeout sinyali birleştirilir. Böylece istemci bağlantısı kopmuşken upstream isteğinin sınırsız devam etmesi engellenir.

### Response safety

JSON ve SSE cevaplarında güvenlik başlıkları uygulanır. Model veya upstream tanı metni istemciye ham şekilde geçirilmez.

### Static files

`public` dışına path traversal engellenir. `.ts` kaynaklarının static endpoint'ten servis edilmesi reddedilir. HTML navigation `no-cache`, diğer shell kaynakları sınırlı public cache ile sunulur.

### Shutdown

SIGINT ve SIGTERM aynı idempotent shutdown yoluna girer. Scheduler timer durdurulur, aktif tick tamamlanır, Redis lease runtime kapatılır ve HTTP server idle bağlantıları kapatılır.

## Gözlemlenebilirlik

`createRuntimeObservability()` request başına opaque bir token döndürür. Token, başlangıç zamanını saklayan internal map ile eşleşir; dışarıya request kimliği gibi kullanılmaz.

Metrik sözleşmesi:

- `requests`: başlayan request sayısı.
- `completed`: tamamlanmış request sayısı.
- `aborted`: istemci veya transport nedeniyle yarıda kalan request sayısı.
- `errors`: dört yüzlü ve beş yüzlü hataların sayısı.
- `active`: eşzamanlı aktif request sayısı.
- `peakActive`: process ömründeki en yüksek concurrency.
- `totalDurationMs`: tamamlanan request'lerin toplam süre birikimi.

`averageLatencyMs()` sıfır request durumunda güvenli olarak `0` döner. Snapshot immutable'dır.

## Model boundary

NVIDIA response normalizasyonu yalnız beklenen asistan mesajı, finish reason, usage ve tool call şekillerini kabul eder. Tool call sayısı ve argüman uzunluğu bounded tutulur.

Bu boundary model sağlayıcı değişse bile uygulamanın üst katmanlarına aynı normalize edilmiş şekli sunmak için kullanılır.

## Legacy bridge politikası

`.mjs` köprüleri geçiş boyunca korunur. Yeni kod doğrudan `.ts` canonical modüllerine bağlanabilir. Legacy bridge dosyasına yeni iş mantığı eklenmez.

Bir `.mjs` bridge kaldırılmadan önce:

- tüm import noktaları `.ts` canonical implementation'a taşınır,
- static/source contract testi eklenir,
- production startup ile smoke test edilir,
- rollback yolu belgelenir.

## Definition of done

Modern runtime tamamlanmış sayılır ancak şu koşullardan sonra:

- production `start` TS entrypoint kullanır,
- NodeNext config typecheck'e dahil edilir,
- critical boundary modüllerinin canonical implementation'ı TS'dir,
- legacy entrypoint bridge olarak korunur,
- runtime config validation test edilir,
- security boundary test edilir,
- observability snapshot test edilir,
- README migration davranışını açıklar.

## Sonraki aşamalar

Sonraki turlarda agent registry, scheduling ve connector boundary'leri aynı modele göre sırayla TypeScript'e taşınabilir. Her dönüşüm bağımsız PR ve rollback sınırı olarak tutulmalıdır.
