# Schedule worker fault-isolation boundary

Bu belge, Hafize'nin bulutta çalışan zamanlanmış görev worker'ında batch hatası, iptal ve belirsiz execution sonucu için güvenlik sözleşmesini tanımlar.

## Amaç

Bir schedule kaydındaki persistence veya runtime hatası, aynı batch içindeki diğer bağımsız schedule'ların sonucunu görünmez hale getirmemelidir. Aynı zamanda görev başladıktan sonra oluşan belirsizlik otomatik retry ile olası bir dış yan etkiyi ikinci kez üretmemelidir.

Bu sınır tool permission politikasını değiştirmez. Scheduled agent yine backend default-deny izin katmanından geçer; dış yazma, gönderme ve merge işlemleri kendi exact kullanıcı onaylarını gerektirir.

## Claim sınırı

`store.claimDue()` task execution başlamadan önce güvenilir bir batch üretmek zorundadır.

Worker şu durumlarda tüm batch'i fail-closed reddeder ve hiçbir agent task çağrısı başlatmaz:

- claim sonucu dizi değilse,
- store istenen batch limitinden fazla kayıt döndürürse,
- aynı `scheduleId` batch içinde birden fazla kez görünürse,
- schedule kimliği, trace kimliği, agent kimliği veya task alanı boş/malformed ise,
- attempt sayaçları tutarsızsa.

Claim persistence hatası da task başlamadan önce doğrudan hata olarak yükselir. Böylece "claim kaydedilemedi ama task yine de çalıştı" durumu oluşturulmaz.

## Executor sonuç sınırı

`executeAgentTask` dönüş değeri persistence kararı değildir. Worker sonucu önce `docs/SCHEDULE_EXECUTION_RESULT_CONTRACT.md` sözleşmesine göre doğrular.

Malformed executor sonucu:

- schedule'ı `completed` yapamaz,
- refundable infra yoluna girip attempt refund alamaz,
- raw payload/detail sızdırmaz,
- `SCHEDULE_EXECUTION_RESULT_INVALID` olarak normal attempt tüketir,
- batch içindeki diğer schedule'ları durdurmaz,
- top-level `invalidResults` sayacına eklenir.

Bu sayaç `uncertain` ile aynı anlamda değildir. Contract ihlalinde worker state transition'dan önce deterministik olarak fail-closed davranmıştır; `uncertain` ise task yan etkisi veya persistence sonucunun artık kesin bilinmediğini gösterir.

Task başladıktan sonra worker signal'ı abort olmuşsa cancellation/side-effect belirsizliği executor-result doğrulamasından daha yüksek önceliklidir. Bu durumda malformed sonuç dahi kör retry gerekçesine çevrilmez; mevcut post-execution uncertainty kuralı korunur.

## Per-schedule fault isolation

Claim doğrulandıktan sonra schedule'lar bounded concurrency lane'lerinde yürütülür.

Bir schedule'ın post-claim state mutation'ı beklenmedik biçimde hata verirse:

- diğer lane'ler iptal edilmez,
- kalan schedule'lar kendi sonuçlarını tamamlayabilir,
- `runDue()` bütün lane'lerin yerleşmesini bekler,
- ilgili sonuç `SCHEDULE_EXECUTION_STATE_UNCERTAIN` ve `outcomeUnknown: true` olarak döner,
- raw exception mesajı batch sonucuna taşınmaz,
- top-level `uncertain` sayacı belirsiz sonuçların sayısını verir.

Bu işaret "task kesin başarısız oldu" anlamına gelmez. Özellikle completion persistence hatasında task yan etkisi gerçekleşmiş fakat state commit edilememiş olabilir.

## İptal fazları

İptal, task'ın başlayıp başlamadığına göre farklı ele alınır.

### Task başlamadan önce

Signal claim'den sonra fakat `executeAgentTask` çağrısından önce abort olmuşsa task çağrılmaz.

Store `defer` destekliyorsa attempt refund edilerek sonraki zamana ertelenir. `defer` yoksa mevcut attempt geri alınamaz; güvenli bir retry hakkı varsa `fail(..., retryAt)` ile yeniden zamanlanır, yoksa kayıt cancelled error ile sonlandırılır.

Bu fazda yan etki başlamadığı bilindiği için sonuç belirsiz sayılmaz.

### Task başladıktan sonra

Task çağrısı başladıktan sonra worker signal'ı abort olmuşsa external veya internal bir yan etkinin gerçekleşip gerçekleşmediği kesin olarak bilinemeyebilir.

Bu nedenle worker:

- attempt'i otomatik refund etmez,
- otomatik retry planlamaz,
- state'i `SCHEDULE_EXECUTION_CANCELLED` ile finalleştirmeye çalışır,
- kullanıcıya/çağırana sonucu `SCHEDULE_EXECUTION_STATE_UNCERTAIN` olarak bildirir.

State finalization'ın kendisi de başarısızsa per-schedule fault isolation yine raw hatayı sızdırmadan belirsiz sonuç üretir.

## Task-declared cancellation

Worker signal'ı abort olmadan executor açıkça `SCHEDULE_EXECUTION_CANCELLED` döndürürse mevcut güvenli defer davranışı korunur. Bu durum worker shutdown sırasında task'ın yarıda kesilmesiyle aynı kabul edilmez.

## Retry ilkesi

`SCHEDULE_LEASE_BUSY` ve `SCHEDULE_LEASE_LOST` gibi bilinen refundable altyapı sonuçları mevcut defer/retry sözleşmesini korur.

Buna karşılık outcome belirsizse otomatik replay tercih edilmez. Bir sonraki katman yeni retry davranışı ekleyecekse olası dış yan etkiler için idempotency/replay kanıtı ayrıca sağlanmalıdır.

## Gizlilik ve gözlemlenebilirlik

Worker sonucu schedule task metnini, secret değerini veya raw persistence/agent exception mesajını yayınlamaz. Gözlemlenebilirlik yalnız güvenli hata kodları, `scheduleId`, bounded sonuç alanları, `uncertain` ve `invalidResults` sayaçları üzerinden sağlanır.

## Değişmezler

- NVIDIA NIM ana model sağlayıcısı olmaya devam eder.
- Agent registry dört profilli seçici mimariyi korur.
- Shared `trace_id` ve task-ledger sözleşmesi değişmez.
- Scheduled task içeriği yetki talimatı sayılmaz.
- Dış write/send/merge işlemleri explicit approval olmadan yürütülmez.
- `.env`, credential ve `.github/workflows/` bu worker değişikliğinin kapsamı dışındadır.
