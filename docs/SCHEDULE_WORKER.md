# Schedule Worker — Burst ve Retry Davranışı

`lib/schedule-worker.mjs` due görevleri claim edip mevcut agent execution katmanına güvenli biçimde taşır. Bu turdaki worker davranışı tek görevlik küçük kuyruklar kadar büyük backlog'lar için de bounded throughput sağlar.

## Claim modeli

Worker `claimDue({ limit })` ile yalnız henüz çalıştırılmamış ve zamanı gelmiş `scheduled` kayıtları claim eder. Claim sırasında durum `running` olur ve attempt sayısı artırılır.

Claim batch'i 64 ile sınırlandırılmıştır. Worker tek tick içinde birden fazla batch tüketebilir; `maxBatchesPerTick` ayrıca bounded tutulur.

## Kontrollü concurrency

Her batch, `maxConcurrent` değerine göre execution wave'lerine ayrılır. Varsayılan eşzamanlılık 4, maksimum 8'dir.

Bu sınır tüm görevlerin aynı anda başlamasını engeller. Bir görev provider hatası verse bile aynı wave'deki diğer görevlerin sonucu `Promise.allSettled` ile toplanır; tek rejection bütün tick'i düşürmez.

## Retry

Her schedule `maxAttempts` değerini taşır. Başarısız işlem bu sayıya ulaşmadan önce tekrar `scheduled` durumuna dönerek gelecekteki retry zamanına alınır.

Lease kaynaklı `SCHEDULE_LEASE_BUSY` durumunda attempt refund edilir. Böylece lease yarışının gerçek execution failure olarak sayılması önlenir.

## Agent kaybı

Registry'de schedule'ın agent id'si bulunmazsa görev kontrollü olarak `failed` durumuna geçirilir. Worker hayali bir agent çalıştırmaya çalışmaz.

## Büyük backlog

Yüksek hacimli due task kümelerinde worker maksimum concurrency'yi aşmadan çoklu batch tüketebilir. Bu yaklaşım throughput ile downstream kaynak koruması arasında deterministik bir sınır oluşturur.

## Multi-instance

Redis lease mevcut olduğunda aynı schedule'ın birden fazla worker tarafından eşzamanlı çalıştırılması engellenir. Local store claim davranışı tek process içindeki state güvenliğini sağlarken distributed guarantee lease/runtime katmanından gelir.

## Gözlemlenebilirlik

Her execution `scheduleId`, `traceId`, attempt ve sonuç koduyla korele edilebilir. Worker sonucu `claimed`, `batches`, `concurrency` ve task bazlı sonuçları içerir.

## Operasyonel sınırlar

Kullanıcıya sınırsız görev oluşturma imkânı worker'ın sınırsız paralellikte çalışacağı anlamına gelmez. Concurrency yükseltilmeden önce NVIDIA provider limitleri, execution timeoutları, Redis latency'si ve CPU/bellek kullanımı birlikte izlenmelidir.

## Rollback

Worker değişiklikleri bağımsız olarak revert edilebilir. Store schedule kayıtlarının kendisi worker kodunun geri alınmasıyla silinmez; backlog sonraki worker tick'inde mevcut status ve retry politikasına göre yeniden ele alınır.
