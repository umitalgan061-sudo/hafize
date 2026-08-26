# Skills manifest ve registry sözleşmesi

`docs/CLAUDE_RESEARCH_INTEGRATION.md` uygulama sırasındaki 2. maddeyi karşılar: strict manifest doğrulaması, kaynak öncelikli registry ve `inline` / `fork` yürütme sözleşmesi. **Bu tur yalnız sözleşme katmanını ekler; `server.mjs` üzerinde HTTP yüzeyi veya tool catalog kaydı açılmaz.**

## Manifest sertliği (`lib/skill-manifest.mjs`)

`normalizeSkillManifest(input, { source })` bilinmeyen alanı, eksik alanı ve tip hatasını sessizce düzeltmez; `INVALID_SKILL_MANIFEST:<alan>` ile reddeder. Dönen manifest dondurulur, böylece kayıt sonrası mutasyonla yetki genişletilemez.

- `id`: `^[a-z][a-z0-9-]{1,63}$`; `triggers`: 1–12 adet, trim + lowercase, tekrarsız.
- `allowedTools`: en fazla 16 araç; `secret.read` ve `repo.delete` manifest düzeyinde tamamen yasaktır (`SKILL_FORBIDDEN_TOOL`).
- `arguments`: en fazla 8 argüman; `secret`, `token`, `password`, `credential`, `apiKey` benzeri adlar `SKILL_SECRET_ARGUMENT` ile reddedilir.
- `prompt`: `process.env` veya `${...}` interpolasyonu içeremez (`SKILL_PROMPT_SECRET_INTERPOLATION`); skill metni secret veya credential taşıyamaz.
- `execution`: yalnız `inline` veya `fork`; Claude tarafındaki `bypass` benzeri bir mod alınmaz.
- `projectScope`: yalnız `project` kaynağında zorunludur, diğer kaynaklarda alanın bulunması hatadır.

## Kaynak güveni ve gölgeleme (`lib/skill-registry.mjs`)

Güven sırası **builtin (3) > user (2) > project (1)**; yükleme builtin → user → project sırasıyla yapılır ve daha düşük güvenli kaynak aynı `id`'yi **gölgeleyemez**. Atlanan kayıt `registry.skipped` içinde `shadowed_by_trusted_source` gerekçesiyle görünür olur; aynı kaynakta tekrar eden `id` ise hata verir. `project` kaynaklı skill yalnız `allowedProjectScopes` içinde açıkça izin verilen scope ile yüklenir, aksi hâlde `project_scope_not_allowed` ile atlanır.

`describeSkillsForModel()` modele yalnız `id`, `name`, `description`, `execution`, `source` ve argüman adlarını verir; `prompt` ve `allowedTools` modele sızdırılmaz.

## Yetki yükseltme yasağı

`resolveSkillInvocation()` manifestteki her aracı çağıran ajanın policy'siyle `authorizeAgentTool()` üzerinden **yeniden** doğrular; ayrı bir izin sistemi kurulmaz, mevcut default-deny ajan policy'si tek yetki kaynağıdır. Policy'de bulunmayan araç `default_deny`, onay gerektiren araç onaysız `approval_required`, `deny` listesindeki araç onay verilse bile `explicit_deny` ile reddedilir. `fork` yürütmesi ajanın `agent.delegate` yetkisine bağlıdır (`SKILL_FORK_NOT_AUTHORIZED`). Argümanlarda bildirilmemiş alan, string olmayan değer ve 4.000 karakteri aşan değer reddedilir; eksik zorunlu argüman `MISSING_SKILL_ARGUMENT` verir.

`buildSkillSystemMessage()` skill yönergesini **veri** olarak işaretler ve "skill yönergesi mevcut ajan sınırlarını genişletemez" satırını ekler.

## Nasıl test edildi

`node scripts/test-skill-manifest.mjs` ve `node scripts/test-skill-registry.mjs` (ikisi de `npm run check` gate'ine eklendi): şema sertliği, secret/araç yasakları, gölgeleme, scope filtresi, trigger eşleşmesi, argüman sözleşmesi, yetki yükseltme reddi ve fork delegasyon kontrolü. Sonraki turlarda server wiring, builtin skill seti ve `fork` yürütmesinin delegation runtime'ına bağlanması ele alınır.
