# Task Schedule Store

Bu modül, Hafize'nin uygulama kapalıyken de çalışabilecek zamanlanmış agent görevleri için küçük ve provider-bağımsız bir server-side sözleşme oluşturur.

Bu PR henüz cloud cron, kalıcı veritabanı veya otomatik worker başlatmaz. Amaç önce güvenli görev yaşam döngüsünü sabitlemektir; sonraki cloud worker aynı primitive'i kalıcı store adapter'ı ile kullanabilir.

## Sözleşme

`createTaskScheduleStore()` tek seferlik zamanlanmış görevleri şu alanlarla tutar:

- `scheduleId`: store tarafından üretilen kimlik.
- `traceId`: ileride agent run/task ledger ile aynı trace'i devam ettirmek için saklanan kimlik.
- `agentId`: çalıştırılacak registry ajanı.
- `task`: bounded görev metni, en fazla 20.000 karakter.
- `runAt`: UTC ISO zaman damgası.
- `status`: `scheduled`, `running`, `completed`, `failed` veya `cancelled`.
- `attempts` / `maxAttempts`: retry bütçesi; `maxAttempts` en fazla 5.
- `lastError`: yalnızca sanitize edilmiş büyük-harf hata kodu.

Store en fazla 128 kayıtla başlar; yapılandırılabilir üst sınır 1024'tür. `claimDue()` tek çağrıda en fazla 16 görevi claim eder ve `scheduled -> running` geçişini atomik store mutasyonu olarak yapar. Aynı kayıt `running` durumundayken tekrar claim edilmez.

## Retry davranışı

Başarısız bir `running` görev, retry bütçesi kaldıysa ve gelecekte bir `retryAt` verilmişse yeniden `scheduled` olur. Bütçe bittiyse terminal `failed` durumuna geçer. Geçersiz retry zamanı state'i değiştirmeden reddedilir.

Bu primitive otomatik backoff seçmez; retry zamanını ilerideki worker/policy katmanı belirler. Böylece provider veya ürün politikası bu düşük seviye store'a gömülmez.

## Güvenlik sınırları

- `add()` yalnızca `traceId`, `agentId`, `task`, `runAt` ve `maxAttempts` alanlarını kabul eder; token/credential gibi ek alanlar reddedilir.
- Secret'lar için ayrı alan veya persistence yolu yoktur. Görev metnine secret koymak yine yasaktır; çağıran katman bu kuralı korumalıdır.
- Bu modül herhangi bir connector, external write/send/merge veya OAuth işlemi çalıştırmaz.
- Agent tool permission'ları schedule oluştururken genişletilmez; gerçek çalıştırmada mevcut backend default-deny enforcement yeniden uygulanmalıdır.
- Snapshot ve read sonuçları kopyadır; dış kod store state'ini doğrudan değiştiremez.

## Bilinçli kapsam dışı

Bu turda recurrence/cron expression, kalıcı veritabanı, distributed lease, cloud authentication, UI endpoint'i ve gerçek agent execution worker'ı eklenmedi. Bunlar ayrı, küçük ve test edilebilir PR'lar olarak bağlanmalıdır.
