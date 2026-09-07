# Trace consistency

Agent/tool/task ledger zincirleri aynı `traceId` ile ilişkilendirilir ve task-parent ilişkileri normalize edilir. Trace id ve task id formatları bounded tutulur; self-parent ilişkisi reddedilir.

`createAgentRunLedger()` snapshot yanında trace kimliğini de açıkça taşır. Tool ve delegation task'leri oluşturulmadan önce verilen parent task'ın aynı ledger içinde gerçekten var olduğu ve aynı trace'e ait olduğu doğrulanır. Böylece çağıranın taşıdığı keyfi bir task id ledger ağacına sessizce bağlanamaz.

Tool/delegation sonuçlarının `detail` alanı sınırlanarak provider hata metninin sınırsız biçimde ledger'a dolması engellenir. Finish işlemleri yalnız kendi task tiplerine uygulanabilir; root task bir tool/delegation sonucu gibi kapatılamaz.

Bu katman observability sağlar; auth veya authorization kararı vermez. `traceId` korelasyon anahtarıdır, credential değildir.

## Model yanıtı sınırı

NVIDIA chat completion yanıtları delegated-agent akışına girmeden önce `lib/model-response-contract.mjs` içindeki provider adaptöründen normalize edilir. Provider'ın OpenAI-uyumlu envelope'u doğrudan task/tool mantığına taşınmaz; assistant rolü, content, finish reason, tool call id/name/argument boyutları, usage ve response kimliği ortak sözleşmeden geçer. Geçersiz çıktı mevcut public `INVALID_NVIDIA_RESPONSE` yüzeyine düşer.
