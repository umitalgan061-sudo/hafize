# Skill manifest ve registry sözleşmesi

Kaynak: `lib/skill-manifest.mjs`, `lib/skill-registry.mjs`. Testler: `scripts/test-skill-manifest.mjs`, `scripts/test-skill-registry.mjs`. Bu katman `docs/CLAUDE_RESEARCH_INTEGRATION.md` uygulama sırasındaki 2. maddedir.

## Manifest alanları

Zorunlu: `id` (`^[a-z][a-z0-9-]{1,63}$`), `name` (1–80), `description` (1–400), `prompt` (1–8000). Opsiyonel: `triggers` (≤12, küçük harf, tekrarsız), `allowedTools` (≤16, tekrarsız), `arguments` (≤8; `{ name, required, description }`), `execution` (`inline` varsayılan veya `fork`), `model`. `path` yalnız `project` kaynağında ve izin verilen kapsam içinde geçerlidir.

Doğrulama strict'tir: geçersiz alan sessizce düzeltilmez, manifest `INVALID_SKILL:<alan>` ile reddedilir ve başarı durumunda donmuş bir skill nesnesi döner.

## Güvenlik sınırları

- **Skill kendi tool yetkisini yükseltemez.** `secret.read`, `repo.delete`, `repo.merge`, `external.write`, `external.send`, `repo.write_branch` manifest seviyesinde reddedilir. Kalan araçlarda karar `authorizeAgentTool` ile ajan policy'sine aittir; istenen araçlardan biri bile ajanda yoksa skill hiç başlatılmaz (`SKILL_TOOL_NOT_AUTHORIZED:<araç>`).
- **Onay gerektiren araç onaysız çalışmaz;** yalnız `approvedTools` ile açıkça onaylandığında çözümlenir.
- **Skill prompt'u secret veya credential alamaz.** Bilinen anahtar biçimleri (`nvapi-`, `gh*_`, `sk-`, `AIza`, `Bearer <token>`, `*_TOKEN=`, private key başlığı) `INVALID_SKILL:secretMaterial` ile reddedilir.
- **Project skill yalnız açıkça izin verilen kapsamdan yüklenir.** `path` göreli olmalı; `..`, mutlak yol veya kapsam dışı önek reddedilir. `projectScope` boşsa hiçbir project skill yüklenmez.
- **Skill prompt'u sistem yetkisi kazanmaz.** `buildSkillInvocation` çıktısı `role: 'user'` mesajıdır ve bu metnin yeni yetki vermediğini açıkça belirtir.

## Kaynak önceliği ve execution

Öncelik `builtin > user > project`; aynı `id` için yüksek güvenilirlikli kaynak kazanır ve gölgelenen kayıt `registry.shadowed` içinde raporlanır, böylece depoya düşen bir proje dosyası builtin skill davranışını ele geçiremez. Geçersiz manifestler registry'yi düşürmez, `registry.errors` içinde toplanır.

`inline` mevcut konuşmaya eklenecek `message` üretir (`task: null`); `fork` alt ajan çalıştırması için `task` metni üretir (`message: null`). Her iki durumda `tools` yalnız çözümleme sırasında yetkilendirilmiş araçları içerir. HTTP/server wiring, skill listeleme ve builtin katalog ayrı bir turda kendi testleriyle eklenecektir.
