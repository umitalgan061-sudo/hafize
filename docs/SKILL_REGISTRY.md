# Hafize skill manifest ve registry sözleşmesi

`docs/CLAUDE_RESEARCH_INTEGRATION.md` uygulama sırasındaki 2. madde. Katman `lib/skill-registry.mjs` içinde, testleri `scripts/test-skill-registry.mjs` içindedir. Bu tur yalnız sözleşme + registry katmanını ekler; HTTP yüzeyi ve model çağrısı wiring'i ayrı turda yapılır.

## Manifest alanları

| Alan | Zorunlu | Kural |
| --- | --- | --- |
| `id` | evet | `^[a-z][a-z0-9-]{1,63}$` |
| `name` / `description` | evet | metin, 80 / 500 karakter sınırı |
| `execution` | evet | yalnız `inline` veya `fork` |
| `prompt` | evet | ≤ 20.000 karakter, secret benzeri içerik reddedilir |
| `triggers` | hayır | ≤ 12, küçük harfe indirilir, tekrar yasak |
| `allowedTools` | hayır | ≤ 12 izin adı; `secret.read`/`repo.delete` yasak, onay gerektiren yetkiler yasak |
| `arguments` | hayır | ≤ 8 adet `{ name, type: string\|number\|boolean, required?, description? }` |
| `model` | hayır | sağlayıcı model kimliği deseni |
| `projectScope` | project | yalnız `project` kaynağında; `..` içeremez |

Bilinmeyen üst düzey alan, bilinmeyen argüman alanı veya manifest'teki `source` ile yükleme kaynağının uyuşmaması `INVALID_SKILL_*` ile reddedilir. Doğrulanan manifest donmuş (`Object.freeze`) olarak döner.

## Kaynak önceliği: builtin > user > project

`buildSkillRegistry({ builtin, user, project, allowedProjectScopes })` üç listeyi bu sırayla birleştirir. Aynı `id` daha yüksek öncelikli bir kaynakta varsa düşük öncelikli manifest **gölgelenir** ve `registry.shadowed` içinde raporlanır.

Sıra bilinçli olarak Claude'un proje-öncelikli davranışının tersidir: Hafize'de bir depo içinden gelen manifest yerleşik bir skill adını ele geçirememelidir. Aynı kaynak listesinde tekrarlanan `id` hata (`SKILL_DUPLICATE_ID`) üretir.

`project` kaynağındaki her skill, çağıranın açıkça verdiği `allowedProjectScopes` listesinde bulunan bir `projectScope` taşımak zorundadır; aksi hâlde `SKILL_PROJECT_SCOPE_NOT_ALLOWED`.

## Yetki yükseltme yasağı

`resolveSkillForAgent(registry, skillId, agent)` skill'in `allowedTools` listesindeki her izni ajanın kendi tool policy'sinde doğrular ve **onay bayrağı geçmez**. Skill yalnız ajanın zaten sahip olduğu yetkiyi daraltabilir; ajanın sahip olmadığı bir izni isterse `SKILL_TOOL_ESCALATION` döner. Örnek: `repo.read` isteyen bir skill `agency-code-reviewer` ile çalışır, `hafize-general` ile çalışmaz.

Onay gerektiren yetkiler (`external.write`, `external.send`, `repo.merge`, `repo.write_branch`) manifest düzeyinde zaten reddedilir; dış yazma işlemleri kullanıcı onayıyla mevcut araç sınırlarından geçer, skill üzerinden dolanılamaz.

## Prompt her zaman user düzeyinde

`buildSkillPromptMessage(skill, args)` `role: 'user'` mesajı üretir; skill içeriği hiçbir zaman system mesajı olmaz. Mesaj başında skill içeriğinin ve argümanların veri olduğu, sistem talimatı veya yeni araç yetkisi vermediği belirtilir. Argümanlar manifest şemasına göre doğrulanır: bilinmeyen argüman, eksik zorunlu argüman, tip uyuşmazlığı ve 2.000 karakteri aşan string reddedilir.

## Public görünüm

`listPublicSkills(registry)` yalnız `id`, `name`, `description`, `source`, `execution` ve `triggers` döndürür; `prompt` istemciye sızmaz.

## Geri alma

Katman bağımsızdır: `lib/skill-registry.mjs`, `scripts/test-skill-registry.mjs` ve bu doküman kaldırıldığında çalışan davranış değişmez.
