# Skills manifest ve registry sözleşmesi

Bu katman `docs/CLAUDE_RESEARCH_INTEGRATION.md` uygulama sırasındaki 2. maddeyi karşılar: **strict skills manifest + registry + inline/fork execution contract.** İlk sürüm yalnız sözleşme ve doğrulama katmanıdır; **skill'leri diskten yüklemez, production tool catalog'a kayıt eklemez ve kendi başına model veya ağ çağrısı yapmaz.**

## Manifest alanları

`normalizeSkillManifest(input, { source, grantedTools, projectScopeAllowed })` yalnız şu alanları kabul eder; bilinmeyen her alan `INVALID_SKILL_FIELD` ile reddedilir:

| Alan | Zorunlu | Sözleşme |
| --- | --- | --- |
| `name` | evet | `^[a-z][a-z0-9-]{1,63}$` |
| `description` | evet | en fazla 300 karakter |
| `prompt` | evet | en fazla 20.000 karakter, secret taramasından geçer |
| `triggers` | hayır | en fazla 12, küçük harfe normalize edilir, tekrar reddedilir |
| `allowedTools` | hayır | en fazla 16 permission, `grantedTools` alt kümesi |
| `arguments` | hayır | en fazla 8; yalnız `name`, `description`, `required` |
| `model` | hayır | dar karakter kümesi, en fazla 80 karakter |
| `executionContext` | hayır | `inline` (varsayılan) veya `fork` |
| `forkAgentId` | fork ise evet | yalnız `fork` bağlamında verilebilir |

## Güvenlik sınırları

- **Yetki yükseltme yok.** `allowedTools` yalnız çağıran agent'ın `toolPolicy.allow` listesinin alt kümesi olabilir; aksi hâlde `SKILL_TOOL_ESCALATION`. Çalışma anında yetki, skill bildirimi ile agent policy'sinin kesişimidir (`authorizeSkillTool`), bu yüzden agent yetkiyi geri çekerse skill bildirimi tek başına yetmez.
- **Onay gerektiren araçlar skill üzerinden açılmaz.** `external.write` / `external.send` / `repo.merge` gibi izinler `authorizeAgentTool` üzerinden gene açık `approvalGranted` ister.
- **Prompt secret alamaz.** Private key blokları, `sk-`, `gh*_`, `nvapi-`, `AKIA` önekleri ve `api_key/secret/token/password/client_secret` atamaları `SKILL_PROMPT_SECRET_DETECTED` ile reddedilir.
- **Project kapsamı opt-in'dir.** `project` kaynaklı skill yalnız açık `projectScopeAllowed: true` ile yüklenir; aksi hâlde `SKILL_PROJECT_SOURCE_NOT_ALLOWED`.
- **Manifest kendi kaynağını veya onayını beyan edemez.** `source` ve `approvalGranted` model/dosya girdisinde kabul edilmez; backend option olarak verilir.

## Kaynak önceliği

`buildSkillRegistry({ builtin, user, project }, { agent, agentIds, projectScopeAllowed })` kaynakları `builtin` > `user` > `project` sırasıyla birleştirir. Daha düşük öncelikli bir kaynak aynı adı taşıyan skill'i **gölgeleyemez**; kayıt `shadowed` listesine düşer ve gözlemlenebilir kalır. Böylece bir proje dosyası builtin bir skill'in davranışını sessizce değiştiremez.

`fork` bağlamındaki skill'in `forkAgentId` değeri agent registry'de gerçekten bulunmalıdır (`UNKNOWN_SKILL_FORK_AGENT`).

## inline / fork ayrımı

- `inline`: skill prompt'u mevcut ajanın turunda çalışır, ayrı ajan kimliği almaz.
- `fork`: skill mevcut delegation altyapısı üzerinden adı verilen uzman ajana devredilir; child ajan kendi policy'siyle sınırlıdır ve parent yetkilerini otomatik miras almaz.

## Production'a açılma koşulu

Skill'lerin gerçekten yürütülmesi için ayrıca disk/HTTP yükleyici, `skill.invoke` permission gate'i, delegation depth/fan-out muhasebesi ve trace kaydı tamamlanmalıdır. Bu tur yalnız doğrulama sözleşmesini sabitler.

Test: `node scripts/test-skill-manifest.mjs` ve `node scripts/test-skill-registry.mjs`; ikisi de `npm run check` kapısına bağlıdır.
