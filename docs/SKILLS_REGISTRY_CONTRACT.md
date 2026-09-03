# Skills manifest ve registry sözleşmesi

`docs/CLAUDE_RESEARCH_INTEGRATION.md` uygulama sırasındaki 2. adımın ilk katmanıdır: strict manifest doğrulaması, kaynak önceliği ve `inline` / `fork` yürütme ayrımı.

Modüller:

- `lib/skill-manifest.mjs` — tek bir skill manifestini doğrular ve dondurulmuş bir nesneye çevirir.
- `lib/skill-registry.mjs` — manifest kümesini registry'ye çevirir, ajan politikasıyla çözer ve çağrı mesajını üretir.

Bu tur yalnız sözleşme katmanını ekler; HTTP yüzeyi ve skill yükleyicisi sonraki turlara bırakılmıştır.

## Manifest alanları

Zorunlu: `name` (`^[a-z][a-z0-9-]{1,63}$`), `description` (≤400 karakter), `source` (`builtin` | `user` | `project`), `prompt` (≤20.000 karakter).

İsteğe bağlı: `execution` (varsayılan `inline`, diğer değer `fork`), `triggers` (≤12, küçük harfe indirilir, tekrarsız), `allowedTools` (≤16 izin adı, tekrarsız), `arguments` (`{ name, required?, description? }`, ≤8 adet), `model` (`nvidia/...` gibi model tercihi). `projectScope` yalnız `source: "project"` için zorunludur, diğer kaynaklarda kullanılamaz.

Bilinmeyen üst alan veya bilinmeyen argüman alanı doğrudan reddedilir (`INVALID_SKILL_MANIFEST_FIELD`, `INVALID_SKILL_ARGUMENT_FIELD`).

## Güvenlik sınırları

- **Yetki yükseltmesi yok.** `secret.read` ve `repo.delete` manifest içinde istenemez (`SKILL_TOOL_FORBIDDEN`). Çözüm aşamasında skill'in araçları `authorizeAgentTool` ile ajan politikasının kesişimine indirilir; engellenen araçlar `blockedTools` içinde gerekçesiyle raporlanır. Skill hiçbir zaman ajandan daha geniş yetki alamaz.
- **Onay gerektiren araçlar onaysız açılmaz.** `external.write` gibi izinler ancak `approvalGranted: true` ile etkin araç listesine girer.
- **Credential taşınmaz.** `token`, `apiKey`, `password`, `sessionId` gibi argüman adları reddedilir; prompt içinde `process.env` veya `{{secret...}}` gibi kaynaklar reddedilir (`SKILL_PROMPT_SECRET_FORBIDDEN`).
- **Prompt user düzeyinde kalır.** `buildSkillInvocation` her zaman `role: "user"` mesajı üretir; skill metni sistem talimatı veya yeni araç yetkisi kazanmaz. Bu, context compaction özetiyle aynı yaklaşımdır.
- **Project skill dar kapsamlıdır.** `source: "project"` manifest yalnız `allowedProjectScopes` içinde açıkça listelenen kapsamdan yüklenir (`SKILL_PROJECT_SCOPE_NOT_ALLOWED`).
- **Fork yürütmesi delegasyon yetkisine bağlıdır.** `execution: "fork"` yalnız `agent.delegate` yetkisi olan ajanda çözülür (`SKILL_FORK_NOT_AUTHORIZED`), ve `inheritsParentTools` her zaman `false` döner: alt yürütme parent araçlarını sessizce miras almaz.

## Kaynak önceliği

`builtin` > `user` > `project`. Aynı ada sahip birden çok manifest geldiğinde en yüksek öncelikli kaynak seçilir; elenenler `registry.shadowed` içinde raporlanır. Böylece bir proje manifesti builtin bir skill adını ele geçiremez. Aynı ad + aynı kaynak çifti tekrarlanırsa `DUPLICATE_SKILL` hatası verilir.

## Test

- `node scripts/test-skill-manifest.mjs`
- `node scripts/test-skill-registry.mjs`

İkisi de `npm run check` içine bağlanmıştır.
