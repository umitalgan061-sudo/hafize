# Delegated Specialist Read Tools

Bu katman, `agent_delegate` ile çağrılan uzman ajanın parent ajanın tool setini miras almadan yalnızca **kendi registry tool policy** kurallarından geçen mevcut salt-okunur araçları kullanmasını sağlar.

## Bu turda açılan davranış

- `agency-code-reviewer` ve `agency-minimal-engineer`, kendi `repo.read` izinleri nedeniyle GitHub read bağlantısı yapılandırılmışsa `github_read_file` aracını görebilir.
- Parent Hafize'nin `runtime.status` veya `agent.delegate` araçları child'a kopyalanmaz.
- Delegated `agency-orchestrator` bu turda nested delegation yapamaz; `delegateAgent` execution context child runner'a verilmez.
- Yeni ajan, yeni permission veya yeni dış yazma aracı eklenmez.

## Güvenlik sınırı

Child tool listesi `getAllowedNvidiaTools(childAgent, childContext)` ile yeniden backend tarafında hesaplanır. Parent'ın NVIDIA `tools` dizisi hiçbir aşamada child çağrısına taşınmaz.

Child tool çağrısı yürütülürken `executeNvidiaToolCall(childAgent, ...)` yeniden default-deny authorization uygular. GitHub token tool argümanına, system prompt'a, ledger'a veya model-visible metadata'ya eklenmez.

Dış yazma, gönderme ve merge işlemleri bu runner'a bağlanmamıştır. `approvalGranted` child execution context'inde sabit olarak `false` kalır.

## Trace ve ledger

Delegated specialist ana run ile aynı `trace_id` değerini kullanır. Child'ın tool çağrısı delegation task'ın altında ayrıca kaydedilir:

`agent.run -> agent.delegate -> tool:github_read_file`

Ledger yalnızca ajan/tool adı, durum ve sanitize edilmiş hata kodu taşır; dosya içeriği veya secret taşımaz.

## Test

`scripts/test-delegated-agent-runner.mjs` şunları doğrular:

- reviewer'a yalnızca `github_read_file` sunulması,
- parent `runtime_status` ve `agent_delegate` araçlarının child'a sızmaması,
- GitHub bağlantısı yoksa child'a tool sunulmaması,
- tool sonucunun ikinci NVIDIA turuna `role: tool` olarak eklenmesi,
- child tool ledger kaydının delegation task altında ve child agent kimliğiyle tutulması.
