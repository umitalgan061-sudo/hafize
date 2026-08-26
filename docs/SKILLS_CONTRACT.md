# Hafize Skills Sözleşmesi

`lib/skill-manifest.mjs` ve `lib/skill-registry.mjs` katmanının güvenlik ve davranış sözleşmesi. `docs/CLAUDE_RESEARCH_INTEGRATION.md` uygulama sırasındaki 2. maddenin karşılığıdır. Bir skill; ad, açıklama, tetikleyici, izinli araçlar, argümanlar, model tercihi ve execution context'i ayrı ayrı doğrulanan **veri** paketidir; talimat veya yetki kaynağı değildir.

## Manifest alanları
| Alan | Zorunlu | Kural |
| --- | --- | --- |
| `schemaVersion` | evet | Yalnız `1`. |
| `id` | evet | `^[a-z][a-z0-9-]{1,63}$`. |
| `name` / `description` | evet | ≤ 80 / ≤ 500 karakter. |
| `prompt` | evet | ≤ 20.000 karakter; credential benzeri içerik reddedilir. |
| `source` / `execution` | source evet | `builtin` \| `user` \| `project` — `inline` (varsayılan) \| `fork`. |
| `triggers` / `arguments` | hayır | ≤ 12 tetikleyici (≤ 120 karakter, tekrarsız); ≤ 8 argüman (`string` \| `number` \| `boolean`). |
| `allowedTools` | hayır | ≤ 16 izin; yasak ve onay gerektiren izinler reddedilir. |
| `model` | hayır | Yalnız model adı biçimi; sağlayıcı seçimi backend'de kalır. |
| `projectScope` | project ise | Yalnız açıkça izin verilen kapsam listesinden. |

Doğrulama başarısız olursa skill sessizce atlanmaz; `INVALID_SKILL_MANIFEST:<alan>` ile registry hiç kurulmaz.

## Yetki sınırı
- Skill kendi tool yetkisini yükseltemez: efektif set daima `skill.allowedTools ∩ ajanın izinli araçları`; düşenler `droppedTools` içinde gerekçesiyle görünür.
- `secret.read`, `repo.delete`, `repo.merge` manifest düzeyinde tamamen yasaktır.
- `external.write`, `external.send`, `repo.write_branch` bir manifestte talep edilemez; bu izinler yalnız ajan politikasındaki açık kullanıcı onayı yoluyla verilir.
- `fork` execution yalnız `agent.delegate` yetkisi olan ajanda açılır; aksi halde `SKILL_FORK_NOT_AUTHORIZED`.
- Skill prompt'u `buildSkillUserMessage` ile **user-level** mesaj olarak taşınır, system yetkisi kazanmaz; `publicSkillView` prompt ve ham izin listesini istemciye açmaz.

## Kaynak önceliği
Güven sırası `builtin` > `user` > `project`. Aynı `id` farklı kaynaklardan gelirse yüksek güvenli kaynak kazanır ve gölgelenen kayıt `registry.shadowed` içinde raporlanır. Aynı kaynaktan aynı `id` iki kez gelirse bu yapılandırma hatasıdır. Project skill'leri yalnız `allowedProjectScopes` içindeki kapsamdan yüklenir.

## Credential hijyeni ve test
`containsCredentialLike` private key blokları, `sk-`/`nvapi-`/`ghp_` benzeri token biçimleri, AWS anahtar kimlikleri, `client_secret`/`api_key`/`password` atamaları ve uzun `Bearer` değerlerini yakalar; `prompt` veya `description` alanında bulunursa manifest reddedilir.

Doğrulama: `node scripts/test-skill-manifest.mjs` ve `node scripts/test-skill-registry.mjs`; ikisi de `npm run check` içinde çalışır.

Bu tur yalnız sözleşme ve registry katmanını ekler. Skill'in sohbet akışında seçilmesi, HTTP yüzeyi ve `fork` yürütmesinin `delegated-agent-runner` ile bağlanması ayrı turlarda ele alınacaktır.
