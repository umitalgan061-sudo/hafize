# Redis schedule lease adapter

Bu adapter, `schedule-execution-lease` boundary'sinin beklediği acquire / renew / complete / release provider sözleşmesini Redis'in atomik Lua execution modeliyle uygular.

## Neden Redis?

Lease kararlarının aynı anda birden fazla Hafize instance'ı tarafından verilmesi durumunda read-modify-write adımlarının process belleğinde değil provider içinde atomik olması gerekir. Redis Lua scriptleri acquire, renew, complete ve release kararlarını tek atomik işlem içinde çalıştırır.

Adapter `createRedisScheduleLeaseAdapter({ redis, keyPrefix })` ile oluşturulur. `redis` nesnesinin Node Redis v4 uyumlu şu çağrıyı desteklemesi beklenir:

```js
await redis.eval(script, { keys, arguments })
```

Bu PR Redis client bağlantısı oluşturmaz, URL/parola okumaz ve yeni npm bağımlılığı eklemez. Bağlantı factory'si daha sonraki server-side wiring katmanında ayrı tutulmalıdır.

## Atomiklik ve fencing

Acquire scripti:

- önce completed marker kontrol eder;
- Redis `TIME` komutunu provider saati olarak kullanır;
- aktif lease varsa Redis PTTL üzerinden `busy/retryAt` üretir;
- lease boşsa per-schedule `INCR` ile monoton fencing token üretir;
- holder + fence token'ını TTL'li lease key'ine yazar.

Renew yalnızca aynı holder + fence token hâlâ lease sahibiyse TTL'i uzatır. Complete ve release de aynı fencing kontrolünü yapar. Böylece eski worker yeni fence üretildikten sonra stale kalır.

## Idempotency

Successful completion kalıcı bir completed marker yazar. Sonraki acquire `completed`, tekrarlanan complete ise `already_completed` döndürür. Completed marker otomatik TTL almaz; execution idempotency bilgisinin schedule cleanup politikasıyla birlikte ileride açıkça temizlenmesi gerekir.

## Redis Cluster

Aynı schedule'a ait lease, fence ve completed key'leri `{scheduleId}` hash tag'i kullanır. Böylece Lua scriptindeki tüm KEYS aynı Redis Cluster slot'una düşer.

## Güvenlik sınırları

- Redis URL, kullanıcı adı, parola veya TLS credential bu adapter'a verilmez; adapter yalnızca hazır `redis.eval()` client'ını alır.
- Provider exception ayrıntıları `REDIS_SCHEDULE_LEASE_FAILED` altında sanitize edilir.
- Key prefix ve schedule/holder/idempotency değerleri bounded karakter setiyle doğrulanır.
- Client-side veya agent context içine Redis secret taşınmaz.
- Adapter local/in-memory distributed lock taklidi yapmaz.

## Bu PR'ın yapmadıkları

- Redis bağlantı factory'si / secret config eklemez.
- `server.mjs` wiring yapmaz.
- Redis schema migration veya completed-marker garbage collection eklemez.
- Redis failover'ın altyapı seviyesindeki durability garantilerini taklit etmez; production Redis deployment'ın kendi HA/persistence politikası ayrıca seçilmelidir.
