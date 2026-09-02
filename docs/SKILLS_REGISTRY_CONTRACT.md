# Skills manifest ve registry sözleşmesi

`docs/CLAUDE_RESEARCH_INTEGRATION.md` uygulama sırasının 2. maddesi. Katman iki dosyadan oluşur:

- `lib/skill-manifest.mjs` — tek bir skill manifestinin strict doğrulaması.
- `lib/skill-registry.mjs` — kaynak önceliği, çözümleme, argüman doğrulaması ve çağrı mesajı üretimi.

## Manifest alanları

`name` (`^[a-z][a-z0-9-]{1,63}$`), `description`, `prompt` zorunludur; `triggers`, `allowedTools`, `arguments`, `model`, `execution`, `agentId` isteğe bağlıdır. Tanımsız her alan `INVALID_SKILL_MANIFEST_FIELD` ile reddedilir.

`source` ve `projectScope` manifest içinde **taşınamaz**; yalnızca yükleyici tarafından `normalizeSkillManifest(input, { source, scope })` ile verilir. Böylece bir proje dosyası kendini `builtin` ilan edemez.

## Güvenlik sınırları

- Skill kendi tool yetkisini yükseltemez: `secret.read` ve `repo.delete` her zaman reddedilir (`SKILL_TOOL_FORBIDDEN`); `external.write`, `external.send`, `repo.merge`, `repo.write_branch` manifestten önceden verilemez (`SKILL_TOOL_APPROVAL_ONLY`) — bunlar yalnız çalışma anında kullanıcı onayıyla gelir.
- Skill prompt'u veya açıklaması secret/credential taşıyamaz; özel anahtar, `sk-`, `ghp_`, `github_pat_`, `AKIA…`, `nvapi-` ve `api_key=` benzeri kalıplar `SKILL_PROMPT_SECRET_DETECTED` / `SKILL_DESCRIPTION_SECRET_DETECTED` ile reddedilir.
- Skill içeriği `buildSkillInvocationMessage()` ile **user** rolünde taşınır; system yetkisi kazanmaz ve mesaj bunu açıkça belirtir.
- Efektif araç kümesi = manifest `allowedTools` ∩ ajanın `authorizeAgentTool` kararı. Manifest bir kısıtlamadır, yetki kaynağı değildir. Kesişim boşsa `SKILL_TOOLS_NOT_AUTHORIZED`.

## Kaynak önceliği

`builtin > user > project`. Registry kaynakları bu sırayla işler; daha düşük öncelikli bir kaynak, alınmış bir adı gölgeleyemez (`SKILL_NAME_SHADOWED`). Aynı kaynakta tekrar eden ad `SKILL_NAME_DUPLICATE` alır. Bu yön bilinçlidir: repo içeriğinden gelen project skill'i, güvenilen builtin bir adı ele geçiremez.

Project skill'leri yalnız `allowedProjectScopes` içinde açıkça izin verilen kapsamdan yüklenir; kapsam dışı kaynak hiç okunmaz (`SKILL_PROJECT_SCOPE_NOT_ALLOWED`).

Geçersiz tek bir manifest registry'yi düşürmez: reddedilenler `registry.rejected` içinde `{ source, name, reason }` olarak görünür.

## inline / fork yürütme

- `inline` (varsayılan): skill mevcut ajan turunda çalışır, `agentId` taşıyamaz (`SKILL_INLINE_AGENT_NOT_ALLOWED`).
- `fork`: skill bir uzman ajana delege edilir; `agentId` zorunludur (`SKILL_FORK_AGENT_REQUIRED`) ve çağıran ajanın `agent.delegate` yetkisi yoksa çözümleme `SKILL_FORK_NOT_AUTHORIZED` ile durur.

`listSkillsForAgent()` yalnız o ajanın gerçekten çalıştırabileceği skill'leri, prompt içermeden döner; model yalnızca kullanılabilir olanı görür.

## Argümanlar

`normalizeSkillArguments()` yalnız manifestte tanımlı adları kabul eder (`UNKNOWN_SKILL_ARGUMENT`), zorunlu alan eksikse `MISSING_SKILL_ARGUMENT`, değer string değilse / 4000 karakteri aşıyorsa / NUL içeriyorsa `INVALID_SKILL_ARGUMENT_VALUE` döner.

## Test

`node scripts/test-skill-manifest.mjs` ve `node scripts/test-skill-registry.mjs`; ikisi de `npm run check` zincirindedir.
