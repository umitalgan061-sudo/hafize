# Skills Manifest ve Registry Sözleşmesi

`docs/CLAUDE_RESEARCH_INTEGRATION.md` uygulama sırasındaki 2. maddenin ilk katmanı. Bu belge bir skill'in ne olduğunu ve hangi sınırlar içinde yüklendiğini tanımlar; skill yürütme (inline/fork runtime) sonraki adımda bu sözleşmenin üzerine kurulur.

## Manifest alanları

`lib/skills-manifest.mjs` içindeki `normalizeSkillManifest` strict doğrulama yapar; tanımlı olmayan her alan reddedilir.

- `id` (zorunlu): `^[a-z][a-z0-9-]{1,63}$`.
- `name` (zorunlu, ≤ 80) ve `description` (zorunlu, ≤ 500).
- `source` (zorunlu): `builtin` | `user` | `project`.
- `projectScope`: yalnız `project` kaynağında zorunlu, diğerlerinde bulunamaz.
- `triggers` (zorunlu): 1–12 tetikleyici; küçük harfe normalize edilir, tekrar edemez.
- `allowedTools` (zorunlu): 0–16 tool adı; `secret.read` ve `repo.delete` hiçbir zaman kabul edilmez.
- `arguments`: 0–8 argüman; `name`, `type` (`string`/`number`/`boolean`), `required`, `description`.
- `model`: yalnız `fork` execution için model sabitleme.
- `execution` (zorunlu): `inline` | `fork`.

## Güvenlik kararları

- **Skill kendi yetkisini yükseltemez.** `authorizeSkillTools(agent, skill)` her tool'u ajanın `toolPolicy` kararına sorar. Ajanın erişemediği bir tool `SKILL_TOOL_ESCALATION:<tool>` ile reddedilir; ajanın onaya bağladığı tool skill içinde de onaya bağlı kalır. Manifest'in tool listesi tek başına yetki vermez.
- **Manifest metni credential taşıyamaz.** `api_key`, `secret`, `token`, `password`, `bearer` gibi anahtar/değer görünümlü içerik `SKILL_MANIFEST_CREDENTIAL_NOT_ALLOWED:<alan>` ile reddedilir; böylece secret bir skill prompt'una manifest üzerinden giremez.
- **Project skill yalnız açıkça izin verilen kapsamdan yüklenir.** `loadSkillRegistry({ allowedProjectScopes })` listesinde bulunmayan `projectScope` `SKILL_PROJECT_SCOPE_NOT_ALLOWED` verir; liste verilmezse hiçbir project skill yüklenmez.
- **Inline skill model değiştiremez.** `inline` yürütme çağıran konuşmanın modelini ve bağlamını paylaştığı için `model` alanı yalnız `fork` için geçerlidir; aksi hâlde `SKILL_INLINE_MODEL_OVERRIDE_NOT_ALLOWED`.
- **Kaynak önceliği builtin > user > project.** Aynı `id` farklı kaynaklardan gelirse yüksek öncelikli kaynak kazanır ve düşük öncelikli kayıt `registry.shadowed` içine yazılır; bir project manifest'i builtin bir skill'in adını ele geçiremez. Aynı kaynaktan gelen tekrar `INVALID_SKILL_REGISTRY:duplicate:<id>` ile yükleme hatasıdır.
- **Strict yükleme.** Geçersiz tek bir manifest tüm registry yüklemesini durdurur; kısmen geçerli bir skill seti sessizce kullanılmaz.

## Yürütme ayrımı

- `inline`: skill çağıran ajanın bağlamı ve modeli içinde çalışır; ek model veya ek tool yetkisi almaz.
- `fork`: skill ayrı bir yürütme bağlamında çalışır ve kendi modelini sabitleyebilir; tool yetkisi yine çağıran ajanın policy'siyle kesişimden gelir.

## Test

- `node scripts/test-skills-manifest.mjs`
- `node scripts/test-skills-registry.mjs`

İkisi de `npm run check` kapısına eklenmiştir.
