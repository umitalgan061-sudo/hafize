# Skill manifest sözleşmesi

`lib/skill-manifest-contract.mjs`, Hafize skill katmanının ilk güvenlik sınırıdır. Bir skill manifesti çalıştırılmadan önce burada strict biçimde doğrulanır; doğrulanmamış manifest runtime'a geçmez.

## Neden

Skill'ler kullanıcı veya proje tarafından yazılabilen prompt paketleridir. Manifest serbest bırakılırsa skill kendi araç yetkisini genişletebilir, gizli anahtar taşıyabilir veya proje deposundan gelen içerikle sistem yetkisi kazanabilir. Bu katman bunların hepsini yükleme anında reddeder.

## Alanlar

| Alan | Zorunlu | Kural |
| --- | --- | --- |
| `id` | evet | `^[a-z][a-z0-9-]{1,63}$` |
| `name` | evet | tek satır, ≤ 80 karakter |
| `description` | evet | tek satır, ≤ 400 karakter |
| `triggers` | hayır | ≤ 12 tetikleyici, tek satır, küçük harfe normalize edilir, tekrar yasak |
| `allowedTools` | hayır | ≤ 16 izin adı, tekrar yasak |
| `arguments` | hayır | ≤ 8 argüman; `name` / `description` / `required` dışında alan yok |
| `model` | hayır | dar model kimliği deseni; serbest metin değil |
| `execution` | hayır | `inline` (varsayılan) veya `fork` |
| `prompt` | evet | ≤ 20.000 karakter, secret deseni içeremez |

Bilinmeyen üst düzey alan `INVALID_SKILL_MANIFEST_FIELD` ile reddedilir. Manifest kendi `source` değerini taşıyamaz; kaynak yükleyici tarafından dışarıdan verilir.

## Kaynak önceliği

Kaynak `builtin`, `user` veya `project` olabilir ve güven sırası aynı yöndedir:

- `builtin`: depo ile gelen, incelenmiş skill'ler.
- `user`: sahibin kendi yazdığı skill'ler.
- `project`: yalnızca `projectScopeAllowed: true` ile, açıkça izin verilmiş proje kapsamından yüklenir. İzin yoksa `SKILL_PROJECT_SCOPE_NOT_ALLOWED`.

## Güvenlik sınırları

- **Yetki yükseltme yok.** `secret.read`, `repo.delete`, `repo.merge`, `external.write` ve `external.send` manifestte hiç istenemez (`SKILL_TOOL_ESCALATION_NOT_ALLOWED`).
- **Ajan policy'si üsttedir.** `resolveSkillTools(manifest, agentAllowedTools)` skill'in istediği araçları ajanın gerçekten sahip olduğu yetkilerle kesiştirir; kesişim dışındakiler `rejected` olarak döner ve verilmez. Skill, onay gerektiren bir aracı bu yoldan otomatik onaylatamaz.
- **Prompt'ta secret yok.** `process.env`, `${...API_KEY}`, `CLIENT_SECRET=`, `Bearer <token>`, `sk-...` ve PEM private key desenleri `SKILL_PROMPT_SECRET_NOT_ALLOWED` ile reddedilir.
- **`fork` yalnız güvenilen kaynakta.** Ayrı bağlamda tam tur çalıştıran `fork` yürütmesi proje kaynağına kapalıdır (`SKILL_FORK_EXECUTION_NOT_ALLOWED`); proje skill'i yalnız `inline` çalışır.
- Dönen manifest ve iç dizileri `Object.freeze` ile dondurulur; çağıran taraf sonradan yetki ekleyemez.

## Test

`node scripts/test-skill-manifest-contract.mjs` — geçerli manifest normalizasyonu, varsayılanlar, strict alan reddi, kaynak/kapsam kuralları, tetikleyici ve argüman sınırları, yetki yükseltme reddi, secret prompt reddi ve araç kesişimi kapsanır. `npm run check` içine bağlıdır.

## Geri alma

Katman bağımsızdır: `lib/skill-manifest-contract.mjs` ile `scripts/test-skill-manifest-contract.mjs` dosyalarını silmek ve `package.json` içindeki iki `check` adımını çıkarmak mevcut davranışın hiçbirini etkilemeden değişikliği geri alır.

## Sıradaki adım

Manifest sözleşmesinin üstüne skill registry (kaynak birleştirme, çakışma çözümü, arama) ve `inline` / `fork` yürütme runtime'ı gelir. Registry, manifesti doğrulanmamış hiçbir skill'i listelemez.
