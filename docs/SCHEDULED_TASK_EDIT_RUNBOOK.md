# Schedule Edit Runbook

## Ön kontrol
Deployment öncesi `main` schedule testleri ve edit testleri birlikte çalıştırılmalıdır.

## Normal kullanım
Kullanıcı planlandı görevi açar, `Düzenle` ile alanları değiştirir veya hızlı erteleme düğmesini kullanır.

## Bulk kullanım
En fazla 40 kayıt seçilir. Bulk işlem mevcut tekil API'leri ardışık çağırır.

## Monitoring
HTTP status kodları, normalize error code ve mevcut traceId izlenir. Task body loglanmaz.

## Storage
Encrypted persistence aktifse update aynı envelope altında kaydedilir. Memory fallback kullanılıyorsa davranış yine bounded store ile sınırlıdır.

## Worker
Update sonrası runAt geçmişe alınamaz. Worker yalnız zamanı gelmiş scheduled kayıtları claim eder.

## Incident
Edit başarısızlığında panel yenilenir, ownership ve state tekrar okunur. Veri kaybı olmaması için delete/recreate yapılmaz.

## Rollback
Feature PR revert edilir. Worker ve eski endpointler kontrol edilir.
