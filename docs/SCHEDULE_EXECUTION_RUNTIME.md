# Schedule execution runtime

Bu katman, schedule worker'ın kullandığı agent executor ile opsiyonel distributed execution lease guard arasında tek bir composition sınırı sağlar.

## Davranış

`createScheduleExecutionRuntime({ executor, lease })` iki moddan birini seçer:

- `lease == null`: mevcut `executor.executeAgentTask` davranışı korunur ve `leaseGuarded: false` döner. Her iki modda da sonuç worker sözleşmesine `projectWorkerResult` ile yansıtılır; `content`, `taskLedger`, `leaseStatus` ve `deduplicated` gibi iç metadata worker'a taşınmaz.
- `lease` verilmişse: executor `createScheduleLeaseGuardedExecutor` ile sarılır ve `leaseGuarded: true` döner.

Bu nedenle tek-instance kurulumlarda lease provider zorunlu değildir; distributed deployment'a geçildiğinde aynı worker sözleşmesi korunabilir.

## Güvenlik sınırı

Runtime kendisi Redis/Postgres bağlantısı, credential veya lease state saklamaz. Gerçek provider ayrı server-side config/runtime katmanında oluşturulmalıdır. Guard oluşturulurken oluşan alt seviye hata ayrıntıları `SCHEDULE_EXECUTION_RUNTIME_STARTUP_FAILED` olarak sanitize edilir.

`configured` değeri mevcut scheduled-agent executor'ın inference hazırlık durumunu taşır; lease varlığı inference yapılandırmasını yükseltmez veya ajan tool permission'larını değiştirmez.

## Bu PR'ın yapmadıkları

- `server.mjs` içine lease provider bağlamaz.
- Redis/Postgres adapter eklemez.
- Secret veya `.env` değişikliği yapmaz.
- Worker'ın external write/send/merge approval kurallarını değiştirmez.

Sonraki wiring adımında server yalnızca gerçekten process-dışı atomik lease provider yapılandırılmışsa `lease` vermelidir. Provider yoksa mevcut tek-instance executor davranışı aynen kalmalıdır.
