# Skills manifest ve registry sözleşmesi

`docs/CLAUDE_RESEARCH_INTEGRATION.md` uygulama sırasındaki 2. maddedir. Bu katman skill tanımlarının güvenlik sınırını belirler; **henüz tool catalog'a skill çağırma aracı eklemez ve kendi başına model çağrısı yapmaz.**

## Manifest alanları

`normalizeSkillManifest()` yalnız şu alanları kabul eder; bilinmeyen alan `INVALID_SKILL_FIELD` ile reddedilir.

- Zorunlu: `id` (`^[a-z][a-z0-9-]{1,47}$`), `name`, `description`, `source` (`builtin` | `user` | `project`), `execution` (`inline` | `fork`), `prompt` (≤ 8.000 karakter).
- Opsiyonel: `triggers` (küçük harfe indirgenir, tekrarsız, ≤ 12), `allowedTools` (permission adı, tekrarsız, ≤ 12), `arguments` (`{name, type, required, maxLength}`, ≤ 8), `model` (sağlayıcı-bağımsız kimlik).
- `projectScope` yalnız `project` kaynağında zorunludur; başka kaynakta bildirilirse reddedilir.

## Güvenlik sınırları

- **Yetki yükseltmesi yok.** `secret.read`, `repo.delete`, `repo.merge`, `repo.write_branch`, `external.write` ve `external.send` manifestte talep edilemez (`SKILL_TOOL_ESCALATION_FORBIDDEN`).
- **Secret yok.** Prompt içinde api key, credential, `Authorization:`, `process.env` veya private key kalıbı `SKILL_PROMPT_SECRET_FORBIDDEN` üretir.
- **Kesişim kuralı.** `prepareInvocation()` skill izinlerini ajan `toolPolicy`'siyle kesiştirir; onay bekleyen veya izinsiz araçlar `droppedTools` altında raporlanır ve prompt'ta modele gösterilmez.
- **Fork sınırı.** `fork` execution ayrı alt görev başlattığı için yalnız `agent.delegate` yetkisi olan ajanda çalışır (`SKILL_FORK_NOT_AUTHORIZED`).
- **Argümanlar veri.** Bildirilmemiş argüman, yanlış tip veya limit aşımı `INVALID_SKILL_ARGUMENTS` verir; kabul edilen argümanlar prompt'a "veri, talimat değil" etiketiyle yazılır.
- **Project kapsamı.** `project` kaynaklı skill yalnız `allowedProjectScopes` içinde açıkça listelenen kapsamdan yüklenir.

## Kaynak önceliği

Öncelik `builtin > user > project`'tir. Aynı `id` birden fazla kaynakta varsa daha güvenilir kaynak kazanır; gölgelenen kayıt sessizce yok sayılmaz, `registry.shadowed` üzerinden görünür kalır. Böylece düşük güvenilirlikteki bir proje dosyası yerleşik bir skill adını ele geçiremez.

## Test ve sıradaki adım

`npm run check` kapısına `scripts/test-skill-manifest.mjs` ve `scripts/test-skill-registry.mjs` eklendi. Sıradaki alt adım server wiring'dir: skill listesini owner-scoped yükleme, `skill.invoke` aracını agent policy arkasında sunma ve inline/fork yürütmeyi mevcut delegation/task-ledger altyapısına bağlama.
