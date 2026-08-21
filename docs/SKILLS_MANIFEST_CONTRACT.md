# Skills manifest ve registry sözleşmesi

`lib/skills-manifest.mjs`, Hafize skill katmanının doğrulama ve önceliklendirme sözleşmesidir.
Bu katman yalnız manifest verisini normalize eder; dosya sistemi okumaz ve skill çalıştırmaz.
Yükleyici ve çalıştırma kablolaması sonraki turlarda bu sözleşmenin üzerine eklenir.

## Manifest alanları

| Alan | Zorunlu | Kural |
| --- | --- | --- |
| `name` | evet | `^[a-z][a-z0-9-]{1,63}$` |
| `description` | evet | en fazla 400 karakter |
| `prompt` | evet | en fazla 20000 karakter, secret materyali içeremez |
| `triggers` | hayır | en fazla 12 benzersiz ifade |
| `allowedTools` | hayır | en fazla 16 benzersiz izin adı |
| `arguments` | hayır | en fazla 8 benzersiz argüman (`string` / `number` / `boolean`) |
| `model` | hayır | `^[a-z0-9][a-z0-9._/-]{1,79}$` |
| `executionContext` | hayır | `inline` (varsayılan) veya `fork` |

Doğrulama hataları `INVALID_SKILL_MANIFEST:<alan>` biçiminde fırlatılır ve normalize edilen skill dondurulur.

## Güvenlik sınırları

- **Yetki yükseltme yok.** Manifest yalnız istek listesi üretir; gerçek karar `authorizeSkillForAgent()` içinde
  mevcut ajan policy'si (`authorizeAgentTool`) tarafından verilir. Ajanın izinli olmadığı tek bir araç bile
  skill'i tamamen reddettirir (`tool_denied:<araç>:<neden>`).
- **Onay gerektiren araçlar önceden yetkilendirilemez.** `external.write`, `external.send`, `repo.merge` ve
  `repo.write_branch` manifest içinde `allowedTools` olarak yazılamaz; bunlar yalnız çalışma anındaki açık
  kullanıcı onayı akışından geçebilir.
- **Asla verilmeyen araçlar.** `secret.read` ve `repo.delete` manifest seviyesinde reddedilir.
- **Secret hijyeni.** Prompt içinde `process.env`, `${...}` interpolasyonu, private key başlığı, `api_key:` /
  `access_token:` / `client_secret:` benzeri atamalar ve bilinen token önekleri (`sk-`, `ghp_`, …) reddedilir.
- **Project izolasyonu.** `source: 'project'` manifestleri yalnız `allowedProjectScopes` içinde açıkça izin
  verilen kapsamdan yüklenebilir; araç kullanan project skill'i yalnız `fork` execution context ile tanımlanabilir.
- **`bypass` modu yoktur.** Backend default-deny modeli korunur.

## Kaynak önceliği

`createSkillRegistry({ entries, allowedProjectScopes })` aynı ada sahip skill'lerde **builtin > user > project**
önceliğini uygular. Kaybeden kayıt silinmez, `registry.shadowed` içinde `{ name, source, shadowedBy }` olarak
raporlanır. Aynı kaynak ve kapsamda ad tekrarı hata verir (`INVALID_SKILL_MANIFEST:duplicate:...`).

Registry API: `list()` (ada göre sıralı normalize skill'ler), `get(name)`, `describe()` (prompt içermeyen
kullanıcıya gösterilebilir özet), `shadowed`.

## Test

`node scripts/test-skills-manifest.mjs` — şema sertliği, secret reddi, project kapsam kontrolü, kaynak önceliği
ve ajan yetkilendirme kararları kapsanır. `npm run check` bu testi çalıştırır.

## Geri alma

`lib/skills-manifest.mjs`, `scripts/test-skills-manifest.mjs`, bu doküman ve `package.json` içindeki iki
`check` girdisi kaldırılır; başka modül bu dosyalara bağlı değildir.
