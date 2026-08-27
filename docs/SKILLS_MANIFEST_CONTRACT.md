# Skills manifest ve registry sözleşmesi

`docs/CLAUDE_RESEARCH_INTEGRATION.md` uygulama sırasındaki 2. maddeyi karşılar: strict manifest doğrulaması, kaynak öncelikli registry ve `inline` / `fork` execution ayrımı. Katman şu an **saf sözleşmedir**: tool catalog'a `skill_run` kaydı eklemez, prompt çalıştırmaz, ağ çağrısı yapmaz.

## Manifest

`normalizeSkillManifest()` yalnız şu alanları kabul eder, diğer her alan `INVALID_SKILL_MANIFEST_FIELD` ile reddedilir: zorunlu `id` (`^[a-z][a-z0-9-]{1,63}$`), `name` (≤80), `description` (≤400), `execution` (`inline` | `fork`), `prompt` (≤20.000); opsiyonel `triggers` (≤16, küçük harfe normalize), `allowedTools` (≤12), `arguments` (≤8 adet `{ name, type, required, maxLength }`), `model` (yalnız tercih; backend model seçimini bağlamaz).

`source` ve `projectScope` manifest alanı **değildir**; yükleyici tarafından verilir, böylece bir skill kendi güven seviyesini beyan edemez.

## Güvenlik sınırları

- **Skill kendi tool yetkisini yükseltemez.** `allowedTools` içindeki `secret.read`, `repo.delete`, `external.write`, `external.send`, `repo.merge`, `repo.write_branch` doğrudan `SKILL_TOOL_ESCALATION_DENIED` verir. Liste `lib/agent-runtime.mjs` içindeki tek kaynaktan gelir.
- `authorizeSkillTools(skill, agent)` her aracı ajanın kendi politikasına karşı doğrular ve **hiçbir zaman `approvalGranted` geçmez**; ajanın onaya bağlı aracı skill üzerinden açılamaz (`approval_required`).
- **Skill prompt'u credential taşıyamaz**: `api_key`, `secret`, `password`, `token`, `bearer`, `private_key`, `client_secret` gibi anahtarlara değer atayan promptlar `SKILL_PROMPT_CREDENTIAL_DENIED` ile reddedilir.
- `list()` çıktısı prompt içermez; model yalnız id, ad, açıklama, execution, kaynak ve izinli araçları görür.
- Bildirilmemiş argüman `UNDECLARED_SKILL_ARGUMENT`, eksik zorunlu argüman `MISSING_SKILL_ARGUMENT` verir.

## Kaynak önceliği

`builtin` > `user` > `project`. Daha düşük güvenli kaynak var olan bir skill id'sini gölgeleyemez (`SKILL_ID_SHADOWED`); daha yüksek güvenli kaynak var olan kaydı geçersiz kılabilir. Böylece bir proje deposu builtin bir skill'in prompt'unu veya araç listesini ele geçiremez. Project skill'ler yalnız `createSkillRegistry({ allowedProjectScopes })` ile açıkça izin verilen kapsamdan yüklenir (`PROJECT_SCOPE_NOT_ALLOWED`); registry en fazla 200 skill tutar.

## Execution ayrımı

`inline` skill prompt'u mevcut ajan turunda, `fork` ayrı bir alt görev bağlamında çalıştırılmak üzere işaretlenir. İki modda da tool yetkisi ajan politikasının kesişimiyle sınırlıdır; `fork` daha geniş yetki anlamına gelmez.

## Test

`node scripts/test-skill-manifest.mjs` ve `node scripts/test-skill-registry.mjs` (ikisi de `npm run check` içinde).

## Production'a açılma koşulu

Builtin skill kataloğu, `skill.list` / `skill.run` backend permission gate'i ve skill prompt'unun kullanıcı mesajından ayrı, yetki vermeyen bir bağlam bloğu olarak taşındığını doğrulayan server wiring testi.
