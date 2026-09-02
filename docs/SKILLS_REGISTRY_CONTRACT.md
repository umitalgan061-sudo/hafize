# Skills manifest ve registry sözleşmesi

`lib/skill-manifest.mjs` + `lib/skill-registry.mjs`, `docs/CLAUDE_RESEARCH_INTEGRATION.md` uygulama sırasındaki 2. maddeyi karşılar.

## Manifest kuralları

- Alanlar yalnızca `id`, `name`, `description`, `triggers`, `allowedTools`, `arguments`, `model`, `execution`, `prompt`; bilinmeyen alan `INVALID_SKILL_FIELD` ile reddedilir.
- `source` manifest içinden gelmez; yükleyici tarafından `builtin` / `user` / `project` olarak verilir.
- `execution` yalnız `inline` veya `fork` olabilir; varsayılan `inline`. Claude tarafındaki `bypass` benzeri mod alınmaz.
- `allowedTools` bir izin listesidir, yetki kaynağı değildir. `secret.read`, `repo.delete`, `external.write`, `external.send`, `repo.merge`, `repo.write_branch` manifest içinde geçemez (`SKILL_TOOL_FORBIDDEN`).
- `prompt` içinde api key / token / password / private key benzeri desenler `SKILL_PROMPT_SECRET_FORBIDDEN` ile reddedilir.
- Tüm sonuçlar donmuş (frozen) nesnelerdir; limitler `SKILL_MANIFEST_LIMITS` ile dışa verilir.

## Registry kuralları

- Kaynak önceliği `builtin < user < project`; aynı `id` yüksek öncelikli kaynak tarafından ezilir, aynı kaynakta tekrar `SKILL_ID_CONFLICT` verir.
- `project` skill'i yalnız `allowedProjectScopes` içinde açıkça izin verilen kapsamdan yüklenir (`SKILL_PROJECT_SCOPE_NOT_ALLOWED`); diğer kaynaklar `scope` taşıyamaz.
- `listPublicSkills()` istemciye yalnız kimlik/açıklama/kaynak/tetikleyici verir; `prompt` ve çözümlenmiş araç listesi sızdırılmaz.
- `resolveSkillForAgent()` skill araçlarını ajan `toolPolicy` kararıyla kesiştirir: izinli olmayanlar `deniedTools` içinde gerekçesiyle döner. Skill hiçbir koşulda ajanın sahip olmadığı yetkiyi kazanamaz.
- Onay gerektiren izinler yalnız `approvalGranted` ile geçer; karar backend'de kalır.

## Wiring sözleşmesi (sıradaki adım)

- Skill prompt'u **user-level** mesaj olarak eklenir; sistem mesajı yerine geçmez ve sistem yetkisi kazanmaz.
- `fork` execution mevcut delegation/trace sınırlarını kullanır; `inline` aynı konuşmada çalışır.
- Skill listesi ve seçim UI'ı, backend'in gerçekten sunduğu araç kümesini değiştirmez.

## Test

- `node scripts/test-skill-manifest.mjs`
- `node scripts/test-skill-registry.mjs`

Her ikisi de `npm run check` kapısına eklendi.
