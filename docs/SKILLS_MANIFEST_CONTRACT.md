# Skills manifest sözleşmesi

`lib/skills-manifest.mjs`, Hafize skill katmanının strict doğrulama sınırıdır. Bir skill manifest'i ancak bu sözleşmeden geçtikten sonra registry'ye alınabilir veya çalıştırılabilir.

## Manifest alanları

| Alan | Zorunlu | Kural |
| --- | --- | --- |
| `name` | evet | `^[a-z][a-z0-9-]{1,63}$` |
| `description` | evet | ≤ 400 karakter |
| `prompt` | evet | ≤ 8000 karakter, satır kırma karakteri (`\r`) içeremez |
| `triggers` | hayır | ≤ 12 madde, her biri ≤ 120 karakter, küçük harfe normalize edilir, tekrar edemez |
| `allowedTools` | hayır | ≤ 12 permission, ajanın gerçekten sahip olduğu izinlerin alt kümesi |
| `arguments` | hayır | ≤ 8 argüman, `{ name, type, required, description }`, tip `string \| number \| boolean` |
| `model` | hayır | `^[a-z0-9][a-z0-9._/-]{1,99}$` |
| `execution` | hayır | `inline` (varsayılan) veya `fork` |

Listelenmeyen her üst düzey alan `INVALID_SKILL_MANIFEST_FIELD` ile reddedilir.

## Güvenlik sınırları

- **Kaynak manifest içinden ilan edilemez.** `source`, `projectScope` ve türetilen `trust` değerleri yalnızca çağıran taraftan (`normalizeSkillManifest(input, options)`) gelir. Böylece bir manifest kendini `builtin` ilan edip güven düzeyini yükseltemez.
- **Skill kendi araç yetkisini yükseltemez.** `allowedTools`, ajanın `toolPolicy.allow` kümesinin alt kümesi olmak zorundadır; `deny` listesindeki, yalnızca onayla açılan (`approvalRequired`) ve hiç verilmemiş izinler `SKILL_TOOL_ESCALATION_FORBIDDEN` ile reddedilir. Ajan `toolPolicy.default !== 'deny'` ise manifest hiç değerlendirilmez.
- **Hiçbir skill'e verilmeyen izinler:** `secret.read`, `repo.delete`, `repo.merge` → `SKILL_PERMISSION_FORBIDDEN`.
- **Skill metni credential taşıyamaz.** `description`, `prompt` ve argüman açıklamaları API key / token / `process.env` / `Authorization: Bearer` benzeri kalıplara karşı taranır → `SKILL_SECRET_MATERIAL_FORBIDDEN`.
- **Project skill yalnız açıkça izin verilen kapsamdan yüklenir.** `source: 'project'` için `projectScope` (`owner/repo`) zorunludur ve `allowedProjectScopes` içinde bulunmalıdır → aksi halde `SKILL_PROJECT_SCOPE_NOT_ALLOWED`.
- **Fork execution dar tutulur.** `execution: 'fork'` yalnız `agent.delegate` yetkisi olan ajanlarda açılır (`SKILL_FORK_NOT_AUTHORIZED`) ve project kaynaklı skill'lerde hiç açılmaz (`SKILL_FORK_SOURCE_FORBIDDEN`).

## Kaynak güven sırası

`SKILL_SOURCE_TRUST`: `builtin (3) > user (2) > project (1)`.

Güven değeri, aynı isimli skill'lerin çakışmasında hangi kaydın kazanacağını registry katmanının deterministik olarak belirlemesi için üretilir; daha az güvenilen bir kaynak daha güvenilir bir kaydı gölgeleyemez.

## Çıktı

Dönen kayıt tamamen dondurulmuştur (`Object.freeze`, iç diziler dâhil) ve şu alanları taşır: `name`, `description`, `source`, `projectScope`, `trust`, `triggers`, `allowedTools`, `arguments`, `model`, `execution`, `prompt`.

## Registry çözümlemesi

`lib/skills-registry.mjs` doğrulanmış kayıtları deterministik bir registry'ye çevirir:

- her kayıt `{ source, projectScope?, manifest }` biçimindedir ve manifest sözleşmesinden geçer;
- aynı isim iki kaynakta varsa **daha güvenilir kaynak kazanır**; gölgelenen kayıt yüklenmez ve `shadowed` listesinde raporlanır;
- aynı güven düzeyindeki isim çakışması sessizce çözülmez → `SKILL_NAME_CONFLICT`;
- `match(query)` kullanıcı metnindeki tetikleyicilere göre adayları güven sırasıyla döndürür;
- `listPublic()` modele yalnız `name`, `description`, `source` ve `execution` sunar; `prompt` ve `allowedTools` model bağlamına girmez;
- en fazla 64 skill yüklenir.

## Test

`node scripts/test-skills-manifest.mjs` ve `node scripts/test-skills-registry.mjs` — ikisi de `npm run check` gate'ine bağlıdır.
