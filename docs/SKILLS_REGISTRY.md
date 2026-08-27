# Skills manifest ve registry sözleşmesi

`lib/skill-manifest.mjs` ve `lib/skill-registry.mjs`, Claude araştırma planındaki (bkz. `docs/CLAUDE_RESEARCH_INTEGRATION.md`) ikinci adımı uygular: strict skill manifest doğrulaması, kaynak önceliği ve `inline` / `fork` execution ayrımı.

## Manifest kuralları

- Manifest strict'tir: bilinmeyen alan `INVALID_SKILL_MANIFEST:unknownKey:*` ile reddedilir.
- Zorunlu alanlar: `id`, `name`, `description`, `prompt`. `version` varsayılanı `1.0.0`, `execution` varsayılanı `inline`.
- `triggers` küçük harfe normalize edilir, tekrar eden tetikleyici reddedilir (en fazla 12 adet).
- `model` yalnızca bir tercihtir; sağlayıcı seçimi ve yetkilendirme backend'de kalır.
- `arguments` tipleri `string` / `number` / `boolean` ile sınırlıdır.

## Güvenlik sınırları

- Skill kendi yetkisini yükseltemez: `allowedTools` içinde `secret.read`, `repo.delete` ve onay gerektiren `external.write`, `external.send`, `repo.merge`, `repo.write_branch` izinleri manifest aşamasında reddedilir.
- Skill prompt'u ve açıklaması secret/credential taşıyamaz; API key, bearer token, private key, `process.env` ve `${ENV_VAR}` kalıpları `prompt.secret` / `description.secret` hatası üretir.
- `resolve()` her skill aracını çağıran ajanın policy'siyle yeniden doğrular; ajan izin vermiyorsa `SKILL_TOOL_NOT_AUTHORIZED` döner. Registry hiçbir zaman yeni yetki üretmez.
- `fork` execution ayrı bir alt bağlam demektir ve yalnızca `agent.delegate` yetkisi olan ajanlarda çalışır (`SKILL_FORK_NOT_AUTHORIZED`).
- Project skill'leri yalnızca `projectScopeAllowed: true` ile açıkça izin verildiğinde yüklenir; aksi halde `project_scope_not_allowed` nedeniyle atlanır.

## Kaynak önceliği

Öncelik `builtin` > `user` > `project` şeklindedir. Böylece bir user veya project manifesti aynı `id` ile builtin bir skill'i gölgeleyemez; gölgelenen kayıt `skipped()` listesinde `shadowed_by_higher_precedence` nedeniyle görünür. Geçersiz manifestler kayıt yüklemesini durdurmaz, `skipped()` içinde nedeniyle raporlanır.

## Test

`node scripts/test-skill-manifest.mjs` ve `node scripts/test-skill-registry.mjs`; ikisi de `npm run check` zincirine bağlıdır.

## Geri alma

`lib/skill-manifest.mjs`, `lib/skill-registry.mjs`, iki test dosyası ve `package.json` içindeki check girdileri kaldırılırsa davranış tamamen eski haline döner; bu katman henüz server üzerinde bir uç noktaya bağlanmamıştır.
