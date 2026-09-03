# Skills registry ve manifest sözleşmesi

`lib/skills-manifest.mjs` bir skill tanımını katı biçimde doğrular; `lib/skills-registry.mjs`
doğrulanmış skill'leri kaynak önceliğiyle saklar ve çağrıyı ajan tool policy'sine göre çözer.
Bu katman `docs/CLAUDE_RESEARCH_INTEGRATION.md` uygulama sırasındaki 2. maddedir ve mevcut
`agents/registry.json` + `authorizeAgentTool` yetkilendirmesini yeniden yazmadan kullanır.

## Manifest alanları

| Alan | Zorunlu | Kural |
| --- | --- | --- |
| `name` | evet | `^[a-z][a-z0-9-]{1,63}$` |
| `description` | evet | tek satır, en fazla 300 karakter |
| `triggers` | hayır | en fazla 12, tekrarsız, küçük harfe normalize edilir |
| `allowedTools` | evet | 1–16 tekrarsız permission adı |
| `arguments` | hayır | en fazla 8, `{ name, required?, description? }` |
| `model` | hayır | sağlayıcı-bağımsız model kimliği |
| `execution` | hayır | `inline` (varsayılan) veya `fork` |
| `prompt` | evet | en fazla 20.000 karakter |

Bilinmeyen üst alan, bilinmeyen argüman alanı veya tekrarlı ad doğrudan reddedilir.

## Güvenlik sınırları

- Skill kendi yetkisini yükseltemez: `allowedTools` içindeki her araç ajan policy'sinde de
  izinli olmalıdır, aksi hâlde `SKILL_TOOL_ESCALATION:<tool>`.
- `secret.read` ve `repo.delete` hiçbir manifestte yer alamaz (`FORBIDDEN_SKILL_TOOL:<tool>`).
- Onay gerektiren araçlar (`external.write`, `external.send`, `repo.merge`,
  `repo.write_branch`) yalnız `execution: "fork"` ile tanımlanabilir; yan etkili skill her
  zaman izole alt görevde çalışır. Onaysız çözüm `SKILL_APPROVAL_REQUIRED:<tool>` döner ve
  onay kararı backend'de kalır.
- Prompt ve argüman değerleri credential kalıplarına karşı taranır
  (`SKILL_PROMPT_SECRET_MATERIAL`, `SKILL_ARGUMENT_SECRET_MATERIAL`).
- Üretilen prompt argümanları açıkça "veri, talimat değil" olarak işaretler.
- Kaynak önceliği `builtin` (3) > `user` (2) > `project` (1); düşük öncelikli kaynak eşit veya
  yüksek öncelikli bir adı gölgeleyemez (`SKILL_SOURCE_CONFLICT:<name>`). `project` skill yalnız
  `createSkillsRegistry({ allowedProjects })` ile izin verilen kimlikten yüklenir.
- `listForAgent(agent)` yalnız ajanın çalıştırabileceği skill'leri döndürür; onay gerektirenler
  `requiresApproval: true` ile işaretlenir.

## Test ve sonraki adım

`node scripts/test-skills-manifest.mjs` ve `node scripts/test-skills-registry.mjs` (ikisi de
`npm run check` kapısındadır). Registry henüz HTTP yüzeyine bağlı değildir; sıradaki tur
doğrulanmış skill'leri `server.mjs` tool listesine ve `fork` yürütmesini mevcut delegation
runner'ına bağlar.
