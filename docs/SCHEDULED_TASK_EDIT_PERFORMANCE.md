# Schedule Edit Performance

Edit mutationı mevcut persistence kuyruğunu kullanır; yeni worker veya sürekli polling eklemez.

Tekil edit bir PATCH isteği ve tek bir persistence mutation'ıdır.

Quick postpone de tek PATCH kullanır.

Bulk postpone/cancel işlemleri en fazla 40 kayıtla sınırlandırılır ve tekil endpoint'leri ardışık çağırır. Böylece eşzamanlı mutation yarışları azaltılır.

Panel mevcut 30 saniyelik refresh döngüsünü kullanmaya devam eder.

Liste 128 kayıtla sınırlandırılmıştır.

UI DOM üretimi mevcut satır listesi ile aynı sınırlar içinde tutulur.

Yeni feature server-side analytics veya browser telemetry oluşturmaz.
