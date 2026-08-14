# Agent Delegation Runtime

`/api/agent/run` registry tarafından seçilen selector ajanın yalnız izin verilen specialist ajanlara dar kapsamlı görevler devretmesini destekler.

## Aktif roster sınırı

Runtime tam olarak dört ajan kabul eder:

- `minimal-engineer` — varsayılan selector; kod ve ürün geliştirme işlerini yönlendirir.
- `agency-code-reviewer` — salt-okunur kod inceleme specialist'i.
- `movie-coordinator` — film/dizi odaklı selector.
- `handyman-advisor` — bakım/onarım odaklı specialist.

Selector ajanlar doğrudan kullanıcı isteği için seçilebilir. Delegasyon hedefi ise yalnız `kind: specialist` ajan olabilir; selector→selector delegasyonu geçerli değildir. Registry'ye beşinci ajan eklemek, zorunlu bir ajanı kaldırmak, türünü değiştirmek veya default selector'ı değiştirmek server başlangıcında fail-closed hata üretir.

## Tool sözleşmesi

NVIDIA'ya görünen function adı `agent_delegate` olur ve iki temel alan alır:

- `agentId`: `agents/registry.json` içindeki hedef specialist kimliği.
- `task`: uzmana verilen dar kapsamlı görev metni.

İsteğe bağlı `successCriteria`, `constraints` ve `evidenceRequired` alanları handoff kalitesini artırır; yeni bir tool izni veya yetki vermez.

Backend bu function'ı registry'deki `agent.delegate` permission'ına bağlar. Modelin tool adını üretmesi tek başına yetki vermez.

## Backend sınırları

Delegasyon yürütmesi şu kontrolleri model çağrısından önce uygular:

- Kaynak selector `agent.delegate` için allowlist edilmiş olmalıdır.
- Hedef ajan registry'de bulunmalı ve `kind: specialist` olmalıdır.
- Ajan kendisine delegasyon yapamaz.
- `policy.maxDelegationDepth` aşılırsa çağrı reddedilir.
- `policy.maxParallelAgents` aynı parent run içindeki delegation fan-out üst sınırı olarak uygulanır.
- Geçersiz/çok uzun görev veya handoff alanları NVIDIA'ya gönderilmez.

## Trace ve task ledger

Parent run ile specialist çağrısı aynı `trace_id` değerini kullanır. Ledger'da uzman için `agent.delegate` child task açılır; görev metni, model çıktısı, tool argümanları veya secret değerleri ledger'a yazılmaz. Başarı `completed`, hata sanitize edilmiş error code ile `failed` olarak kapanır.

## Yetki izolasyonu

Specialist çağrısı parent selector'ın tool izinlerini miras almaz. Hedef ajanın kendi `toolPolicy` sözleşmesi backend tarafından bağımsız uygulanır; Code Reviewer repo yazamaz, Handyman Advisor repo araçlarını kullanamaz.

Harici yazma, gönderme ve merge gibi yan etkiler yalnız ilgili ajan policy'sinde tanımlıysa ve ayrıca backend onayı varsa yürütülebilir. Prompt veya handoff metni hiçbir zaman authorization kaynağı değildir.
