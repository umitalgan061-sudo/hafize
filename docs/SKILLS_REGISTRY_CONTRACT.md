# Skills manifest sözleşmesi

Bu katman Claude-benzeri skill yaklaşımının Hafize uyarlamasının ilk adımıdır. `lib/skill-manifest.mjs` tek bir skill tanımını strict doğrular ve çalıştırma anındaki argümanları normalize eder.

**Bu tur yalnız manifest sözleşmesini ekler; registry, tool catalog kaydı ve server chat wiring bu turda yoktur.**

## Manifest alanları

`id`, `name`, `description`, `execution` ve `prompt` zorunludur. `triggers`, `requestedTools`, `arguments`, `model` opsiyoneldir. Tanımsız her üst alan reddedilir; böylece manifest `toolPolicy`, `permissions`, `systemPrompt` veya `apiKey` gibi yetki alanları taşıyamaz.

- `id`: `^[a-z][a-z0-9-]{1,48}$`.
- `execution`: yalnız `inline` veya `fork`.
- `fork` için `forkAgentId` zorunlu, `inline` için yasaktır.
- `requestedTools` bir **istektir, yetki değildir**; en fazla 16 araç adı taşır ve yalnız çağıran bağlamın izinli araçlarıyla kesiştirilerek kullanılabilir.
- `arguments`: en fazla 8 adet `string` / `number` / `boolean` tanımı.

## Güvenlik sınırları

- `source` alanını manifest içeriği belirleyemez; yalnız loader `builtin` / `user` / `project` olarak verir. Manifest içinde `source` alanı bulunması hatadır.
- Skill prompt'u secret referansı içeremez: `process.env`, `${secrets...}`, `{{ env... }}` benzeri kalıplar reddedilir.
- Argüman adları `token`, `apiKey`, `password`, `authorization`, `credential` gibi credential desenleri içeremez.
- `project` kaynaklı manifest `projectScope` taşımak zorundadır; `builtin` ve `user` manifestleri `projectScope` taşıyamaz.
- `normalizeSkillArguments` bilinmeyen argümanı, eksik zorunlu argümanı ve tip uyuşmazlığını reddeder. Argüman değerleri prompt'a interpolasyon ile gömülmek için değil, ayrı ve açıkça "veri" etiketli blok olarak taşınmak içindir.

## Hata davranışı

Tüm hatalar `INVALID_SKILL_MANIFEST:<alan>` biçiminde `Error` fırlatır; `error.code` ve `error.field` alanları doldurulur. Çağıran katman geçersiz manifesti atlayıp raporlayabilir.

## Test

`scripts/test-skill-manifest.mjs` (check gate'e bağlıdır).

## Sıradaki tur: registry

`lib/skill-registry.mjs` şu sözleşmeyle eklenecektir:

- Kaynak rank'i `builtin (0) < user (1) < project (2)`; aynı `id` için **düşük rank kazanır**, yani user/project manifesti güvenilen builtin skill'i gölgeleyemez, kaybeden kayıt `SKILL_SHADOWED_BY_<KAYNAK>` olarak raporlanır.
- `project` skill yalnız açıkça izin verilen `allowedProjectScopes` kapsamından yüklenir; aksi hâlde `PROJECT_SCOPE_NOT_ALLOWED`.
- Geçersiz manifest registry'yi düşürmez; `registry.problems` içinde `{ source, id, error }` olarak görünür.
- `resolve(skillId, { availableTools, args })`: `plan.tools` = istenen ∩ mevcut, `plan.deniedTools` = istenen − mevcut. Yetki yükseltme yoktur.
- Skill prompt'u `role: 'user'` mesajı olarak paketlenir, system yetkisi kazanmaz; argümanlar ayrı "veri" bloğu olarak eklenir.
- `fork` planı yalnız `forkAgentId` taşır; hedef ajanın araçları parent'tan otomatik miras alınmaz.

Yürütmenin chat akışına bağlanması için ayrıca: skill seçiminin kullanıcıya görünür olması, `fork` yürütmesinin mevcut delegation depth/fan-out sınırlarına tabi tutulması ve skill kaynaklı tool çağrılarının backend default-deny gate'inden geçmesi gerekir.
