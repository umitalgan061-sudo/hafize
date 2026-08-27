# Skills registry ve manifest sözleşmesi

`lib/skills-registry.mjs`, `docs/CLAUDE_RESEARCH_INTEGRATION.md` §2'de tanımlanan skill katmanının ilk uygulamasıdır. Bir skill; ad, açıklama, tetikleyici, izin verilen araçlar, argümanlar, model tercihi ve execution context'i ayrı ayrı doğrulanan bir manifesttir. Katman şu an saftır; henüz hiçbir çalışan istek yolunu değiştirmez.

## Manifest alanları

- `id` (zorunlu): `^[a-z][a-z0-9-]{1,63}$`.
- `name` / `description` (zorunlu): tek satır, ≤80 / ≤400 karakter.
- `source` (zorunlu): `builtin`, `user` veya `project`.
- `execution` (zorunlu): `inline` veya `fork`.
- `triggers` (zorunlu): 1–12 adet; Türkçe locale ile küçük harfe indirgenir.
- `tools`, `arguments`, `model` (isteğe bağlı): varsayılan boş liste / `null`. Argüman tipi `string`, `number` veya `boolean` olabilir.
- `prompt` (zorunlu): 8–20.000 karakter.
- `projectScope`: yalnız `project` kaynağında ve yalnız açıkça izin verilen kapsam listesinden.

Bilinmeyen alanlar `INVALID_SKILL_MANIFEST:manifest.<alan>` ile reddedilir; böylece bir manifest kendine `toolPolicy` veya `systemPrompt` gibi yeni yetki alanları uyduramaz.

## Güvenlik sınırları

- **Yetki yükseltme yok.** `tools` yalnız host ajanın hâlihazırda sahip olduğu izinlerin alt kümesi olabilir (`SKILL_PERMISSION_ESCALATION:<izin>`).
- **Asla verilmeyen izinler.** `secret.read` ve `repo.delete` manifestte bulunamaz (`SKILL_PERMISSION_FORBIDDEN`).
- **Onay gerektiren izinler gömülemez.** `external.write`, `external.send`, `repo.merge`, `repo.write_branch` manifestte listelenemez (`SKILL_PERMISSION_APPROVAL_ONLY`); bu işlemler kullanıcı onayı akışında kalır.
- **Prompt secret taşımaz.** `process.env`, `Bearer <token>`, `api_key:`, private key başlığı ve bilinen anahtar önekleri (`sk-`, `nvapi-`, `ghp_`, `AKIA`) `SKILL_PROMPT_SECRET_SUSPECTED` ile reddedilir.
- **Project skill dar kapsamlıdır.** `..` içeren veya izin listesinde olmayan kapsam reddedilir.

## Kaynak önceliği

Güven sırası `builtin` > `user` > `project`'tir; aynı `id` birden fazla kaynaktan gelirse daha güvenilir kaynak kazanır, kaybeden `registry.shadowed` içinde raporlanır. Yön bilinçlidir: daha az güvenilen bir kaynak yerleşik bir skill'in davranışını sessizce değiştiremez. Doğrulamayı geçemeyen manifest tüm registry'yi düşürmez; `registry.rejected` içinde `{ id, source, reason }` olarak görünür ve yüklenmez.

## Execution contract

`buildSkillExecutionPlan(skill, { hostPermissions, traceId })` dondurulmuş bir plan üretir: `inline` mevcut ajan turunda ve aynı `traceId` ile çalışır (`isolated: false`), `fork` sınırlı ve izole bir alt çalıştırmadır (`isolated: true`). Her iki modda da `inheritsHostTools: false`'tur; skill yalnız manifestinde açıkça listelenen ve host ajanda hâlâ mevcut olan izinleri alır, aksi hâlde plan üretilmez. `registry.listPublic()` yalnız `id`, `name`, `description`, `source` ve `execution` döndürür; skill prompt'u istemciye sızmaz.

## Test ve geri alma

`node scripts/test-skills-registry.mjs` (`npm run check` içinde çalışır) manifest doğrulamasını, yetki yükseltme reddini, secret taramasını, project kapsamını, kaynak önceliğini, tetikleyici eşleşmesini ve execution planını kapsar. Geri alma: `lib/skills-registry.mjs`, `scripts/test-skills-registry.mjs`, bu belge ve `package.json` içindeki iki `check` girdisi kaldırılır.
