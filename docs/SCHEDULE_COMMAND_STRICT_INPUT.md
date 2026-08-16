# Schedule command strict-input contract

## Amaç

Hafize zamanlanmış görev API'si kullanıcı girdisini persistence katmanına göndermeden önce kesin ve non-coercive biçimde doğrular. Store katmanındaki savunmacı normalizasyon, HTTP/command sınırında gevşek kabul davranışı olarak kullanılmaz.

Bu sözleşme özellikle istemci girdisinin sessizce başka bir değere dönüştürülmesini ve geçersiz isteğin trace/persistence yan etkilerine kadar ilerlemesini engeller.

## Create allowlist'i

Create isteği yalnız şu alanları kabul eder:

- `agentId`
- `task`
- `runAt`
- `maxAttempts`
- `retryDelayMs`

Bunun dışındaki `ownerId`, `traceId`, token, secret veya başka bir alan `INVALID_SCHEDULE_COMMAND` ile reddedilir. Owner kimliği authenticated principal'dan, trace kimliği ise yalnız server-side `createTraceId()` yolundan üretilir.

## Girdi sınırları

- `agentId`: trim sonrası boş olamaz, en fazla 120 karakterdir ve CR/LF/NUL içeremez. Ayrıca exact registry kimliğiyle eşleşmelidir.
- `task`: trim sonrası boş olamaz, en fazla 20.000 karakterdir ve NUL içeremez.
- `runAt`: tam RFC3339 tarih-saat olmalıdır; tarih-only veya timezone içermeyen değer kabul edilmez.
- `maxAttempts`: verilirse yalnız integer `1..5` kabul edilir. String, float, sıfır, negatif veya 5 üstü değer clamp edilmez.
- `retryDelayMs`: mevcut task-store timing sınırları içinde safe integer olmalıdır.
- principal subject: authenticated olmalı, trim sonrası boş olmamalı, en fazla 200 karakter olmalı ve CR/LF/NUL taşımamalıdır.

## Side-effect sırası

Create akışı aşağıdaki sırayı korur:

1. Principal doğrulanır.
2. Tüm create alanları ve timing girdisi doğrulanır.
3. `agentId` registry içinde exact eşleştirilir.
4. Server-side trace kimliği üretilir.
5. Ancak bundan sonra store `add()` çağrılır.

Bu sıranın sonucu olarak malformed input, unknown field, invalid agent veya invalid retry/max-attempt değeri trace allocation veya persistence çağrısı üretmez.

## Schedule ID sınırı

Cancel ve reschedule yolları yalnız `schedule_[1-9][0-9]*` biçimindeki, en fazla 120 karakterlik ve numeric bölümü JavaScript safe-integer aralığında olan kimlikleri kabul eder.

Malformed schedule ID storage lookup'a gönderilmez. Geçerli formatlı fakat bulunmayan veya başka owner'a ait schedule kimliği `SCHEDULE_NOT_FOUND` ile aynı biçimde döner; böylece cross-owner kayıt varlığı sızdırılmaz.

## Reschedule

Reschedule yalnız `runAt` ve `retryDelayMs` alanlarını kabul eder ve en az birinin mevcut olmasını zorunlu tutar. Unknown field veya invalid timing storage ownership lookup'ından önce reddedilir.

Yalnız owner'a ait ve hâlâ `scheduled` durumundaki kayıt değiştirilebilir. Tamamlanmış/çalışan/iptal edilmiş kayıtlar mevcut command boundary durum kurallarına göre fail-closed kalır.

## Error sanitization

Store, trace generator veya persistence sağlayıcısından gelen ham exception metni API cevabına taşınmaz. Beklenmeyen internal hata `SCHEDULE_COMMAND_FAILED` olarak normalize edilir.

Capacity ve mevcut tanımlı schedule transition hataları yalnız allowlist edilmiş public hata kodlarına çevrilir.

## Değişmeyen mimari sınırlar

Bu değişiklik:

- yeni ajan eklemez ve dört profilli selector/specialist roster'ı değiştirmez;
- tool permission genişletmez;
- backend default-deny yaklaşımını değiştirmez;
- dış write/send/merge approval sınırını kaldırmaz;
- secret veya credential değerini agent context'e eklemez;
- `.env`, credential veya `.github/workflows/` dosyalarına dokunmaz;
- schedule worker, distributed lease ve encrypted storage şemalarını değiştirmez.

## Test sözleşmesi

Regresyon testleri şu katmanları ayrı ayrı kilitler:

- create alanlarının strict non-coercive doğrulanması;
- invalid girdinin trace/store yan etkisi üretmemesi;
- schedule ID ve owner isolation davranışı;
- HTTP status mapping ve unauthenticated body'nin parse edilmemesi;
- source-level validation-before-side-effect sırası ve yasak güvenlik yüzeyleri.

## Geri alma

Revert sırasında `schedule-command-boundary.mjs` strict validation değişiklikleri ve bu tura ait test/belge kaldırılır. Task store snapshot formatında, persistent schedule kaydında veya worker state'inde migrasyon olmadığı için veri dönüşümü gerekmez.
