# Skill manifest sözleşmesi

`lib/skill-manifest.mjs` — `docs/CLAUDE_RESEARCH_INTEGRATION.md` uygulama
sırasındaki 2. maddenin ilk katmanı; yalnızca doğrulama ve önceliklendirme.

## Manifest alanları

Zorunlu: `name` (`^[a-z][a-z0-9-]{0,63}$`), `description` (≤512),
`prompt` (≤8192). Opsiyonel: `triggers` (≤32 benzersiz), `allowedTools`
(host kümesinin alt kümesi), `arguments` (`{ name, description, required }`,
≤16), `execution` (`inline` varsayılan veya `fork`), `model` (yalnız `fork`).
`project` kaynağında `scope` zorunludur ve izinli kapsamda olmalıdır.
Bilinmeyen üst düzey alan `INVALID_SKILL_MANIFEST_FIELD` ile reddedilir.

## Güvenlik sınırları

- **Yetki yükseltme yok.** Talep edilen her araç çağıranın verdiği kümede
  olmalıdır; aksi halde `SKILL_MANIFEST_TOOL_ESCALATION`.
- **Secret girmez.** Metinlerde credential kalıbı (`api_key=`, `token:`,
  `Bearer …`) görülürse `SKILL_MANIFEST_SECRET_REJECTED`.
- **Project kapsam kilidi.** `project` skill yalnız `allowedProjectScopes`
  içindeki kapsamdan yüklenir; `..` içeren kapsam reddedilir.
- **inline / fork ayrımı.** `inline` skill çağıranın turunda çalışır ve model
  bağlamını değiştiremez (`SKILL_MANIFEST_INLINE_MODEL_OVERRIDE`).
- **Kaynak önceliği `builtin > user > project`.** Proje deposu builtin veya
  kullanıcı skill adını gölgeleyip güven devralamaz; aynı kaynakta yinelenen
  ad `SKILL_REGISTRY_DUPLICATE_NAME` ile reddedilir.
- Dönen manifest ve registry `Object.freeze` ile donmuştur.

## Registry, test ve sıradaki adım

`buildSkillRegistry(manifests)` ada göre sıralı `skills`, `get(name)` ve
gölgeleme olaylarını gözlemlenebilir kılan `shadowed` listesini döner.

`scripts/test-skill-manifest.mjs` — `npm run check` içinde otomatik keşfedilir.
Sıradaki katman: manifest yükleyici ve `inline`/`fork` execution runtime'ı;
ikisi de bu sözleşmeyi tek doğrulama noktası olarak kullanır.
