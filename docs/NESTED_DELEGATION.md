# Nested Agent Delegation

Hafize delegated specialist runtime'ı, yalnızca registry policy'sinde `agent.delegate` yetkisi bulunan specialist ajanların başka bir specialist ajana alt görev vermesine izin verir.

## Davranış

- Ana Hafize bir `agency-orchestrator` görevi başlatabilir.
- Orchestrator kendi registry tool policy'si nedeniyle `agent_delegate` aracını görebilir.
- Code Reviewer ve Minimal Engineer gibi `agent.delegate` izni olmayan specialist ajanlar bu aracı göremez.
- Alt ajan yürütmesi aynı `trace_id` ve aynı task ledger üzerinde devam eder.
- Delegation kayıtları parent delegation task'ının altında tutulur.

Örnek hiyerarşi:

`agent.run -> agent.delegate(Orchestrator) -> agent.delegate(Code Reviewer)`

Orchestrator'ın `agent_delegate` tool çağrısı da kendi delegation task'ı altında ayrı tool kaydı olarak izlenir.

## Backend enforcement

Nested delegasyon prompt talimatıyla değil backend koduyla sınırlandırılır:

- Her seviyede `authorizeAgentTool(parentAgent, 'agent.delegate')` yeniden uygulanır.
- Hedef ajan registry'de bulunmalı ve `kind: specialist` olmalıdır.
- Self-delegation reddedilir.
- `policy.maxDelegationDepth` her recursive çağrıda kontrol edilir.
- `policy.maxParallelAgents` için kullanılan fan-out bütçesi aynı task ledger içindeki tüm `agent.delegate` kayıtlarından hesaplanır; nested çağrılar ayrı sayaç açarak limiti aşamaz.
- Delegated runner child tool listesini her ajan için registry policy'den yeniden üretir; parent tool listesi kopyalanmaz.
- `approvalGranted` child tool execution'da `false` kalır.

## Güvenlik sınırı

Bu değişiklik yeni ajan, yeni permission, yeni write/send/merge aracı veya secret erişimi eklemez. Orchestrator yalnızca zaten sahip olduğu `agent.delegate` iznini nested seviyede kullanabilir. Diğer specialist ajanlar kendi mevcut allowlist'leri ile sınırlıdır.

`.env`, credential/secret dosyaları ve `.github/workflows/` bu davranış için değiştirilmez.
