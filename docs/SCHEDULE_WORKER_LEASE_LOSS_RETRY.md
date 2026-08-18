# Schedule Worker Lease-Loss Retry Contract

## Amaç

Bir schedule görevinin deneme hakkı yalnız görevin veya sağlayıcı yürütmesinin gerçek başarısızlığında tüketilmelidir. Dağıtık lease koordinasyonunun geçici olarak meşgul olması veya yürütme sırasında lease sahipliğinin kaybedilmesi görev mantığı hatası değildir.

Bu sözleşme `SCHEDULE_LEASE_BUSY` ve `SCHEDULE_LEASE_LOST` sonuçlarını worker seviyesinde bounded altyapı ertelemesi olarak tanımlar.

## Exact allowlist

Attempt refund yalnız şu iki exact hata kodunda uygulanır:

- `SCHEDULE_LEASE_BUSY`
- `SCHEDULE_LEASE_LOST`

Prefix, substring veya deny-list yaklaşımı kullanılmaz. Başka `SCHEDULE_*` kodları otomatik altyapı hatası sayılmaz.

Örneğin `SCHEDULE_EXECUTION_FAILED`, `MODEL_PROVIDER_FAILED` veya gelecekte eklenecek bilinmeyen bir hata normal retry/fail politikasından geçer ve görev deneme hakkını tüketebilir.

## Worker davranışı

Worker due görevi claim ettiğinde store attempt sayısını artırır. Executor exact refundable altyapı hatalarından birini döndürürse worker:

1. Hata kodunu bounded public error formatında doğrular.
2. Geçerli gelecekteki `retryAt` varsa onu kullanır.
3. `retryAt` yoksa, bozuksa veya geçmişteyse görevin bounded `retryDelayMs` değerinden fallback üretir.
4. `store.defer()` çağırır.
5. Store görevi yeniden `scheduled` yapar ve claim sırasında tüketilen tek attempt'i geri verir.
6. Sonuçta `attemptRefunded: true` ve `retryScheduled: true` bildirir.

Bu davranış kullanıcıya ekstra iş yetkisi vermez. Yalnız coordination failure nedeniyle mevcut görev hakkının yanlışlıkla tükenmesini önler.

## Lease busy ile lease lost farkı

`SCHEDULE_LEASE_BUSY`, başka bir worker'ın lease'i tuttuğu için yürütmenin başlamadığını ifade eder. Lease katmanı bounded bir `retryAt` önerebilir.

`SCHEDULE_LEASE_LOST`, yürütme başladıktan sonra lease yenilemesinin kaybedildiğini veya lease cancellation sinyalinin tetiklendiğini ifade eder. Bu durumda aynı attempt'i task failure olarak saymak doğru değildir; görev ertelenir ve attempt geri verilir.

Lease kaybında yan etkinin gerçekten sıfır olduğu iddia edilmez. Bir provider/tool çağrısı cancellation sinyalini ne kadar hızlı uyguluyorsa o kadar erken durabilir. Bu nedenle dış write/send/merge araçlarının ayrı explicit approval ve idempotency sınırları korunmaya devam etmelidir.

## Retry zamanı

Worker yalnız gelecekteki parse edilebilir `retryAt` değerini kabul eder. Geçmiş, eşit, boş veya parse edilemeyen değerler göz ardı edilir.

Fallback gecikmesi:

- schedule üzerinde geçerli `retryDelayMs` varsa onu kullanır;
- aksi halde worker fallback değeri kullanılır;
- bounded aralık 1 saniye ile 24 saat arasındadır.

Bu tur jitter veya yeni provider retry mekanizması eklemez.

## Attempt muhasebesi

Örnek: `maxAttempts = 1` olan görev ilk claim'de `attempts = 1` olur. `SCHEDULE_LEASE_LOST` sonrası `defer()` görevi yeniden `scheduled` yapar ve `attempts = 0` durumuna döndürür. Sonraki claim yeniden `attempts = 1` ile gerçek bir yürütme hakkına sahiptir.

Buna karşılık gerçek `MODEL_PROVIDER_FAILED` sonucu `maxAttempts = 1` iken normal fail yolundan geçer ve görev terminal `failed` durumuna gidebilir.

## Güvenlik sınırları

Bu değişiklik:

- agent registry'yi değiştirmez;
- yeni specialist eklemez;
- tool allowlist veya backend default-deny politikasını genişletmez;
- `approvalGranted: false` agent execution sınırını değiştirmez;
- GitHub/Gmail/Canva write/send/merge onaylarını atlamaz;
- secret veya credential değerlerini task/agent context'e eklemez;
- yeni endpoint, network isteği veya provider fallback oluşturmaz;
- persistent memory write eklemez;
- shell, exec, spawn veya terminal yürütme eklemez;
- `.env`, credential dosyaları veya `.github/workflows/` üzerinde değişiklik yapmaz.

## Restart recovery ile ilişki

Önceki restart recovery sözleşmesi process crash/deploy sonrasında durable store'da `running` kalmış görevleri yeniden `scheduled` yapar ve claim attempt'ini geri verir. Bu sözleşme aynı muhasebe ilkesini canlı lease kaybı için uygular.

Restart recovery ile canlı lease-loss refund birbirini tamamlar ancak aynı mekanizma değildir:

- restart recovery storage açılışında çalışır;
- lease-loss refund çalışan worker'ın executor sonucunu işlerken çalışır.

## DoD

Regresyon testleri en az şunları doğrulamalıdır:

- `SCHEDULE_LEASE_LOST` terminal task failure'a dönüşmez;
- `maxAttempts = 1` görev lease kaybından sonra yeniden çalışabilir;
- `SCHEDULE_LEASE_BUSY` mevcut refund davranışını korur;
- yalnız exact iki altyapı kodu refund alır;
- provider ve bilinmeyen schedule hataları refund almaz;
- geçerli future `retryAt` korunur;
- geçmiş/bozuk `retryAt` bounded fallback'e döner;
- public sonuç ham exception veya secret ayrıntısı taşımaz.

## Bilinen takip işi

Scheduled NVIDIA completion callback'inin dış lease/worker cancellation sinyalini production `server.mjs` katmanında kendi timeout sinyaliyle birleştirmesi ayrı bir güvenilirlik iyileştirmesidir. Bu sözleşme o takip işinin tamamlandığını iddia etmez.
