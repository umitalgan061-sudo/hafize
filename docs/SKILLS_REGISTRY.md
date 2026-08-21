# Hafize skills manifest ve registry sözleşmesi

`docs/CLAUDE_RESEARCH_INTEGRATION.md` uygulama sırasındaki 2. maddeyi karşılar: **strict skills manifest + registry + inline/fork execution contract.** Katman saf sözleşmedir — ağ çağrısı yapmaz, dosya sistemi okumaz, production tool catalog'a yeni bir model aracı eklemez. Amacı, bir skill yüklenmeden önce güvenlik sınırını sabitlemektir.

## Manifest — `lib/skill-manifest.mjs`

`normalizeSkillManifest(input)` yalnız şu alanları kabul eder; bilinmeyen her alan `INVALID_SKILL_MANIFEST:field` ile reddedilir. Sonuç ve iç dizileri donmuş (`Object.freeze`) döner.

| Alan | Kural |
| --- | --- |
| `id` | zorunlu, `^[a-z][a-z0-9-]{0,46}[a-z0-9]$` (2–48 karakter) |
| `name` / `description` | zorunlu; ≤80 / ≤400 karakter |
| `triggers` | ≤12 benzersiz ifade (≤120 karakter), küçük harfe normalize edilir |
| `execution` | zorunlu, yalnız `inline` veya `fork` |
| `allowedTools` | zorunlu dizi, ≤12 benzersiz permission |
| `arguments` | ≤8 kayıt; yalnız `name` / `description` / `required` |
| `model` | yalnız `default` (varsayılan) / `fast` / `reasoning` tercihi — ham model kimliği, sağlayıcı veya endpoint seçilemez |
| `prompt` | zorunlu, ≤8000 karakter, **statik** metin |

### Güvenlik değişmezleri

- **Skill kendi yetkisini yükseltemez.** `secret.read`, `repo.delete` ve `agent.delegate` manifest içinde geçemez (`SKILL_PERMISSION_FORBIDDEN`). Delegasyon bir ajan kararıdır; skill üzerinden yeni delegasyon yetkisi doğmaz.
- **Onay gerektiren izinler manifest'e yazılamaz.** `external.write`, `external.send`, `repo.merge`, `repo.write_branch` → `SKILL_PERMISSION_REQUIRES_APPROVAL`. Bu izinler yalnız çalışma anında, kullanıcı onayıyla ve ajan policy'si üzerinden verilir.
- **Skill prompt'u secret alamaz.** Prompt statik metindir; `${…}`, `{{…}}`, `<% … %>` ve `process.env` referansları `SKILL_PROMPT_INTERPOLATION_FORBIDDEN` ile reddedilir, böylece skill metninin ortam değişkeni veya credential çekebileceği bir yüzeyi olmaz.

`authorizeSkillTools(skill, agent, { approvalGranted })` her istenen izni mevcut `authorizeAgentTool()` kararından geçirir. Tek bir izin bile reddedilirse skill hiç çalıştırılmaz (`SKILL_TOOL_NOT_AUTHORIZED:<izin>`); izinler sessizce kırpılmaz.

## Registry — `lib/skill-registry.mjs`

`createSkillRegistry(sources, { allowedProjectScopes })` kaynakları `{ source, scope?, manifests }` biçiminde alır.

- **Kaynak önceliği `builtin` > `user` > `project`.** Aynı `id` birden fazla kaynakta varsa yüksek öncelikli kaynak kazanır; kullanıcı veya proje skill'i builtin bir skill'i gölgeleyemez. Gölgelenen kayıt `registry.shadowed` içinde görünür kalır — sessiz düşürme yoktur.
- **Proje skill'leri yalnız açıkça izin verilen kapsamdan yüklenir.** `project` kaynağı `scope` zorunlu tutar; liste dışıysa `SKILL_PROJECT_SCOPE_NOT_ALLOWED:<scope>`. `builtin` / `user` kaynakları `scope` taşıyamaz.
- Aynı kaynakta tekrarlanan `id` → `SKILL_REGISTRY_DUPLICATE`; 64 skill sınırı → `SKILL_REGISTRY_LIMIT_EXCEEDED`.
- `listPublicSkills(registry)` istemciye yalnız `id`, `name`, `description`, `triggers`, `execution`, `source` verir; **prompt istemciye sızmaz.**
- `resolveSkillInvocation(registry, id, { agent, approvalGranted })` skill'i bulur, izinleri ajan policy'sinden geçirir ve donmuş `{ id, source, execution, model, tools, prompt, arguments }` döner.

## inline / fork ayrımı

`inline` skill prompt'u mevcut ajanın turunda ek talimat olarak kullanılır; yeni bağlam açılmaz. `fork` ayrı bir alt bağlamda yürütülür. Ayrım manifest'te sabittir ve her iki modda da izinler ajan policy'sinden geçtiği için fork bir yetki yükseltme yolu değildir. Yürütme motoru bu turda **açılmadı**; önce sözleşme ve doğrulama sabitlendi.

## Test

`scripts/test-skill-manifest.mjs` (alan doğrulaması, yasak/onaylı izinler, prompt interpolation reddi, ajan yetkilendirmesi) ve `scripts/test-skill-registry.mjs` (kaynak önceliği, gölgeleme kaydı, proje scope sınırı, duplicate/limit, invocation çözümü, prompt sızmaması) `npm run check` zincirine bağlıdır.
