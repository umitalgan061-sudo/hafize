# Hafize Agent Runtime

Bu katman `agents/registry.json` içindeki seçici ajan mimarisini NVIDIA NIM sohbet gateway'ine bağlar.

## Bu turda eklenen sınır

- Registry backend açılırken doğrulanır; geçersiz schema, duplicate agent id veya `default: deny` dışındaki tool policy ile server başlamaz.
- `GET /api/agents` yalnızca güvenli/public ajan metadatasını döndürür. Tool policy, guardrail ve iç çalışma ayrıntıları frontend'e taşınmaz.
- `POST /api/chat` opsiyonel `agentId` kabul eder. Agent belirtilmezse `defaultAgent` kullanılır.
- Agent kimliği, mission, guardrails ve output contract backend tarafından system mesajına dönüştürülür ve NVIDIA isteğinin başına eklenir.
- İstemci artık `system` veya `tool` rolü gönderemez; bunlar backend'e ait güven sınırlarıdır.
- Her chat çağrısı için server-side UUID `trace_id` üretilir. Aynı değer NVIDIA system bağlamına ve `X-Hafize-Trace-Id` HTTP header'ına eklenir.
- `authorizeAgentTool()` default-deny, explicit-deny ve approval-required kurallarını tek noktada değerlendirir. Bu turda gerçek dış araç çağrısı henüz etkinleştirilmemiştir.

## Neden tool calling henüz açılmadı?

NVIDIA'ya bir tool şeması göndermek tek başına güvenlik sağlamaz. Hafize'de gerçek araç çağrısı ancak şu zincir hazır olduğunda açılacak:

1. Model bir tool çağrısı önerir.
2. Backend tool adını gerçek kayıtlı tool ile eşler.
3. `authorizeAgentTool()` seçili ajanın policy'sini değerlendirir.
4. `approvalRequired` ise kullanıcı onayı olmadan yürütme yapılmaz.
5. Secret değerleri model/ajan bağlamına verilmeden connector backend tarafından çağrılır.
6. Tool sonucu aynı `trace_id` altında loglanır ve modele yalnızca gerekli sonuç döndürülür.

Bu ayrım sayesinde prompt içindeki metin hiçbir zaman yetki kaynağı olmaz; yetki backend kodu tarafından zorlanır.

## Test kapsamı

`scripts/test-agent-runtime.mjs` şu davranışları kontrol eder:

- registry yükleme ve default-agent çözümleme,
- public agent listesinden tool policy'nin çıkarılması,
- client `system` / `tool` rolü enjeksiyonunun reddedilmesi,
- allow / deny / approval-required kararları,
- trace id üretimi,
- oluşturulan system mesajına secret veya bearer credential sızmaması.

`npm run check` bu testleri mevcut syntax ve registry kontrolleriyle birlikte çalıştırır.
Geçit `scripts/test-*.mjs` dosyalarını keşifle bulur; ayrıntı için bkz.
[`docs/VERIFICATION_GATE.md`](./VERIFICATION_GATE.md).
