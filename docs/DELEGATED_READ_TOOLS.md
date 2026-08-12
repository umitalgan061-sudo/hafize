# Delegated Specialist Read Tools

Bu katman, `agent_delegate` ile çağrılan uzman ajanın parent ajanın tool setini miras almadan yalnızca **kendi registry tool policy** kurallarından geçen araçları kullanmasını sağlar.

## Açık davranış

- `agency-code-reviewer` ve `agency-minimal-engineer`, kendi `repo.read` izinleri nedeniyle GitHub read bağlantısı yapılandırılmışsa `github_read_file` aracını görebilir.
- Parent Hafize'nin `runtime.status` veya diğer araçları child'a kopyalanmaz; child tool listesi kendi policy'sinden yeniden hesaplanır.
- `agency-orchestrator`, kendi `agent.delegate` izni nedeniyle başka bir specialist ajana nested delegation yapabilir.
- Nested specialist yeniden yalnızca kendi policy'sindeki araçları görür. Örneğin `Orchestrator -> Code Reviewer -> github_read_file` zinciri mümkündür.
- Yeni ajan, yeni permission veya yeni dış yazma aracı eklenmez.

## Güvenlik sınırı

Child tool listesi `getAllowedNvidiaTools(childAgent, childContext)` ile yeniden backend tarafında hesaplanır. Parent'ın NVIDIA `tools` dizisi hiçbir aşamada child çağrısına taşınmaz.

Nested delegation her seviyede yeni `createAgentDelegator()` örneğiyle oluşturulur. Bu nedenle kaynak ajan yeniden `agent.delegate` kontrolünden geçer, hedef yeniden `kind: specialist` olarak doğrulanır ve registry'deki `maxDelegationDepth` ile `maxParallelAgents` sınırları uygulanır. Self-delegation ve ana Hafize'ye geri delegasyon reddedilir.

Child tool çağrısı yürütülürken `executeNvidiaToolCall(childAgent, ...)` yeniden default-deny authorization uygular. GitHub token tool argümanına, system prompt'a, ledger'a veya model-visible metadata'ya eklenmez.

Dış yazma, gönderme ve merge işlemleri bu runner'a bağlanmamıştır. `approvalGranted` child execution context'inde sabit olarak `false` kalır.

## Trace ve ledger

Bütün nested zincir ana run ile aynı `trace_id` değerini kullanır. Örnek ledger hiyerarşisi:

`agent.run -> agent.delegate(Orchestrator) -> tool:agent_delegate -> agent.delegate(Code Reviewer) -> tool:github_read_file`

Ledger yalnızca ajan/tool adı, parent task ilişkisi, durum ve sanitize edilmiş hata kodu taşır; görev promptu, dosya içeriği veya secret taşımaz.

## Test

`scripts/test-delegated-agent-runner.mjs` şunları doğrular:

- reviewer'a yalnızca `github_read_file` sunulması,
- parent araçlarının child'a kopyalanmaması,
- GitHub bağlantısı yoksa read tool sunulmaması,
- Orchestrator'a yalnızca kendi `agent.delegate` aracının sunulması,
- `Orchestrator -> Code Reviewer -> github_read_file` nested zincirinin dört mock NVIDIA turunda tamamlanması,
- nested delegation ve child tool kayıtlarının doğru parent task altında tutulması,
- görev metni ve GitHub dosya içeriğinin ledger'a sızmaması.
