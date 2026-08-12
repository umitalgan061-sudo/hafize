# Bounded Agent Delegation

Bu katman Hafize'nin `agents/registry.json` içindeki hiyerarşik ajan mimarisini gerçek runtime davranışına bağlar.

## Amaç

Ana Hafize ajanı karmaşık bir görevi uygun uzmana devredebilir. Orchestrator da gerekirse görevi başka bir uzman ajana devredebilir. Her alt ajan kendi registry tool policy'siyle çalışır; üst ajan kendi yetkisini alt ajana aktaramaz.

Örnek akış:

```text
Hafize
  -> agent_delegate
  -> Orchestrator
      -> agent_delegate
      -> Code Reviewer
          -> github_read_file
      <- reviewer sonucu
  <- orchestrator sentezi
<- Hafize nihai yanıtı
```

## Model-facing araç

NVIDIA'ya sunulan fonksiyon adı:

```text
agent_delegate
```

Backend permission kimliği:

```text
agent.delegate
```

Yalnızca registry'de `agent.delegate` allow-list'ine sahip ajanlar bu aracı görebilir. Mevcut yapıda ana Hafize ve Orchestrator delegasyon yapabilir; Minimal Engineer ve Code Reviewer yapamaz.

## Güvenlik sınırları

Delegasyon backend tarafından şu kurallarla doğrulanır:

- Registry `maxDelegationDepth` sınırı zorlanır.
- Ajan kendisine delegasyon yapamaz.
- Hedef yalnızca `kind: specialist` olan kayıtlı ajan olabilir; ana Hafize hedef yapılamaz.
- Alt görev boş olamaz ve 12.000 karakterle sınırlandırılır.
- Her alt ajan kendi `default: deny` tool policy'siyle yeniden değerlendirilir.
- `repo.merge`, secret okuma veya dış gönderme gibi izinler delegasyon yoluyla kazanılamaz.
- Her zincir aynı `trace_id` değerini taşır.
- GitHub token/NVIDIA key gibi server secret'ları delegation sonucuna veya model tool argümanına konmaz.
- Alt ajan tarafından okunan harici dosya/tool içeriği talimat değil veri olarak kalır.

## Task ledger

`POST /api/agent/run` yanıtında `delegations` alanı bulunur. Her kayıt yalnızca güvenli çalışma metadata'sı taşır:

```json
{
  "parentAgentId": "hafize-general",
  "agentId": "agency-orchestrator",
  "depth": 1,
  "status": "completed",
  "toolCount": 1
}
```

Prompt, secret, token veya ham harici içerik ledger'a yazılmaz.

## NVIDIA döngüsü

Her ajan çalıştırması en fazla bir tool-call turu yapar. Tool sonuçları modele geri verildikten sonra ikinci completion `tool_choice: none` ile tamamlanır. Bir `agent_delegate` tool çağrısı alt ajanda yeni ve bağımsız tek-tool turu başlatabilir; bu recursive yapı yalnızca registry derinlik sınırına kadar devam eder.

Bu tasarım sonsuz tool döngüsünü ve sınırsız fan-out davranışını engellerken `Hafize -> Orchestrator -> uzman` zincirini gerçek hale getirir.

## Test kapsamı

`npm run check` artık ayrıca şunları doğrular:

- self-delegation reddi,
- ana ajana geri delegasyon reddi,
- maksimum derinlik sınırı,
- `agent.delegate` tool'unun yalnızca yetkili ajanlara sunulması,
- Hafize -> Orchestrator -> Code Reviewer zincirinin mock NVIDIA completion ile çalışması,
- Code Reviewer'ın kendi `repo.read` yetkisiyle GitHub read tool kullanabilmesi,
- ledger'ın iki delegasyon adımını aynı zincirde kaydetmesi,
- `repo.merge` veya secret değerlerinin tool listesine/sonuca sızmaması.
