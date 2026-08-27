# Skills manifest ve registry sözleşmesi

`docs/CLAUDE_RESEARCH_INTEGRATION.md` uygulama sırasındaki 2. madde: strict skill manifest doğrulaması, kaynak öncelikli registry ve `inline`/`fork` execution ayrımı.

- `lib/skill-manifest-contract.mjs` — tek bir manifesti strict doğrular, dondurulmuş normalize çıktı üretir.
- `lib/skill-registry.mjs` — normalize skill'leri kaynak önceliğiyle saklar ve ajan tool politikasıyla kesiştirerek çözer.

## Manifest alanları

| Alan | Zorunlu | Not |
| --- | --- | --- |
| `name` | evet | `[a-z][a-z0-9-]{1,63}`; küçük harfe normalize edilir. |
| `description` | evet | En fazla 500 karakter. |
| `triggers` | hayır | En fazla 12; büyük/küçük harf duyarsız tekrar reddedilir. |
| `allowedTools` | hayır | En fazla 16 permission; yetki değil **talep**. |
| `arguments` | hayır | En fazla 8; yalnız `name`, `description`, `required`. |
| `model` | hayır | Model tercihi; sağlayıcı seçimini backend yapar. |
| `execution` | hayır | `inline` (varsayılan) veya `fork`. |
| `prompt` | evet | En fazla 20.000 karakter. |

Bilinmeyen üst düzey alan `INVALID_SKILL_FIELD` ile reddedilir; manifest `toolPolicy`, `source` veya `approvalGranted` enjekte ederek yetki üretemez.

## Güvenlik sınırları

- **Kaynak dışarıdan verilir.** `source` manifest içinden değil, yükleyiciden gelir: `normalizeSkillManifest(input, { source })`.
- **Yetki yükseltmesi yok.** `resolveForAgent()` skill'in `allowedTools` listesini `authorizeAgentTool()` ile kesiştirir; ajanın vermediği her permission `deniedTools` içinde raporlanır ve çalıştırma listesine girmez. Sonuç kümesi skill'in talebinin üst kümesi olamaz.
- **Onay gerektiren izinler manifestte tanımlanamaz.** `external.write`, `external.send`, `repo.merge`, `repo.write_branch` → `SKILL_APPROVAL_PERMISSION_NOT_DECLARABLE`; bu izinler yalnız çalışma anındaki açık kullanıcı onayıyla ajan politikası üzerinden açılır.
- **Hiç verilmeyen izinler.** `secret.read` ve `repo.delete` → `SKILL_FORBIDDEN_PERMISSION`.
- **Secret hijyeni.** `prompt`, `description` ve argüman açıklamaları `process.env`, `${...TOKEN}`, `client_secret=...` ve private key başlığı kalıplarına karşı taranır → `SKILL_SECRET_MATERIAL`.
- **Proje kapsamı dar.** `project` kaynaklı skill yalnız registry kurulurken listelenen `allowedProjectScopes` içinden yüklenir → aksi halde `SKILL_PROJECT_SCOPE_NOT_ALLOWED`.
- **Gölgeleme yok.** Kaynak önceliği `builtin > user > project`. Düşük öncelikli kaynak var olan adı devralamaz (`SKILL_REGISTRY_SHADOWED`); aynı öncelikli tekrar `SKILL_REGISTRY_DUPLICATE`. Bir proje dosyası builtin skill davranışını sessizce değiştiremez.
- **Liste sızdırmaz.** `list()` yalnız `name`, `source`, `description`, `triggers`, `execution` döndürür; prompt ve izinler istemciye açılmaz.

## Execution ayrımı

- `inline`: skill prompt'u mevcut turda ek kullanıcı-seviyesi bağlam olarak çalışır, system yetkisi kazanmaz.
- `fork`: ayrı alt görev olarak işaretlenir; mevcut delegation sınırları (depth, fan-out, trace) geçerli kalır.

Bu tur yalnız sözleşme ve çözümleme katmanıdır; server wiring ve skill dosyalarının diskten yüklenmesi ayrı ve tek amaçlı sonraki adımdır.

Test: `node scripts/test-skill-manifest-contract.mjs` ve `node scripts/test-skill-registry.mjs` (ikisi de `npm run check` içinde).
