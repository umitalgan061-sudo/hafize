# Schedule reliability

Schedule worker sonuçları artık ayrı bir reliability contract'tan geçer. `SCHEDULE_LEASE_BUSY` yalnızca deferred/retry ve attempt refund durumuna dönüşür; diğer hatalar bounded error code ile retry/terminal kararına ayrılır.

Worker'ın provider veya modelden aldığı ham sonuç doğrudan storage'a yazılmaz. `classifyScheduleOutcome()` aynı schedule state + result girdisinde deterministik karar üretir.

Bu katman lease sahibi değildir ve depolama implementasyonunu değiştirmez; mevcut `claimDue()`, `complete()`, `fail()` ve opsiyonel `defer()` sözleşmesini korur.
