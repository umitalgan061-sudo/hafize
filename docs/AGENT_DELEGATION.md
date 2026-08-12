# Agent Delegation Runtime

`/api/agent/run` ana Hafize ajanının registry tarafından izin verilen uzman ajanlara dar kapsamlı görevler devretmesini destekler.

## Tool sözleşmesi

NVIDIA'ya görünen function adı `agent_delegate` olur ve iki alan alır:

- `agentId`: `agents/registry.json` içindeki hedef uzman kimliği.
- `task`: uzmana verilen dar kapsamlı görev metni.

Backend bu function'ı registry'deki `agent.delegate` permission'ına bağlar. Modelin tool adını üretmesi tek başına yetki vermez.

## Backend sınırları

Delegasyon yürütmesi şu kontrolleri model çağrısından önce uygular:

- Kaynak ajan `agent.delegate` için allowlist edilmiş olmalıdır.
- Hedef ajan registry'de bulunmalı ve `kind: specialist` olmalıdır.
- Ajan kendisine delegasyon yapamaz.
- `policy.maxDelegationDepth` aşılırsa çağrı reddedilir.
- `policy.maxParallelAgents` aynı parent run içindeki delegation fan-out üst sınırı olarak uygulanır.
- Geçersiz/çok uzun görev metni NVIDIA'ya gönderilmez.

## Trace ve task ledger

Ana run ile bütün uzman çağrıları aynı `trace_id` değerini kullanır. Ledger'da her uzman için ayrı `agent.delegate` child task açılır; görev metni, model çıktısı, tool argümanları veya secret değerleri ledger'a yazılmaz. Başarı `completed`, hata sanitize edilmiş error code ile `failed` olarak kapanır.

Nested zincirde parent-child ilişkisi korunur. Örneğin:

`agent.run -> agent.delegate(Orchestrator) -> tool:agent_delegate -> agent.delegate(Code Reviewer) -> tool:github_read_file`

## Yetki izolasyonu

Her delegated ajan için tool listesi parent'tan kopyalanmaz. Backend child agent'ın kendi registry policy'sini kullanarak tool setini sıfırdan hesaplar.

Bu nedenle:

- Orchestrator kendi `agent.delegate` yetkisiyle başka bir specialist ajana görev verebilir.
- Code Reviewer kendi `repo.read` yetkisiyle `github_read_file` kullanabilir.
- Code Reviewer veya Minimal Engineer `agent.delegate` yetkisine sahip değilse nested delegation aracı onlara sunulmaz.
- Parent Hafize'nin `runtime.status`, GitHub veya başka araç yetkileri child'a miras kalmaz.
- `approvalGranted` delegated execution context'inde `false` kalır; write/send/merge yetkileri delegasyonla açılamaz.

Nested delegation aynı runner'ı recursive biçimde kullanır ancak her seviyede registry depth/fan-out ve default-deny policy yeniden uygulanır. Böylece `Hafize -> Orchestrator -> uzman` zinciri çalışırken izin yükseltme oluşmaz.
