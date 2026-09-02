# Hafize Skill Manifest ve Registry Sözleşmesi

`docs/CLAUDE_RESEARCH_INTEGRATION.md` uygulama sırasındaki 2. maddenin ilk katmanı: skill'lerin nasıl
tanımlandığı, hangi kaynaktan yüklendiği ve hangi yetkileri **kazanamayacağı**.

Modüller: `lib/skill-manifest.mjs` (strict manifest), `lib/skill-registry.mjs` (kaynak önceliği,
tetikleyici eşleşmesi, yetki kesişimi, prompt üretimi).

## Manifest alanları

| Alan | Zorunlu | Kural |
| --- | --- | --- |
| `id` | evet | `^[a-z][a-z0-9-]{2,63}$` |
| `name` / `description` | evet | ≤ 80 / ≤ 400 karakter |
| `execution` | evet | `inline` veya `fork` |
| `triggers` | evet | 1–10 adet, benzersiz, ≤ 60 karakter |
| `allowedTools` | hayır | ≤ 12 izin adı |
| `arguments` | hayır | ≤ 6 adet `{ name, description?, required? }` |
| `model` / `prompt` | hayır / evet | model kimliği / ≤ 8000 karakter |
| `projectScope` | yalnız `project` | izin verilen kapsam listesinde olmalı |

Bilinmeyen alan reddedilir (`manifest.field:<ad>`); manifest kendine tanımsız davranış ekleyemez.
`description`, `prompt` ve argüman açıklamaları credential/secret desenleri için taranır.

## Kaynak önceliği

Yükleme sırası `builtin > user > project`. Daha az güvenilen kaynak, daha güvenilen kaynaktaki `id`'yi
**gölgeleyemez**; çakışan kayıt yok sayılır ve `registry.shadowed` içinde raporlanır. `project`
kaynağındaki her skill, registry kurulumunda açıkça verilen `allowedProjectScopes` listesinde bulunan
bir `projectScope` bildirmek zorundadır.

## Yetki kuralları

- `secret.read` ve `repo.delete` hiçbir kaynaktan istenemez.
- `external.write`, `external.send`, `repo.merge`, `repo.write_branch` manifest ile verilemez; yalnız
  kullanıcı onayı akışıyla açılır.
- `authorizeSkill()` yalnız ajanın kendi allow listesindeki araçları verir; kesişim daima daraltır.
  Eksik araçta skill `tool_not_available` ile reddedilir (default-deny).
- `fork` yürütmesi `agent.delegate` yetkisi ister; aksi hâlde `fork_not_available`.
- `buildSkillInvocation()` skill metnini user-level mesaj yapar; başlık, içeriğin veri olduğunu ve yeni
  yetki/sistem talimatı vermediğini belirtir.

## Testler

`node scripts/test-skill-manifest.mjs`, `node scripts/test-skill-registry.mjs`; ikisi de `npm run check`
kapısındadır.

## Sonraki adım

Registry henüz `server.mjs` üzerinden servis edilmiyor; sonraki tur bu sözleşmeyi tool-runtime ve HTTP
katmanına bağlayacak.
