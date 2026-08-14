# Redis schedule lease runtime

Bu katman Redis distributed schedule lease zincirinin production composition sınırıdır.

## Akış

`createRedisScheduleLeaseRuntime()` şu bileşenleri sırayla birleştirir:

1. `readScheduleLeaseRuntimeConfig()` ile lease provider/holder/TTL yapılandırmasını doğrular.
2. Provider `redis` ise `HAFIZE_SCHEDULE_REDIS_URL` server-side config'ini doğrular.
3. `redis` paketini dinamik olarak yükler ve yalnızca `createClient` export'unu kullanır.
4. `createRedisLeaseClient()` ile client connect + ready doğrulamasını tamamlar.
5. Hazır client'ı `createRedisScheduleLeaseAdapter()` içine verir.
6. Adapter'ı `createScheduleLeaseProviderRuntime()` üzerinden fencing/idempotency boundary ile compose eder.

Lease config tamamen kapalıysa Redis modülü yüklenmez ve Redis bağlantısı açılmaz.

## Server-side secret sınırı

Redis URL yalnızca server-side environment/secret manager üzerinden gelir. Runtime sonucu Redis client veya URL döndürmez. Public response, agent context veya task ledger'a credential taşınmaz.

Redis provider seçilmiş fakat Redis URL eksik/geçersizse runtime sessizce tek-instance moda düşmez; startup `SCHEDULE_LEASE_RUNTIME_STARTUP_FAILED` ile kapanır.

## Hata ve cleanup davranışı

- Redis modülü yükleme, client startup, adapter veya provider runtime composition hataları generic startup hatasına dönüştürülür.
- Alt hata mesajındaki Redis URL/parola dışarı taşınmaz.
- Client açıldıktan sonra composition başarısız olursa bağlantı best-effort kapatılır.
- Başarılı runtime `close()` metodu sunar; close idempotent'tir ve Redis kapatma hatası `REDIS_LEASE_RUNTIME_CLOSE_FAILED` olarak sanitize edilir.

## Bağımlılık

Runtime production yolu resmi `redis` npm paketini kullanır. Paket yükleme dinamik olduğu için lease config kapalıyken Redis kodu startup kritik yoluna girmez.

## Bu PR'ın özellikle yapmadıkları

Bu katman `server.mjs` wiring yapmaz, Redis instance sağlamaz ve deployment secret'ı tanımlamaz. Bir sonraki adım server startup'ta bu runtime'ı oluşturup lease'i schedule execution runtime'a vermek ve shutdown sırasında `close()` çağırmaktır.
