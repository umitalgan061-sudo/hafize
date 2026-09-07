# Trace consistency

Agent/tool/task ledger zincirleri aynı `traceId` ile ilişkilendirilir ve task-parent ilişkileri normalize edilir. Trace id ve task id formatları bounded tutulur; self-parent ilişkisi reddedilir.

`createAgentRunLedger()` artık snapshot yanında trace kimliğini de açıkça taşır. Tool/delegation sonuçlarının `detail` alanı sınırlanarak provider hata metninin sınırsız biçimde ledger'a dolması engellenir.

Bu katman observability sağlar; auth veya authorization kararı vermez. `traceId` korelasyon anahtarıdır, credential değildir.
