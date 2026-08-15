# User-controlled scheduling

Hafize zamanlanmış görev runtime'ı uygulama seviyesinde sabit bir toplam görev veya eşzamanlı due-task tavanı dayatmaz. Kullanıcı, sahip olduğu her görevin çalışma zamanını ayrı belirler; backend authorization, lease ve tool-policy sınırları ise değişmeden kalır.

## Kapasite sözleşmesi

- `createTaskScheduleStore()` varsayılan olarak toplam kayıt sayısını 128/1024 ile sınırlamaz.
- `claimDue()` varsayılan olarak due kayıtları 16'lık uygulama batch'ine kesmez.
- `createScheduleWorker()` varsayılan olarak tick başına 4/16 görev sınırı koymaz.
- Aynı tick'te claim edilen görevler `Promise.all` ile birbirinden bağımsız başlatılır.
- İstenirse deployment/test katmanı `maxEntries`, `maxBatch` veya `runDue({ limit })` ile bilinçli bir operasyonel sınır koyabilir; bu kullanıcı ürün sözleşmesinin gizli sabit tavanı değildir.

Bu yaklaşım “sonsuz fiziksel kaynak” garantisi vermez. Gerçek paralellik; proses, container, CPU, bellek, provider rate limitleri ve cloud platformunun kapasitesiyle sınırlanabilir. Hafize uygulaması bu limitleri keyfi küçük sabit sayılarla önceden daraltmaz.

## Kullanıcının zaman kararı

Yeni görev oluştururken `runAt` kullanıcı girdisidir. Görev henüz `scheduled` durumundayken aynı owner şu endpoint ile zamanı değiştirebilir:

`PATCH /api/schedules/:scheduleId`

Body yalnız şu alanı kabul eder:

```json
{ "runAt": "2026-08-15T18:30:00+03:00" }
```

- Zaman RFC3339/ISO uyumlu bir offset ile verilebilir ve store UTC ISO biçimine normalize eder.
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

## Hata ve retry davranışı

Worker executor exception ayrıntılarını dışarı sızdırmaz. Başarısız görevler mevcut `maxAttempts` bütçesine göre retry veya terminal failure alır. Lease-busy defer davranışı attempt'i iade eder ve mevcut fencing sözleşmesini korur.

## Doğrulama

`scripts/test-unbounded-user-schedules.mjs` şu regresyonları kilitler:

- 128 kayıt ve 16 claim üstündeki varsayılan kullanım;
- aynı anda 32 due execution'ın başlayabilmesi;
- owner-scoped reschedule;
- timezone offset'inin UTC'ye normalize edilmesi;
- başka owner'ın zamanı değiştirememesi;
- running görevin PATCH ile değiştirilememesi.

## Geri alma

Bu özellik geri alınacaksa store/worker default limitleri ve PATCH reschedule yolu birlikte geri alınmalıdır. Persistent şema değişmediği için veri migrasyonu gerektirmez.
