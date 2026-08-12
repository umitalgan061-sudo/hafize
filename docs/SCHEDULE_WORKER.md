# Schedule Worker Adapter

`lib/schedule-worker.mjs`, `task-schedule-store` içindeki due görevleri claim edip mevcut agent execution katmanına güvenli biçimde taşıyan provider-bağımsız worker adapter'ıdır.

## Sorumluluk

- Due görevleri bounded batch ile claim eder.
- Schedule kaydındaki `traceId`, `agentId` ve `task` değerlerini executor'a taşır.
- Agent kimliğini registry'den yeniden çözer; bilinmeyen ajan model çağrısından önce reddedilir.
- Başarılı görevleri `completed`, başarısız görevleri retry bütçesine göre tekrar `scheduled` veya terminal `failed` yapar.
- Executor exception mesajlarını dışarı sızdırmaz; `SCHEDULE_EXECUTION_FAILED` koduna indirger.

## Güvenlik sınırı

Worker kendi başına tool permission üretmez, approval vermez veya connector çağırmaz. `executeAgentTask` adapter'ı mevcut backend default-deny agent runtime'ını kullanmalıdır. Bu nedenle schedule edilmek, ajana yeni bir yetki kazandırmaz.

Worker yeni secret alanı oluşturmaz ve schedule kaydındaki verileri olduğu gibi agent context'ine genişletmez. Store sözleşmesindeki `traceId`, `agentId` ve `task` dışında credential/token taşıma yolu yoktur.

## Bounded davranış

- `maxBatch` 1-16 aralığına sınırlandırılır.
- `retryDelayMs` 1 saniye ile 24 saat aralığına sınırlandırılır.
- Retry sayısı worker tarafından değil store'daki `maxAttempts` sözleşmesiyle yönetilir.

## Bu PR'ın kapsamadıkları

- Kalıcı database/persistence
- Distributed lease veya çoklu worker locking
- Cloud cron/provider entegrasyonu
- Kullanıcıya schedule CRUD API/UI
- Dış yazma/gönderme/merge için approval akışı

Bunlar ayrı, küçük ve geri alınabilir geliştirme turları olmalıdır.
