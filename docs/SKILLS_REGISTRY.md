# Skills manifest ve registry sözleşmesi

Bu katman `CLAUDE_RESEARCH_INTEGRATION.md` içindeki "Skills registry" maddesinin ilk uygulamasıdır. `lib/skill-manifest.mjs` strict manifest doğrulamasını, `lib/skills-registry.mjs` kaynak önceliği ve yetki kararını verir. **Bu turda server wiring yapılmaz; katman henüz production tool catalog'a bağlı değildir.**

## Manifest alanları

Yalnız şu alanlar kabul edilir: `id`, `name`, `description`, `triggers`, `allowedTools`, `arguments`, `model`, `execution`, `prompt`. Bilinmeyen her alan `INVALID_SKILL_FIELD` ile reddedilir.

- `id`: `^[a-z][a-z0-9-]{1,47}$`.
- `triggers`: en fazla 12, küçük harfe normalize edilir, duplicate reddedilir.
- `arguments`: en fazla 8; yalnız `string`, `number`, `boolean` tipleri.
- `model`: verilmezse `auto`; serbest metin veya URL kabul edilmez.
- `execution`: yalnız `inline` veya `fork`. Claude tarafındaki `bypass` benzeri modlar alınmaz.
- `prompt`: en fazla 8000 karakter.

`source` alanı manifest'in kendi içinde bulunamaz; kaynak yalnız yükleyici tarafından `normalizeSkillManifest(input, { source })` ile verilir. Böylece bir skill kendini `builtin` ilan edemez.

## Yetki yükseltme yasağı

- `secret.read` ve `repo.delete` hiçbir skill manifest'inde bulunamaz.
- `external.write`, `external.send`, `repo.merge` ve `repo.write_branch` manifest üzerinden **önceden** alınamaz; onay gerektiren işlemler skill değil, mevcut approval gate'leri üzerinden yürür.
- `authorizeSkill()` izin kararını daima ajan policy'sinden ve `approvalGranted: false` ile alır. Ajanın sahip olmadığı bir araç skill üzerinden kazanılamaz (`SKILL_TOOL_NOT_AUTHORIZED`).
- `fork` execution sonucunda `inheritsParentTools: false` döner; child ajan parent araçlarını otomatik miras almaz.

## Credential hygiene

`name`, `description`, `triggers` ve `prompt` alanları private key, `sk-`/`gh*_`/`AKIA` benzeri token desenleri ve `api_key:` / `client_secret=` / `password:` gibi anahtar-değer kalıpları için taranır. Eşleşme `SKILL_CREDENTIAL_MATERIAL` ile reddedilir. Skill prompt'u secret taşımaz; secret'lar backend ortam değişkenlerinde kalır.

## Kaynak önceliği

1. `builtin`: Hafize ile gelen skill'ler.
2. `user`: hesap sahibinin skill'leri; aynı `id` ile bir builtin skill'i geçersiz kılabilir (`overrides: 'builtin'`).
3. `project`: repo içeriğidir ve güvenilmez kabul edilir. Yalnız `projectScopeAllowed: true` ile yüklenir (`PROJECT_SKILL_SCOPE_DENIED`) ve mevcut bir builtin/user skill'ini gölgeleyemez (`SKILL_PROJECT_SHADOW`).

Aynı kaynak içinde duplicate `id` reddedilir. Kaynak başına en fazla 64 skill yüklenir.

## Görünürlük

`list()` yalnız `id`, `name`, `description`, `source`, `execution`, `triggers` ve `overrides` alanlarını döndürür; `prompt` ve `allowedTools` modele liste üzerinden sızmaz. `match()` kullanıcı metnini küçük harfe indirip ilk 2000 karakteri içinde trigger arar ve varsayılan olarak en fazla 5 aday döndürür; eşleşme tek başına çalıştırma yetkisi vermez, karar `authorizeSkill()` içindedir.

## Test

`node scripts/test-skill-manifest.mjs` ve `node scripts/test-skills-registry.mjs` (her ikisi de `npm run check` içinde).

## Sonraki adım

Server wiring, skill çalıştırma runtime'ı (inline context enjeksiyonu ve fork delegasyonu) ve owner-scoped user/project skill kaynaklarının kalıcı depolanması ayrı turlarda ele alınacaktır.
