# Skills registry ve execution sözleşmesi

`lib/skill-manifest.mjs` bir skill manifestini strict doğrular; `lib/skill-registry.mjs` kaynak
önceliğini, proje kapsamını, araç yetkisi kesişimini ve invocation üretimini yönetir.

## Manifest

Zorunlu: `schemaVersion` (yalnız `1`), `name` (`^[a-z][a-z0-9-]{1,63}$`), `description` (≤500),
`execution` (`inline` | `fork`), `prompt` (≤20000). `execution: 'fork'` ise `forkAgentId`
zorunludur ve `inline` manifestte bulunamaz.

Opsiyonel: `triggers` (≤16), `allowedTools`, `approvalRequiredTools`, `arguments`
(`{ name, description, required, maxLength }`, ≤12), `model`, `version`.

Bilinmeyen üst düzey alan veya bilinmeyen argüman alanı manifesti reddeder.

## Güvenlik sınırları

- **Skill kendi yetkisini yükseltemez.** `secret.read` ve `repo.delete` hiçbir listede kabul
  edilmez; `external.write`, `external.send`, `repo.merge` ve `repo.write_branch` yalnız
  `approvalRequiredTools` içinde yer alabilir.
- **Efektif yetki kesişimdir.** `authorizeSkillTool()` önce agent policy'sini uygular; agent
  reddederse skill allowlist'i sonucu değiştiremez. Skill yalnız daraltabilir: agent'ın doğrudan
  izinli bir aracını onay arkasına alabilir, tersini yapamaz.
- **Skill metni secret taşıyamaz.** Manifest tamamı özel anahtar blokları, `sk-`/`ghp_`/`xox`/
  `AKIA`/`AIza` biçimli token'lar, `process.env` erişimi ve `*_API_KEY`, `*_ACCESS_TOKEN`,
  `CLIENT_SECRET`, `PASSWORD` gibi credential adları için taranır.
- **Skill prompt'u system yetkisi kazanmaz.** `buildSkillInvocation()` her zaman `role: 'user'`
  mesajı üretir ve argümanları açıkça "talimat değil veri" olarak çerçeveler.

## Kaynak önceliği ve proje kapsamı

Öncelik `builtin` > `user` > `project`. Daha düşük öncelikli kaynak var olan bir adı gölgeleyemez;
girişim `SKILL_SHADOWED` ile reddedilir ve `listConflicts()` üzerinden gözlemlenebilir kalır.
Böylece bir depo, kullanıcının veya ürünün skill'ini kendi sürümüyle değiştiremez.

`project` kaynaklı skill yalnız `createSkillRegistry({ allowedProjectScopes: ['owner/repo'] })`
ile açıkça izin verilmiş bir kapsamdan yüklenir; varsayılan liste boştur (default-deny) ve
`builtin`/`user` kaynaklarına `projectScope` verilmesi reddedilir.

## Testler

`node scripts/test-skill-manifest.mjs` ve `node scripts/test-skill-registry.mjs`; ikisi de
`npm run check` içinde koşar.
