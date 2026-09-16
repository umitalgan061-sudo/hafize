# Modern Runtime Security

## Tehdit modeli

Runtime iki ayrı sınırı korur: tarayıcıdan gelen kullanıcı verisi ve dış model/connector servislerinden dönen yanıtlar. TypeScript migration güvenliği tek başına sağlamaz; bütün external data validation ve least-privilege kuralları aynen devam eder.

## Secret yönetimi

NVIDIA, GitHub, Gmail ve Canva secret'ları TypeScript source içine yazılmaz. `process.env` yalnız configuration boundary içinde okunur. Log ve public health response secret değerlerini döndürmez.

## Upstream bağlantıları

NVIDIA istekleri HTTPS endpoint üzerinden yapılır. Request abort ile timeout aynı AbortSignal üzerinde birleştirilir. Böylece bağlantı kopması ve uzun süren upstream yanıtları bounded olur.

## Body limits

JSON request body bounded olarak okunur. Limit aşıldığında `413 BODY_TOO_LARGE` döner. Body tamamını belleğe almadan önce byte sayısı kontrol edilir.

## Model output limits

Model response contract içerik, finish reason, tool call sayısı, tool call id/name ve argüman uzunluğunu sınırlar. Normalize edilmiş response dışında upstream response doğrudan UI'a taşınmaz.

## Tool execution

Tool çağrıları agent policy ile sınırlandırılır. Tool sonucunun ham upstream tanı verisi request failure boundary tarafından client'a aktarılmaz. Delegation ve external write işlemleri mevcut kullanıcı izin kurallarına tabidir.

## Static file safety

Path traversal normalize edilen absolute path ile engellenir. `public` dışındaki dosyalara erişim reddedilir. `.ts` kaynakları runtime static endpoint'inden sunulmaz.

## Authentication

Bearer authentication comparison timing-safe olarak yapılır. Token whitespace, minimum ve maksimum uzunluk ile doğrulanır. Subject bounded ve non-empty olmalıdır.

## Error handling

Client-facing error codes kararlı ve sınırlıdır. Upstream error detail server side kalır. SSE response zaten başladıysa JSON body yazmak yerine protokol uyumlu terminal event kullanılır.

## Shutdown security

SIGINT ve SIGTERM aynı idempotent yolu kullanır. Scheduler timer durur, aktif tick tamamlanır, lease bağlantısı kapatılır ve HTTP idle bağlantıları kapatılır.

## Observability privacy

Runtime metrics yalnız sayısal/operasyonel özetlerden oluşur. Request body, prompt, model output, credential veya connector token metric state'ine yazılmaz. Request handle opaque `symbol` olarak tutulur.

## Security DoD

- [ ] secret source içinde yok.
- [ ] upstream URL HTTPS.
- [ ] request body bounded.
- [ ] upstream timeout bounded.
- [ ] model response normalized.
- [ ] error detail client'a sızmıyor.
- [ ] static traversal korunuyor.
- [ ] `.ts` source public endpoint'te yok.
- [ ] bearer comparison timing-safe.
- [ ] graceful shutdown idempotent.
- [ ] metrics prompt veya credential taşımıyor.

## Regression policy

Yeni runtime migration PR'ları önce mevcut security tests'i çalıştırmalı. Bir security testinin kapsamı migration nedeniyle değişiyorsa test davranış değişikliğinin yanında güncellenmeli; yalnız warning'e çevrilmemelidir.
