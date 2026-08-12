# Schedule lease guarded executor

Bu katman, `createScheduleExecutionLeaseBoundary()` ile schedule worker'ın `executeAgentTask` sözleşmesi arasında küçük bir entegrasyon sınırıdır.

## Amaç

Bir schedule agent görevi başlamadan önce execution lease alınır. Böylece aynı logical schedule birden fazla instance tarafından eşzamanlı yürütülmeye çalışıldığında gerçek distributed provider'ın verdiği lease/fencing kararı execution yolunda uygulanabilir.

## Davranış

`createScheduleLeaseGuardedExecutor({ lease, executeAgentTask })` worker'a verilebilecek bir `executeAgentTask(input)` fonksiyonu üretir.

- `acquired`: underlying agent görevi çalıştırılır.
- `busy`: agent çalıştırılmaz; `SCHEDULE_LEASE_BUSY` ve provider'ın doğrulanmış `retryAt` değeri döner.
- `completed`: agent yeniden çalıştırılmaz; sonuç deduplicated başarı olarak döner.
- Uzun görevlerde lease TTL'nin yarısı civarında heartbeat renew yapılır.
- Renew `stale` veya `completed` dönerse ya da renew başarısız olursa lease kaybedilmiş kabul edilir; agent sonucu başarılı olsa bile lease completion yapılmaz ve `SCHEDULE_LEASE_LOST` döner.
- Agent başarısız olursa lease release edilir ve özgün güvenli hata sonucu korunur.
- Agent başarılı olursa lease completion önce yazılır. Böylece store completion daha sonra başarısız olsa bile sonraki worker `acquire -> completed` görerek görevi tekrar çalıştırmadan local schedule state'i tamamlayabilir.
- Lease completion `stale` dönerse agent sonucu kabul edilmez.

## Fencing ve idempotency

Bu modül fencing token üretmez. `schedule-execution-lease.mjs` tarafından doğrulanmış `fence` değerini renew/complete/release çağrılarına aynen taşır. Deterministik idempotency key de lease boundary tarafından provider'a iletilir.

## Güvenlik sınırı

Bu modül tek başına distributed güvenlik sağlamaz. Gerçek garanti için lease adapter'ı Redis/Postgres gibi process dışı ortak storage üzerinde atomik compare-and-set/fencing davranışı uygulamalıdır.

Heartbeat sırasında lease kaybı underlying agent çalışmasını anında iptal etmez; mevcut scheduled-agent executor zincirinde ortak bir abort signal sözleşmesi henüz yoktur. Bu nedenle stale sonuç completion'a geçirilmez fakat görev sırasında yapılmış harici yan etkileri geri alamaz. Harici write/send/merge işlemlerinin mevcut explicit approval/idempotency kuralları bu nedenle korunmalıdır.

## Bu PR'ın özellikle yapmadıkları

- Redis/Postgres lease provider eklemez.
- `server.mjs` wiring yapmaz.
- Ajan registry veya tool permission değiştirmez.
- `.env`, secret, credential veya workflow dosyalarına dokunmaz.
- Worker retry politikasını değiştirmez; `SCHEDULE_LEASE_BUSY` sonucu mevcut worker failure/retry yolundan geçebilir.
