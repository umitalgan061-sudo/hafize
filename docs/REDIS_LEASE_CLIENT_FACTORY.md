# Redis lease client factory

Bu katman, distributed schedule lease için Redis bağlantı secret'ını server-side ortamdan okuyup hazır bir Node Redis uyumlu client oluşturma sınırını tanımlar.

## Yapılandırma

`HAFIZE_SCHEDULE_REDIS_URL` yalnızca server-side environment / secret manager üzerinden sağlanmalıdır. Desteklenen şemalar:

- `redis://`
- `rediss://`

URL boşsa Redis lease client devre dışı kabul edilir. URL tanımlanmış ancak geçersizse startup fail-closed olur.

## Güvenlik sınırları

- URL istemci/PWA koduna, agent context'e veya response gövdesine taşınmaz.
- Config nesnesindeki `url` enumerable değildir; `JSON.stringify(config)` secret URL'yi yazmaz.
- URL içindeki username/password desteklenebilir ancak ayrı alanlara ayrıştırılıp loglanmaz.
- Fragment, NUL ve satır sonu içeren URL'ler reddedilir.
- Factory tüm `process.env` değerlerini Redis client'a aktarmaz; yalnızca `{ url }` verir.
- Connect/ready doğrulaması başarısız olursa açılmış client `quit()` veya `disconnect()` ile best-effort kapatılır.
- Alt Redis hata mesajları dışarı taşınmaz; generic `REDIS_LEASE_CLIENT_STARTUP_FAILED` kullanılır.

## Client sözleşmesi

`createRedisLeaseClient({ createClient })`, Node Redis benzeri bir factory bekler. Oluşan client en az:

- `connect()`
- `eval()`
- `isReady`

sözleşmesini sağlamalıdır. Bu PR `redis` npm paketini veya `server.mjs` wiring'ini eklemez. Böylece connection/secret boundary ayrı test edilir; gerçek paket importu ve lease runtime wiring bir sonraki küçük turda yapılabilir.

## Hata davranışı

- `INVALID_REDIS_LEASE_CLIENT_CONFIG`: Redis URL geçersiz.
- `REDIS_LEASE_CLIENT_UNAVAILABLE`: URL tanımlı fakat `createClient` factory verilmemiş.
- `REDIS_LEASE_CLIENT_STARTUP_FAILED`: client oluşturma/connect/ready aşaması başarısız.

Bu hata kodları credential veya bağlantı ayrıntısı içermez.
