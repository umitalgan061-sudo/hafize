# Schedule execution lease sözleşmesi

Bu katman, Hafize scheduler'ın ileride birden fazla server instance üzerinde çalıştırılması veya crash-recovery uygulanması sırasında aynı schedule'ın eşzamanlı ya da stale worker tarafından iki kez yürütülmesi riskini azaltmak için provider-bağımsız execution lease sınırını tanımlar.

## Temel sözleşme

`createScheduleExecutionLeaseBoundary({ adapter, holderId, leaseMs, providerTimeoutMs })` dört atomik provider operasyonu bekler:

- `acquire({ scheduleId, holderId, leaseMs })`
- `renew({ scheduleId, holderId, fence, leaseMs })`
- `complete({ scheduleId, holderId, fence, idempotencyKey })`
- `release({ scheduleId, holderId, fence })`

Provider zamanın otoritesidir. Boundary provider'a client/server timestamp göndermez; böylece farklı instance saatleri arasındaki clock skew lease kararının kaynağı olmaz.

## Provider çağrı timeout'u

Her provider çağrısı bounded bir süre içinde sonuçlanmalıdır. Varsayılan timeout lease TTL'nin dörtte biri olarak hesaplanır; en az 100 ms, en fazla 5 saniyedir ve her durumda lease TTL'den en az 100 ms daha kısa tutulur. `providerTimeoutMs` verilirse aynı güvenli sınırlar içinde clamp edilir.

Provider timeout'u veya provider exception ayrıntıları boundary dışına taşınmaz; her ikisi de `SCHEDULE_LEASE_PROVIDER_FAILED` olarak sanitize edilir. Böylece Redis bağlantı URL'si, parola veya alt provider hata metni agent/worker sonucuna sızmaz.

Generic boundary alttaki provider Promise'ını zorla iptal etmez. Timeout sonrasında provider işlemi geç tamamlanırsa atomik fencing/idempotency sözleşmesi doğruluk sınırı olmaya devam eder; acquire/renew gibi geç işlemler en fazla mevcut lease TTL boyunca geçici contention yaratabilir. Bu nedenle provider adapter'ları kendi bağlantı/command timeout ve cancellation yeteneklerini ayrıca kullanabilir.

## Fencing token

Başarılı acquire sonucu pozitif ve monotonik olarak ilerleyen bir `fence` değeri taşımalıdır. Provider, renew/complete/release sırasında holder ve fence değerini atomik olarak doğrulamalıdır.

Eski bir worker lease süresi bittikten ve yeni worker daha yüksek fence aldıktan sonra çalışmaya devam etse bile, eski fence ile completion yazamamalıdır. Boundary `stale` sonucunu açık sözleşme olarak taşır.

## Idempotency

Her logical schedule execution için deterministik anahtar kullanılır:

`schedule-execution:<scheduleId>`

`complete()` bu anahtarı provider'a geçirir. Provider completed marker'ını atomik biçimde tutmalı ve tamamlanmış bir schedule için sonraki acquire çağrılarını `completed` döndürmelidir. Bu anahtar secret değildir ve dış tool idempotency desteği geldiğinde aynı logical execution kimliğinin temelini oluşturabilir.

## Beklenen provider durumları

Acquire: `acquired`, `busy`, `completed`.

Renew: `renewed`, `stale`, `completed`.

Complete: `completed`, `already_completed`, `stale`.

Release: `released`, `stale`, `completed`.

Provider exception ayrıntıları boundary dışına taşınmaz; `SCHEDULE_LEASE_PROVIDER_FAILED` kullanılır. Geçersiz provider response'ları `SCHEDULE_LEASE_PROVIDER_INVALID_RESPONSE:*` ile reddedilir.

## Bu katmanın yapmadıkları

Bu modül belirli bir distributed provider seçmez. In-memory reference provider production çözümü olarak eklenmemiştir. Bunun nedeni lease güvenliğinin gerçekten atomik, ortak ve process dışı bir storage primitive'ine dayanması gerektiğidir.

Gerçek provider adapter'ları bu sözleşmenin atomic compare-and-set / transaction yeteneklerini uygulamalı; worker execution başlamadan önce acquire, uzun görevlerde renew ve terminal success'te complete akışı fencing/idempotency sınırı üzerinden yürütülmelidir.
