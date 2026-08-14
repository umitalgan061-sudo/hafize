# Schedule Runtime Bridge

Bu katman `task-schedule-store` ve `schedule-worker` primitive'lerini Hafize'nin gerçek server-side agent execution yoluna bağlar.

## Amaç

Zamanı gelen bir schedule kaydı worker tarafından claim edildiğinde kayıt içindeki `traceId`, `agentId` ve `task` yeniden doğrulanır; ajan registry'den canonical olarak çözülür ve mevcut default-deny tool runtime üzerinden çalıştırılır. Schedule edilmek ajana yeni tool veya approval yetkisi vermez.

## Server-side model seçimi

Schedule kaydına model veya secret alanı eklenmez. Zamanlanmış görevlerin NVIDIA modeli yalnızca server environment üzerinden `HAFIZE_SCHEDULE_MODEL` ile seçilir. Worker loop yalnızca hem `NVIDIA_API_KEY` hem de geçerli bir schedule modeli varsa başlar.

Desteklenen bounded runtime ayarları:

- `HAFIZE_SCHEDULE_TICK_MS`: varsayılan 30 saniye; 5 saniye ile 5 dakika arasında sınırlandırılır.
- `HAFIZE_SCHEDULE_RUN_TIMEOUT_MS`: varsayılan 120 saniye; 10 saniye ile 5 dakika arasında sınırlandırılır.

Bu değerler credential değildir ve istemciye taşınmaz. `/api/health` yalnızca `scheduleWorkerConfigured` boolean durumunu gösterir; model adı veya secret döndürmez.

## Trace ve task ledger

Scheduled root run `schedule.run` action'ı ile yeni bir agent-run ledger açar fakat schedule kaydındaki mevcut `traceId` aynen korunur. Tool ve nested delegation kayıtları aynı ledger altında devam eder. Root execution depth `0` olduğu için ilk delegasyon HTTP agent-run yolu ile aynı depth semantiğine sahiptir.

## Güvenlik

- Registry agent nesnesi çağıran katmandan körlemesine kabul edilmez; `agent.id` ile canonical registry kaydı yeniden çözülür.
- Scheduled runner `approvalGranted: false` davranışını miras alan mevcut agent tool runtime'ını kullanır.
- Parent tool setleri nested child'a kopyalanmaz; her ajan için policy yeniden hesaplanır.
- NVIDIA çağrısı timeout ile bounded tutulur.
- Worker tick'leri overlap etmez.
- Exception mesajları schedule sonucuna veya log'a yazılmaz; yalnızca sanitize edilmiş error code kullanılır.
- `.env`, credential dosyaları ve `.github/workflows/` bu entegrasyon tarafından değiştirilmez.

## Bilinçli sınırlar

Bu PR public schedule create/update API'si, kalıcı database, distributed lease veya cloud cron sağlamaz. In-memory store process restartında kaybolur. Gerçek 7x24 cloud scheduling için persistence ve provider-trigger katmanı daha sonra ayrı ve incelemeli PR'larda eklenmelidir.
