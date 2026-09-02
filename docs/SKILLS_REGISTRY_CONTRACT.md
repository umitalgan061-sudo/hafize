# Skills manifest ve registry sözleşmesi

`docs/CLAUDE_RESEARCH_INTEGRATION.md` uygulama sırasındaki 2. adımın ilk katmanı:
`lib/skill-manifest.mjs` (strict manifest) ve `lib/skill-registry.mjs` (kaynak
önceliği + inline/fork execution çözümü). Şimdilik saf sözleşme katmanıdır; HTTP
yüzeyi veya disk yükleyici henüz bağlanmamıştır.

## Manifest

İzinli alanlar: `id`, `name`, `description`, `triggers`, `allowedTools`,
`arguments`, `model`, `execution`, `prompt`. Başka alan reddedilir
(`INVALID_SKILL_FIELD`), böylece manifest gizli yetki alanı taşıyamaz.

- `allowedTools`: `secret.read` ve `repo.delete` yasaktır
  (`SKILL_FORBIDDEN_TOOL`); `external.write`, `external.send`, `repo.merge` ve
  `repo.write_branch` manifest'ten alınamaz (`SKILL_APPROVAL_ONLY_TOOL`) çünkü
  bunlar yalnız açık kullanıcı onayıyla verilir.
- `execution`: yalnız `inline` veya `fork` (varsayılan `inline`).
- `prompt`: private key, `ghp_`/`sk-`/`nvapi-` biçimli token veya
  `api_key: ...` benzeri atama içeriyorsa reddedilir
  (`SKILL_PROMPT_SECRET_SUSPECTED`).

## Kaynak önceliği

Kaynaklar `builtin`, `user`, `project`. `project` yalnız çağıran taraf açıkça
`projectScopeAllowed: true` verdiğinde yüklenir. Aynı `id` birden fazla kaynakta
varsa daha yüksek güvenli kaynak kazanır (`builtin > user > project`); gölgelenen
kayıt `registry.shadowed` içinde raporlanır, sessizce kaybolmaz. Aynı kaynakta
kimlik tekrarı hatadır (`SKILL_ID_DUPLICATE`).

## Execution çözümü

`resolveSkillExecution(registry, { skillId, agent, args, approvalGranted, forkAvailable })`:

- `fork` isteyen skill yalnız `forkAvailable: true` iken çalışır.
- `allowedTools` karar değil taleptir: her araç `authorizeAgentTool` ile agent
  policy'sine sorulur, izinsizler gerekçesiyle `deniedTools` içinde raporlanır.
  Skill kendi yetkisini yükseltemez.
- Argümanlar manifest'e göre doğrulanır (`UNKNOWN_SKILL_ARGUMENT`,
  `MISSING_SKILL_ARGUMENT`, `INVALID_SKILL_ARGUMENT_VALUE`).
- `promptMessage` her zaman `role: 'user'`'dır; skill prompt'u system yetkisi
  kazanmaz. `listPublicSkills` prompt ve araç talebini istemciye sızdırmaz.

Testler: `node scripts/test-skill-manifest.mjs`, `node scripts/test-skill-registry.mjs`
(ikisi de `npm run check` kapısında).
