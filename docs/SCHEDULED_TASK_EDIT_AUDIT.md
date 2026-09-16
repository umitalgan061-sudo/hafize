# Schedule Edit Audit Invariants

Bir edit işlemi schedule kimliğini değiştirmez.

`createdAt` geçmiş kaydın başlangıç zamanını temsil etmeye devam eder.

`updatedAt` başarılı update'i işaret eder.

`traceId` yürütme izini korur; edit yeni execution kaydı oluşturmaz.

`attempts` korunur; yalnız maxAttempts artırılabilir veya aynı bırakılabilir.

`lastError` başarılı yeni task/update sonrasında temizlenir.

Repeat-plan yeni scheduleId ve yeni traceId üretir.

Bulk operations her kaynak kaydı kendi mutation sonucu üzerinden değerlendirir.

Bu invariants persistence snapshot round-trip sonrası da korunur.
