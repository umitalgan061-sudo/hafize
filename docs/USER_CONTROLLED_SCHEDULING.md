# User-controlled scheduling

Hafize zamanlanmış görev runtime'ı uygulama seviyesinde sabit bir toplam görev veya eşzamanlı due-task tavanı dayatmaz. Kullanıcı, sahip olduğu her görevin çalışma zamanını ve retry gecikmesini ayrı belirler; backend authorization, lease ve tool-policy sınırları ise değişmeden kalır.

## Kapasite sözleşmesi

- `createTaskScheduleStore()` varsayılan olarak toplam kayıt sayısını 128/1024 ile sınırlamaz.
- `claimDue()` varsayılan olarak due kayıtları 16'lık uygulama batch'ine kesmez.
- `createScheduleWorker()` varsayılan olarak tick başına 4/16 görev sınırı koymaz.
- Aynı tick'te claim edilen görevler `Promise.all` ile birbirinden bağımsız başlatılır.
- İstenirse deployment/test katmanı `maxEntries`, `maxBatch` veya `runDue({ limit })` ile bilinçli bir operasyonel sınır koyabilir; bu kullanıcı ürün sözleşmesinin gizli sabit tavanı değildir.

Bu yaklaşım “sonsuz fiziksel kaynak” garantisi vermez. Gerçek paralellik; proses, container, CPU, bellek, provider rate limitleri ve cloud platformunun kapasitesiyle sınırlanabilir. Hafize uygulaması bu limitleri keyfi küçük sabit sayılarla önceden daraltmaz.

## Kullanıcının zaman kararı

Yeni görev oluştururken `runAt` kullanıcı girdisidir. Public schedule API zaman dilimini tahmin etmez: `runAt` değeri RFC3339 biçiminde açık `Z` veya `±HH:MM` offset'i taşımalıdır. Store değeri UTC ISO biçimine normalize eder.

Görev henüz `scheduled` durumundayken aynı owner şu endpoint ile zamanı veya retry gecikmesini değiştirebilir:

`PATCH /api/schedules/:scheduleId`

Body yalnız `runAt` ve/veya `retryDelayMs` kabul eder:

```json
{
  "runAt": "2026-08-15T18:30:00+03:00",
  "retryDelayMs": 30000
}
```

- `retryDelayMs` görev bazındadır ve 1 saniye ile 24 saat arasında tam sayı milisaniye olmalıdır.
- Retry gerektiğinde worker gizli sabit 60 saniye yerine görevin kendi `retryDelayMs` değerini kullanır; alan verilmezse geriye uyumluluk için 60 saniye varsayılanı uygulanır.
- Lease provider geçerli, gelecekte bir `retryAt` döndürürse fencing/lease kararı korunur ve bu zaman önceliklidir.
- Başka owner'ın görevi `SCHEDULE_NOT_FOUND` olarak görünür; sahiplik bilgisi sızdırılmaz.
- `running`, `completed`, `failed` veya `cancelled` görev yeniden zamanlanamaz.
- PATCH body içine token, ownerId, agentId, task veya başka alan eklenirse komut reddedilir.

## Eşzamanlılık ve güvenlik

Paralel execution, aynı schedule kaydının iki kez çalıştırılmasına izin vermez. Claim geçişi önce `scheduled -> running` olarak store/persistence katmanında tamamlanır. Distributed deployment'taki Redis lease/fencing ve scheduled-agent execution sınırları korunur.

Paralel görev sayısının artması tool yetkilerini genişletmez:

- agent registry aynı dört profilde kalır;
- backend tool authorization default-deny kalır;
- dış yazma/gönderme/merge açık approval gerektirir;
- secret değerleri schedule kaydına veya agent context'ine eklenmez;
- selector/specialist delegasyon topolojisi değiştirilmez.

## Dayanıklılık

Kalıcı schedule adapter'ında task execution paralel olabilir fakat snapshot mutasyonları ve disk save sırası serialize edilmeye devam eder. Böylece çok sayıda completion aynı anda gelse bile persistence katmanında lost-update yarışı açılmaz. Eski schema-v1 snapshot'larında `retryDelayMs` yoksa yükleme sırasında güvenli 60 saniye varsayılanı kullanılır; veri migrasyonu zorunlu değildir.

## Doğrulama

Scheduler regresyonları şunları kilitler:

- 128 kayıt ve 16 claim üstündeki varsayılan kullanım;
- aynı anda 32 due execution'ın başlayabilmesi;
- durable store üzerinde parallel execution + serialize persistence;
- owner-scoped `runAt` ve `retryDelayMs` değişikliği;
- timezone'suz zamanların public command katmanında reddedilmesi;
- retry gecikme sınırları ve per-task retry hesabı;
- başka owner'ın zamanı değiştirememesi;
- running görevin PATCH ile değiştirilememesi;
- PATCH ile ownerId/token/task enjeksiyonunun reddedilmesi.

## Geri alma

Bu özellik geri alınacaksa store/worker default limitleri, per-task retry timing ve PATCH reschedule yolu birlikte geri alınmalıdır. Persistent şema geriye uyumlu tutulduğu için zorunlu veri migrasyonu yoktur.
