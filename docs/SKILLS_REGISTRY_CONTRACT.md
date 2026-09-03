# Skills manifest ve registry sözleşmesi

`lib/skills-manifest.mjs` ve `lib/skills-registry.mjs`, Claude-benzeri skill yaklaşımını
Hafize'nin default-deny araç modelini bozmadan uygular.

## Manifest doğrulaması (strict)

`normalizeSkillManifest(input, { source })` yalnız şu alanları kabul eder: `name`, `description`,
`triggers`, `allowedTools`, `arguments`, `model`, `execution`, `prompt`. Bilinmeyen alan
`INVALID_SKILL_FIELD` ile reddedilir; `source` girdiden değil çağrı bağlamından gelir.

`name` 2–48 karakter kebab-case'tir; boşluk ve path traversal kabul edilmez. `description` ve
`triggers` kontrol karakteri içeremez, trigger'lar küçültülüp tekilleştirilir. `allowedTools`
yalnız biçim olarak doğrulanır: bu liste **talep**tir, yetki değildir. `arguments` en fazla 8 tekil
ad alır. `execution` yalnız `inline` veya `fork` olabilir (varsayılan `inline`); `bypass` benzeri
bir mod yoktur. `prompt` 1–8000 karakterdir ve credential taramasından geçer.

`prompt` veya `description` içinde private key, `Bearer <token>`, `sk-`/`nvapi-`/`ghp_` anahtarları,
`api_key: ...` kalıbı ya da `process.env.X` / `${...TOKEN}` referansı bulunursa manifest
`SKILL_PROMPT_SECRET_FORBIDDEN` ile reddedilir; skill metni secret taşıma kanalı olamaz.

## Kaynak güveni

Güven sırası `builtin > user > project`.

- `project` kaynağı yalnız `projectScopeAllowed: true` ile yüklenir; aksi hâlde
  `project_scope_not_allowed` gerekçesiyle `rejected` listesine yazılır.
- Düşük güvenli kaynak yüksek güvenli bir adı gölgeleyemez (`shadows_higher_trust_source`);
  aynı kaynakta ilk tanım kazanır.
- `project` kaynağı model seçemez ve `fork` yürütmesi açamaz: proje deposundan gelen içerik
  izole bir alt ajan başlatamaz.

## Yürütme sözleşmesi

`resolveSkillInvocation(registry, { skillName, agent, args, approvalGranted })` skill'in istediği
araçları `authorizeAgentTool` ile ajan politikasına göre kesişime indirir; izin verilmeyenler
`deniedTools` içinde gerekçesiyle görünür. `approvalRequired` araçlar yalnız açık onayla plana
girer, `deny` ve default-deny araçlar hiçbir koşulda girmez. Argümanlar yalnız manifest'te
tanımlıysa kabul edilir; dönen plan donmuştur.

`listSkillsForAgent` model tarafına prompt gövdesini değil yalnız ad, açıklama, tetikleyici,
argüman ve gerçekten kullanılabilir araç listesini verir. `buildSkillPromptMessage` skill içeriğini
`user` rolünde döndürür ve sistem talimatı olmadığını belirtir; skill metni system'e yükseltilmez.

Test: `node scripts/test-skills-manifest.mjs` ve `node scripts/test-skills-registry.mjs`
(ikisi de `npm run check` içinde çalışır).
