# Skills manifest ve registry sözleşmesi

`lib/skill-manifest.mjs` ve `lib/skill-registry.mjs`, Claude araştırma notundaki (bkz.
`docs/CLAUDE_RESEARCH_INTEGRATION.md`, uygulama sırası madde 2) skill katmanının ilk
güvenlik sözleşmesini uygular. Bu tur yalnız sözleşme + registry seviyesidir; skill
yürütmesi henüz server'a bağlanmamıştır.

## Manifest alanları

| Alan | Zorunlu | Not |
| --- | --- | --- |
| `id` | evet | `^[a-z][a-z0-9-]{1,63}$` |
| `name`, `description` | evet | kullanıcıya görünen kısa metin |
| `source` | evet | `builtin` \| `user` \| `project` |
| `projectScope` | yalnız `project` için | `..` içeremez; diğer kaynaklarda alan verilemez |
| `execution` | hayır | `inline` (varsayılan) \| `fork` |
| `model` | hayır | model tercihi; serbest metin değil, dar pattern |
| `triggers` | hayır | en fazla 12, tekrarsız |
| `allowedTools` | hayır | en fazla 16 permission adı |
| `arguments` | hayır | en fazla 8, `{name, description, required, maxLength}` |
| `prompt` | evet | en fazla 20.000 karakter |

Bilinmeyen alan, tekrar eden değer veya biçim hatası `INVALID_SKILL_MANIFEST:<alan>`
ile reddedilir; kısmi manifest sessizce kabul edilmez.

## Güvenlik kuralları

- **Yetki yükseltme yok.** `allowedTools` yalnız bir istek listesidir. `resolveSkillForAgent`
  her aracı ajanın kendi `toolPolicy`'si üzerinden `authorizeAgentTool` ile geçirir;
  ajanın izinli olmadığı araç `deniedTools` içine düşer, hata üretmez.
- **`secret.read` ve `repo.delete` manifestte bile yazılamaz.**
- **Prompt secret taşıyamaz.** Private key blokları, `api_key:`/`token=`/`Authorization: Bearer`
  benzeri atamalar ve bilinen anahtar önekleri (`nvapi-`, `ghp_`) reddedilir.
- **Fork execution parent onayını miras almaz.** `execution: 'fork'` çözümlemesinde
  `approvalGranted` her zaman `false` kabul edilir; approval-required araçlar kapalı kalır.
- **Kaynak güveni:** çakışan `id` durumunda daha güvenilir kaynak kazanır
  (`builtin` > `user` > `project`). Bir project skill'i builtin veya user skill'ini
  gölgeleyemez; gölgelenen kayıt `rejected` listesinde `shadowed_by_trusted_source` olarak görünür.
- **Project skill yalnız açıkça izin verilen kapsamdan yüklenir.** `buildSkillRegistry`
  çağrısına verilen `allowedProjectScopes` dışındaki her project skill
  `project_scope_not_allowed` ile reddedilir.
- **Public listede prompt yoktur.** `listPublicSkills` yalnız `id`, `name`, `description`,
  `source`, `execution` ve `triggers` döndürür.

## Test

`node scripts/test-skill-manifest.mjs` ve `node scripts/test-skill-registry.mjs`
(ikisi de `npm run check` içinde). Kapsam: strict alan doğrulama, secret reddi,
kapsam dışı project skill, gölgeleme yönü, yetki yükseltme denemesi ve fork onay mirası.

Sonraki tur: argüman bağlama, inline/fork yürütme ve trace kaydı ile server wiring.
