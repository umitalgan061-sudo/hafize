# Skills manifest sözleşmesi

`docs/CLAUDE_RESEARCH_INTEGRATION.md` uygulama sırasındaki 2. adımın ilk parçasıdır: strict skill manifest doğrulaması. Bu katman `lib/skills-manifest.mjs` içinde saf bir doğrulayıcıdır; **skill yüklemez, dosya sistemine dokunmaz, model veya tool çağırmaz ve server'a yeni endpoint eklemez.**

## Alan sözleşmesi

Manifest yalnız şu alanları taşıyabilir; bilinmeyen her alan `INVALID_SKILL_FIELD` ile reddedilir:

| Alan | Zorunlu | Kural |
| --- | --- | --- |
| `id` | evet | `^[a-z][a-z0-9-]{1,63}$` |
| `name` | evet | 1–80 karakter, kontrol karakteri yok |
| `description` | evet | 1–400 karakter, tek satır |
| `triggers` | evet | 1–12 adet, 2–60 karakter, küçük harfe indirgenir, tekilleştirilir |
| `allowedTools` | evet | 0–16 permission adı, tekil |
| `arguments` | hayır | En fazla 8 adet `{ name, type, required, description? }` |
| `model` | hayır | Sağlayıcı bağımsız model kimliği, en fazla 100 karakter |
| `execution` | hayır | `inline` (varsayılan) veya `fork` |
| `prompt` | evet | 1–20.000 karakter, çok satırlı olabilir |
| `projectScope` | yalnız `project` | İzin verilen kapsam listesinde bulunmalı |

Kaynak (`builtin` / `user` / `project`) manifest içinden değil, çağıran tarafından `options.source` ile verilir; böylece bir manifest kendi kaynak önceliğini yükseltemez.

## Güvenlik sınırları

- **Yetki yükseltme yok.** `allowedTools`, çağıran agent'ın hâlihazırda sahip olduğu `agentAllowedTools` kümesinin alt kümesi olmak zorundadır; aksi hâlde `SKILL_TOOL_ESCALATION`.
- **Asla verilmeyen araçlar.** `secret.read` ve `repo.delete` ile onay gerektiren `external.write`, `external.send`, `repo.merge`, `repo.write_branch` izinleri agent'a verilmiş olsa bile skill manifestinde önceden tanımlanamaz (`SKILL_TOOL_FORBIDDEN`). Bu işlemler ancak çalışma anındaki açık kullanıcı onayıyla yürür.
- **Secret sızıntısı yok.** `prompt`, `description` ve argüman açıklamaları private key blokları, `process.env` erişimi, `*_API_KEY` / `*_SECRET` / `*_TOKEN` gibi ortam değişkeni adları, `Authorization: Bearer …` başlıkları ve bilinen token önekleri (`ghp_`, `sk-`, `nvapi-`, `xox…`, `AKIA…`) için taranır; eşleşme `SKILL_SECRET_FORBIDDEN` verir.
- **Dar project kapsamı.** `project` kaynaklı skill yalnız çağıranın açıkça listelediği `allowedProjectScopes` değerlerinden yüklenebilir; `..` içeren kapsam ve `builtin`/`user` skill'inde `projectScope` kullanımı reddedilir.
- Doğrulanmış sonuç derin şekilde `Object.freeze` edilir; böylece downstream kod manifesti çalışma anında değiştiremez.

## Execution ayrımı

- `inline`: skill mevcut konuşma turunda, aynı agent bağlamında çalışacak şekilde işaretlenir.
- `fork`: skill ayrı alt görev olarak çalışacak şekilde işaretlenir ve mevcut delegation/trace kuralları geçerlidir.

Bu sürüm yalnız ayrımı sözleşmeye bağlar; yürütme motoru bir sonraki adımda registry ve kaynak önceliği ile birlikte gelir.

## Test

`node scripts/test-skills-manifest.mjs` — geçerli manifest normalizasyonu, varsayılanlar, strict alan reddi, tetikleyici/argüman/model/execution doğrulaması, tool yükseltme reddi, secret taraması ve project kapsam kuralları.

## Geri alma

`lib/skills-manifest.mjs`, `scripts/test-skills-manifest.mjs`, bu doküman ve `package.json` içindeki iki `check` girdisi kaldırıldığında davranış tamamen eski hâline döner; başka modül bu dosyaya bağımlı değildir.
