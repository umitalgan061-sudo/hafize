# Task ledger bütünlük sınırı

Hafize'nin agent/tool gözlemlenebilirlik kaydı aynı `trace_id` altında hangi işin ne zaman başladığını ve hangi terminal sonuçla kapandığını açıklayabilmelidir. Bu kayıt yalnız debug metni değildir; cancellation, delegasyon, tool policy ve güvenlik incelemelerinde denetim izi olarak kullanılır.

## Terminal kayıtlar immutable'dır

`completed`, `failed` ve `blocked` durumları terminaldir. Bir task bu durumlardan birine ulaştıktan sonra başka bir duruma veya farklı bir detail değerine geçirilemez. Aynı terminal status + detail ile gelen tekrar çağrı idempotent kabul edilir ve mevcut kayıt döndürülür.

Bu kural özellikle geç tool/delegation callback'lerinin daha önce timeout/cancellation ile kapatılmış sonucu yeniden yazmasını engeller.

## Geçerli durum geçişleri

- `planned` → `planned | running | completed | failed | blocked`
- `running` → `running | completed | failed | blocked`
- `completed` → yalnız `completed`
- `failed` → yalnız `failed`
- `blocked` → yalnız `blocked`

No-op update yeni `updatedAt` üretmez. Böylece aynı olayın retry edilmesi sahte bir yeni zaman damgası oluşturmaz.

## Parent bütünlüğü

Yeni bir child task yalnız ledger içinde daha önce oluşturulmuş gerçek bir `parentTaskId` değerine bağlanabilir. Generic task ledger geçmişte var olan terminal parent'ları veri modeli açısından okuyabilir; fakat `createAgentRunLedger` yeni tool/delegation başlatırken parent'ın hâlâ `running` olmasını zorunlu kılar.

Bu nedenle kapanmış bir delegation veya tool altında yeni yan etki kaydı başlatılamaz.

## Agent-run tip sahipliği

`createAgentRunLedger` tool ve delegation task kimliklerini ayrı sahiplik setlerinde tutar.

- `recordToolFinish` yalnız `recordToolStart` ile açılmış task'ı kapatabilir.
- `recordDelegationFinish` yalnız `recordDelegationStart` ile açılmış task'ı kapatabilir.
- Bu API'ler root task'ı veya farklı türde child task'ı mutate edemez.

Normal finish sonrasında task kimliği sealed kabul edilir; contradictory late callback mevcut terminal kaydı değiştiremez.

## Root finalization

Root agent run, açık child task varken başarı/başarısızlık olarak kapatılamaz. Normal bitişten önce tüm child task'lar terminal olmalıdır. Cancellation/timeout yolunda `failOpenEntries()` açık child kayıtlarını aynı bounded detail ile `failed` yapar; ardından root kapatılabilir.

Root bir kez terminal olduktan sonra yeni tool/delegation başlatılamaz ve sonraki `finish()` çağrıları mevcut sonucu idempotent biçimde döndürür.

## Değişmeyen güvenlik sözleşmeleri

Bu katman tool yetkisi vermez, approval üretmez ve secret okumaz. Agent registry/router, provider seçimi ve backend default-deny permission enforcement ayrı güvenlik sınırları olarak kalır. Ledger'ın görevi yalnız gerçekleşen yürütme akışının sonradan çelişkili biçimde yeniden yazılamamasını sağlamaktır.
