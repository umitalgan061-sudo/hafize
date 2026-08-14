# Hafize Agent Runtime

Bu katman `agents/registry.json` içindeki sabit dört ajanlı selector/specialist mimarisini NVIDIA NIM sohbet gateway'ine bağlar.

## Runtime sınırı

- Registry backend açılırken doğrulanır; geçersiz schema, duplicate agent id veya `default: deny` dışındaki tool policy ile server başlamaz.
- Aktif roster tam olarak `minimal-engineer` selector, `agency-code-reviewer` specialist, `movie-coordinator` selector ve `handyman-advisor` specialist olmak zorundadır.
- `defaultAgent` yalnız `minimal-engineer` olabilir; beşinci ajan, eksik ajan veya kind drift startup'ta fail-closed reddedilir.
- `GET /api/agents` yalnızca güvenli/public ajan metadatasını döndürür. Tool policy, guardrail ve iç çalışma ayrıntıları frontend'e taşınmaz.
- `POST /api/chat` opsiyonel `agentId` kabul eder. Agent belirtilmezse `defaultAgent` kullanılır.
- Agent kimliği, mission, guardrails ve output contract backend tarafından system mesajına dönüştürülür ve NVIDIA isteğinin başına eklenir.
- İstemci `system` veya `tool` rolü gönderemez; bunlar backend'e ait güven sınırlarıdır.
- Her chat çağrısı için server-side UUID `trace_id` üretilir. Aynı değer NVIDIA system bağlamına ve `X-Hafize-Trace-Id` HTTP header'ına eklenir.
- `authorizeAgentTool()` default-deny, explicit-deny ve approval-required kurallarını tek noktada değerlendirir.

Exact roster sözleşmesi `docs/AGENT_ROSTER_CONTRACT.md` içindedir. Skills prosedürdür ve aktif ajan sayısını artırmaz.

## Tool-calling güvenlik zinciri

NVIDIA'ya bir tool şeması göndermek tek başına güvenlik sağlamaz. Hafize'de gerçek araç çağrısı şu zincirden geçer:

1. Model bir tool çağrısı önerir.
2. Backend tool adını gerçek kayıtlı tool ile eşler.
3. `authorizeAgentTool()` seçili ajanın policy'sini değerlendirir.
4. `approvalRequired` ise kullanıcı onayı olmadan yürütme yapılmaz.
5. Secret değerleri model/ajan bağlamına verilmeden connector backend tarafından çağrılır.
6. Tool sonucu aynı `trace_id` altında izlenir ve modele yalnız gerekli/sanitize edilmiş sonuç döndürülür.

Prompt içindeki metin hiçbir zaman yetki kaynağı olmaz; yetki backend kodu tarafından zorlanır.

## Test kapsamı

`scripts/test-agent-runtime.mjs` ve `scripts/test-agent-roster-contract.mjs` şu davranışları kontrol eder:

- exact dört agent id/kind roster'ı ve varsayılan selector,
- ekstra/eksik/yanlış-kind registry'nin reddedilmesi,
- skill fork hedeflerinin yalnız kayıtlı specialist olması,
- public agent listesinden tool policy'nin çıkarılması,
- client `system` / `tool` rolü enjeksiyonunun reddedilmesi,
- allow / deny / approval-required kararları,
- trace id üretimi,
- oluşturulan system mesajına secret veya bearer credential sızmaması.

`npm run check` discovery runner sayesinde bu `test-*.mjs` regresyonlarını otomatik olarak standart suite'e alır.
