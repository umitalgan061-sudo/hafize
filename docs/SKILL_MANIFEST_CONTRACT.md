# Skill manifest sözleşmesi

Bu katman Claude araştırma planındaki 2. maddenin (`strict skills manifest + registry + inline/fork execution contract`) ilk adımıdır. **Henüz registry, tool catalog kaydı veya skill çalıştıran bir araç eklemez**; yalnız bir skill manifest'inin güvenli normalize edilme sınırını tanımlar.

## Manifest alanları

`normalizeSkillManifest(input, { source })` yalnız şu alanları kabul eder; başka her alan `INVALID_SKILL_FIELD` ile reddedilir:

| Alan | Zorunlu | Not |
| --- | --- | --- |
| `name` | evet | `^[a-z][a-z0-9-]{1,47}$` |
| `description` | evet | en fazla 300 karakter |
| `prompt` | evet | en fazla 8000 karakter |
| `execution` | evet | `inline` veya `fork` |
| `triggers` | hayır | en fazla 12, küçük harfe indirgenir, tekrarsız |
| `allowedTools` | hayır | en fazla 12 permission adı |
| `arguments` | hayır | en fazla 8, `{ name, description?, required? }` |
| `model` | hayır | model tercihi, dar pattern |
| `projectScope` | yalnız project | başka kaynakta verilmesi hatadır |

`source` (`builtin` / `user` / `project`) yalnız çağıran backend tarafından verilir. Manifest kendi kaynağını, agent kimliğini, tool policy'sini veya onay durumunu **beyan edemez**.

## Yetki yükseltme yasağı

- `allowedTools` içinde `secret.read` ve `repo.delete` hiçbir zaman bulunamaz.
- `external.write`, `external.send`, `repo.merge` ve `repo.write_branch` manifest üzerinden verilemez; bunlar backend approval gate'ine aittir.
- `allowedTools` bir yetki **kaynağı değildir**; sonraki registry adımında yalnız agent policy'sinin zaten verdiği araçları daraltmak için kullanılacaktır.

## Credential hijyeni

`description`, `prompt` ve argüman açıklamaları credential taşıyamaz. `api_key=...`, `token: ...`, `Authorization: Bearer ...` ve PEM private key başlığı gibi atama biçimli kalıplar `SKILL_SECRET_REJECTED` ile reddedilir. Serbest metinde geçen "token" kelimesi tek başına engellenmez; yalnız değer ataması engellenir.

## Execution ayrımı

- `inline`: skill prompt'u mevcut turda çalışır; ek izin doğurmaz.
- `fork`: skill ayrı bir alt görevde çalıştırılmak üzere işaretlenir; alt görev de parent agent policy'sini aşamaz.

Her iki modda da skill metni kullanıcı seviyesinde talimattır; system yetkisi kazanmaz ve backend permission kararını değiştiremez.

## Sıradaki adım

Kaynak önceliği (`builtin > user > project`), ad gölgeleme kuralı, `allowedProjectScopes` ile project skill yüklemesi ve `authorizeAgentTool()` üzerine kurulu daraltıcı `authorizeSkillTool()` bir sonraki turda `lib/skill-registry.mjs` olarak eklenecektir. Bu tur, tur başına 500 satır diff bütçesi nedeniyle manifest sınırında durdurulmuştur.
