# Hafize Skill Manifest Sözleşmesi

`docs/CLAUDE_RESEARCH_INTEGRATION.md` uygulama sırasının 2. maddesi (strict skills manifest + registry + inline/fork execution) bu dosyada tanımlanır. Bu tur yalnız **manifest doğrulama katmanını** getirir; registry birleştirme ve çalışma zamanı yetkilendirmesi sonraki tura bırakılmıştır (tur satır bütçesi).

Kod: `lib/skill-manifest.mjs` — Test: `scripts/test-skill-manifest.mjs`.

## Manifest alanları

| Alan | Zorunlu | Kural |
| --- | --- | --- |
| `name` | evet | `^[a-z][a-z0-9-]{1,63}$` |
| `description` | evet | 1–500 karakter |
| `triggers` | evet | 1–12 tekil tetikleyici, küçük harfe indirgenir |
| `allowedTools` | hayır | en fazla 12 permission adı, varsayılan boş |
| `arguments` | hayır | en fazla 8 adet `{ name, type: string\|number\|boolean, required, description }` |
| `model` | hayır | model kimliği biçimi |
| `execution` | hayır | `inline` (varsayılan) veya `fork` |
| `executionAgentId` | `fork` ise evet | hedef specialist ajan kimliği; `inline` manifestte bulunamaz |
| `prompt` | evet | 1–8000 karakter |
| `projectScope` | `project` kaynağında evet | `allowedProjectScopes` içinde açıkça izin verilen kapsam |

`normalizeSkillManifest(input, { source, allowedProjectScopes })` **strict** doğrular: tanınmayan alan `INVALID_SKILL:unknownField:<alan>` ile reddedilir, sonuç `Object.freeze` ile dondurulur ve hata mesajları upstream detay sızdırmaz.

## Güvenlik sınırları

- **Yetki yükseltme yok.** `secret.read`, `repo.delete` ve onay gerektiren `external.write`, `external.send`, `repo.merge`, `repo.write_branch` izinleri manifest içinde hiç kabul edilmez. Backend default-deny modeli korunur; manifest yalnız daraltabilir.
- **Credential yok.** `prompt` ve `description`, credential kalıplarına (API key, `sk-` / `gh*_` / `xox*` token, bearer token, private key, `process.env.*`) karşı taranır; eşleşme `INVALID_SKILL:credentialInPrompt` ile reddedilir.
- **Project skill dar kapsamlıdır.** `project` kaynağındaki manifest yalnız açıkça izin verilen proje kapsamıyla yüklenir; `builtin`/`user` manifest `projectScope` taşıyamaz.
- **Fork açıkça beyan edilir.** `fork` execution hedef ajanı manifestte adlandırmak zorundadır; kaynak öncelik değeri (`builtin < user < project`) kayıtla birlikte taşınır.

## Sonraki tur

`lib/skill-registry.mjs` şunları ekleyecek: kaynak öncelikli birleştirme (aynı isim tek kayda düşer, gölgelenen manifest `rejected` listesinde gözlemlenebilir kalır), tetikleyici eşleşmesi, `authorizeAgentTool` ile aktif ajan policy'sine göre araç kesişimi (`tool_escalation` reddi), `fork` için `agent.delegate` şartı, argüman doğrulaması ve skill prompt'unu `system` değil `user` rolünde taşıyan mesaj üretimi.

## Geri alma

`lib/skill-manifest.mjs`, `scripts/test-skill-manifest.mjs` ve bu doküman silinir; `package.json` içindeki üç `check` adımı geri alınır. Mevcut agent/tool runtime davranışı değişmediği için başka bağımlılık yoktur.
