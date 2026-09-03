# Skill manifest sözleşmesi

`lib/skill-manifest.mjs`, Claude-benzeri skill katmanının ilk güvenlik sınırıdır: bir skill tanımı
kullanılmadan önce **strict** doğrulamadan geçer. Doğrulanmamış manifest hiçbir yerde çalıştırılmaz.

## Kaynak önceliği

| Kaynak | `precedence` | Anlamı |
| --- | --- | --- |
| `builtin` | 3 | Depoyla gelen, gözden geçirilmiş skill'ler |
| `user` | 2 | Kullanıcının kendi tanımladığı skill'ler |
| `project` | 1 | Proje kapsamından yüklenen skill'ler (en az güvenilen) |

Aynı ada sahip iki skill çakıştığında yüksek `precedence` kazanır; yani daha az güvenilen bir proje
skill'i, builtin bir skill'i gölgeleyemez.

`project` kaynaklı manifest yalnızca çağıran taraf `projectScopeAllowed: true` verdiğinde kabul edilir;
aksi hâlde `SKILL_PROJECT_SCOPE_NOT_ALLOWED` hatası atılır.

## Manifest alanları

| Alan | Zorunlu | Kural |
| --- | --- | --- |
| `name` | evet | `^[a-z][a-z0-9-]{1,63}$` |
| `description` | evet | tek satır, ≤ 400 karakter |
| `triggers` | hayır | ≤ 12 tekil tetikleyici, küçük harfe normalize edilir |
| `allowedTools` | hayır | ≤ 16 izin adı, tekil |
| `approvalRequiredTools` | hayır | ≤ 16 izin adı, `allowedTools` ile kesişemez |
| `arguments` | hayır | ≤ 8 argüman; `name`, `type` (`string`/`number`/`boolean`), `required`, `description` |
| `model` | hayır | `^[a-z0-9][a-z0-9._/-]{0,119}$` |
| `execution` | evet | `inline` veya `fork` |
| `prompt` | evet | ≤ 20.000 karakter |

Bilinmeyen üst düzey alan (`INVALID_SKILL_FIELD`) veya bilinmeyen argüman alanı
(`INVALID_SKILL_ARGUMENT_FIELD`) sessizce atılmaz, reddedilir. Sonuç nesnesi ve iç dizileri donmuş
(`Object.freeze`) döner.

## Güvenlik sınırları

- **Yetki yükseltme yok:** `secret.read` ve `repo.delete` hiçbir listede yer alamaz
  (`SKILL_FORBIDDEN_TOOL`). `external.write`, `external.send`, `repo.merge`, `repo.write_branch`
  yalnızca `approvalRequiredTools` içinde bulunabilir (`SKILL_APPROVAL_REQUIRED_TOOL`); bir skill bu
  izinleri kendi başına allowlist'e alamaz.
- **Manifest izin vermez, izin talep eder:** manifest yalnızca skill'in isteyebileceği üst sınırı
  tanımlar. Gerçek karar backend'in default-deny agent policy'sindedir; kesişim bir sonraki registry
  katmanında uygulanır.
- **Prompt credential taşıyamaz:** `process.env`, `sk-…`, `nvapi-…`, `ghp_…`, private key blokları ve
  `api_key:` / `client-secret=` gibi kalıplar `SKILL_PROMPT_CREDENTIAL_FORBIDDEN` ile reddedilir.
- **inline / fork ayrımı:** `inline` skill çağıran ajanın bağlamında çalışır; `fork` ayrı bir alt görev
  olarak çalışır. Bu ayrım manifestte açıkça belirtilir, çalışma anında tahmin edilmez.

## Test

`node scripts/test-skill-manifest.mjs` — geçerli manifest normalizasyonu, kaynak önceliği, proje
kapsamı reddi, strict alan kontrolü, yetki yükseltme reddi ve prompt credential taraması.

## Geri alma

`lib/skill-manifest.mjs` ve `scripts/test-skill-manifest.mjs` bağımsız modüllerdir; kaldırılmaları
mevcut sohbet, ajan, zamanlama ve connector davranışlarını etkilemez.
