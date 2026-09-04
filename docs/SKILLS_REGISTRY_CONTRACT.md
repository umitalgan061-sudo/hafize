# Skills manifest ve registry sözleşmesi

`docs/CLAUDE_RESEARCH_INTEGRATION.md` uygulama sırasının 2. maddesidir. Şu an **saf sözleşme katmanıdır**: production tool catalog'a `skill_run` kaydı eklemez, dosya sistemi taraması yapmaz ve kendi başına model çağırmaz. Testler: `scripts/test-skill-manifest.mjs` ve `scripts/test-skill-registry.mjs`, ikisi de `npm run check` gate'inde koşar.

## Manifest doğrulaması (`lib/skill-manifest.mjs`)

`normalizeSkillManifest(input, { source })` strict çalışır:

- `source` yalnız `builtin`, `user` veya `project` olabilir; manifest kendi kaynağını beyan edemez.
- Bilinmeyen üst alanlar reddedilir; manifest `toolPolicy`, `approvalGranted` veya owner kimliği enjekte edemez.
- `name` `^[a-z][a-z0-9-]{1,63}$`, `description` tek satır ve en fazla 300 karakter.
- `execution` yalnız `inline` veya `fork`; `arguments` en fazla 8 tekil giriş (`string`/`number`/`boolean`).
- `allowedTools` permission adlarıdır; `secret.read` ve `repo.delete` manifest üzerinden istenemez.
- `prompt` credential taşıyamaz: `api_key:`, `client secret =`, `Authorization: Bearer` ve `-----BEGIN ... PRIVATE KEY` kalıpları reddedilir.
- `projectScope` yalnız project kaynaklı skill'de zorunlu, diğer kaynaklarda yasaktır.

## Registry (`lib/skill-registry.mjs`)

`createSkillRegistry({ builtin, user, project, allowedProjectScopes })`:

- Kaynak önceliği `builtin > user > project`. Düşük öncelikli kaynak var olan bir skill adını **gölgeleyemez**; girdi `SKILL_NAME_SHADOWED` ile reddedilir.
- Project skill yalnız `allowedProjectScopes` içinde açıkça izin verilen kapsamla yüklenir; kapsam listesi verilmezse hiçbir project skill yüklenmez.
- Geçersiz tek bir manifest registry'yi düşürmez; `rejected()` içinde `{ source, name, error }` olarak görünür ve sessizce yutulmaz.
- En fazla 100 skill yüklenir; fazlası `SKILL_LIMIT_EXCEEDED` olarak raporlanır.
- `list()` yalnız ad, kaynak, açıklama, tetikleyici, execution ve model döndürür; skill prompt'u listelemede sızmaz.

## Execution çözümü

`resolveSkillExecution(registry, { name, agent })` skill yetkisini ajan policy'siyle kesişime indirir:

- Araçlar `authorizeAgentTool` üzerinden değerlendirilir; skill ajanın sahip olmadığı yetkiyi kazanamaz.
- Onay gerektiren araçlar `tools` içine girmez, ayrı `approvalRequiredTools` listesinde raporlanır; skill kendi onayını üretemez.
- Reddedilenler `deniedTools` olarak görünür, sessizce kırpılmaz.
- `fork` execution yalnız `agent.delegate` yetkisi olan ajanda çalışır; aksi halde `SKILL_FORK_NOT_AUTHORIZED`.

## Production'a açılma koşulu

Skill yükleyici gerçek dosya/veritabanı kaynağına bağlanmadan önce kaynak dosya boyut sınırı, owner-scoped user skill izolasyonu, project skill kapsamının backend tarafından belirlenmesi ve skill çağrısının trace/ledger'a yazılması tamamlanmalıdır.
