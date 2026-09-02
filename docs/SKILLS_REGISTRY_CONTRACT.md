# Skills manifest ve registry sözleşmesi

`lib/skill-manifest.mjs` tek bir skill manifestini strict doğrular; `lib/skill-registry.mjs` kaynakları önceliklendirir ve çalıştırma yetkisini ajan politikasıyla kesiştirir. Testler: `scripts/test-skill-manifest.mjs`, `scripts/test-skill-registry.mjs`.

## Manifest alanları
`name`, `description`, `triggers`, `tools`, `arguments`, `model`, `execution`, `prompt`. Bilinmeyen alan reddedilir (`INVALID_SKILL_FIELD`); `execution` yalnız `inline` veya `fork` olabilir ve varsayılan `inline`'dır.

## Güvenlik sınırları
- `source` yalnız yükleyici tarafından atanır; manifest kendi kaynağını (`builtin` gibi) iddia edemez.
- `tools` içinde `secret.read` ve `repo.delete` hiçbir kaynakta talep edilemez (`SKILL_TOOL_FORBIDDEN`).
- `prompt` credential taşıyamaz; `process.env`, `Bearer …`, `api_key:`, `sk-…` ve private key blokları reddedilir (`SKILL_PROMPT_SECRET`).
- Public listelemede (`listPublicSkills`) prompt asla yer almaz.

## Kaynak önceliği

İşleme sırası `builtin > user > project`; aynı ada sahip ikinci kayıt kazanmaz, `registry.shadowed` içine gözlemlenebilir kayıt olarak düşer. Böylece güvenilir builtin skill adı kullanıcı veya proje dosyasıyla gölgelenip taklit edilemez.

## Proje kapsamı

Proje skill'i yalnız `projectScope.allowed === true` ve `allowedPaths` ön eklerinden biriyle eşleşen `path` ile yüklenir. Mutlak yol ve `..` segmenti reddedilir (`INVALID_SKILL_PROJECT_PATH`, `SKILL_PROJECT_SCOPE_DENIED`).

## Çalıştırma yetkisi

`authorizeSkillExecution(skill, agent, { approvalGranted })` her skill aracını `authorizeAgentTool` ile doğrular. Ajan politikası bir aracı vermiyorsa skill sessizce daraltılmaz; çalıştırma `skill_tool_escalation` ile tamamen reddedilir ve reddedilen araçlar gerekçesiyle raporlanır. `approvalRequired` araçları yalnız açık kullanıcı onayıyla açılır; `deny` kalıcıdır. Skill böylece kendi tool yetkisini yükseltemez.
