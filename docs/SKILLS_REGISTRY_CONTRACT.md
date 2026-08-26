# Skills manifest ve registry sözleşmesi

Bu katman Claude-benzeri skill yaklaşımının Hafize uyarlamasıdır. `lib/skill-manifest.mjs` tek bir skill tanımını strict doğrular ve çalıştırma anındaki argümanları normalize eder; `lib/skill-registry.mjs` birden çok kaynağı tek kataloğa çözer ve yürütme planı üretir.

**Tool catalog kaydı ve server chat wiring henüz yoktur; registry hiçbir aracı kendisi çağırmaz, yalnız plan üretir.**

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

## Registry — `lib/skill-registry.mjs`

`createSkillRegistry({ sources, allowedProjectScopes })` donmuş bir katalog döndürür: `list()`, `get(id)`, `has(id)`, `size`, `problems`, `resolve(id, options)`.

### Kaynak önceliği

Kaynak rank'i `builtin (0) < user (1) < project (2)`; aynı `id` için **düşük rank kazanır**, yani user/project manifesti güvenilen builtin skill'i gölgeleyemez. Kaybeden kayıt `SKILL_SHADOWED_BY_<KAZANAN_KAYNAK>` olarak `problems` içinde raporlanır; aynı kaynaktaki tekrar `DUPLICATE_SKILL_ID` olur.

### Yükleme sınırları

- `project` skill yalnız açıkça izin verilen `allowedProjectScopes` kapsamından yüklenir; aksi hâlde `PROJECT_SCOPE_NOT_ALLOWED`. Allowlist verilmezse hiçbir project skill yüklenmez.
- Geçersiz manifest registry'yi düşürmez; `{ source, id, error }` olarak `problems` içinde görünür ve geçerli skill'ler yüklenmeye devam eder.
- En çok `100` skill kabul edilir; taşan kayıt sessizce düşmez, `SKILL_LIMIT_EXCEEDED` olarak raporlanır.
- Registry girdisi de strict'tir: bilinmeyen üst alan, bilinmeyen kaynak adı ve bozuk scope listesi `INVALID_SKILL_REGISTRY:<alan>` hatası verir.

### `resolve(skillId, { availableTools, args })`

- `plan.tools` = `requestedTools` ∩ `availableTools`, `plan.deniedTools` = `requestedTools` − `availableTools`. **Yetki yükseltme yoktur**; `availableTools` verilmezse hiçbir araç verilmez.
- `plan.messages` yalnız `role: 'user'` mesajlarıdır; skill prompt'u system yetkisi kazanmaz.
- Argümanlar prompt'a interpolasyon ile gömülmez; ayrı `<skill-arguments>` veri bloğunda taşınır ve blok içindeki `<` kaçırılır, böylece argüman değeri bloğu kapatıp talimat alanına geçemez.
- `fork` planı `forkAgentId` taşır ve `toolGrant: 'deferred'` olur: hedef ajanın araçları parent'tan otomatik miras alınmaz, yetkilendirme hedef ajanın kendi policy'sine bırakılır. `inline` planı `toolGrant: 'intersection'` olur.
- Bilinmeyen skill `SKILL_NOT_FOUND:<id>`, bozuk çağrı `INVALID_SKILL_RESOLVE:<alan>`, bozuk argüman `INVALID_SKILL_MANIFEST:arguments.*` hatası verir.

## Test

`scripts/test-skill-manifest.mjs` ve `scripts/test-skill-registry.mjs` (ikisi de check gate'e bağlıdır).

## Sıradaki tur: chat wiring

Yürütmenin chat akışına bağlanması için ayrıca: skill seçiminin kullanıcıya görünür olması, `fork` yürütmesinin mevcut delegation depth/fan-out sınırlarına tabi tutulması ve skill kaynaklı tool çağrılarının backend default-deny gate'inden geçmesi gerekir. Registry plan üretir; çağrı yetkisini hâlâ `lib/tool-runtime.mjs` verir.
