# Skill manifest sözleşmesi

`docs/CLAUDE_RESEARCH_INTEGRATION.md` uygulama sırasında 2. madde olan strict skills katmanının ilk dilimi. Bu tur yalnız **doğrulama ve kayıt çözümlemesi** kapsar; skill yürütme (inline/fork çalıştırma, prompt birleştirme, server wiring) sonraki turlara bırakıldı.

## Modül

`lib/skill-manifest.mjs`

- `normalizeSkillManifest(manifest, { source, allowedProjectScopes })` — tek bir manifesti strict doğrular ve dondurulmuş normal biçimini döner.
- `buildSkillRegistry(entries, { allowedProjectScopes })` — `{ source, manifest }` girdilerinden id'ye göre tekilleştirilmiş, id'ye göre sıralı kayıt üretir.
- `resolveSkillForAgent(registry, skillId, agent, { approvalGranted })` — skill'i çağıran ajanın tool politikasına göre yetkilendirir.

## Alan sözleşmesi

Zorunlu: `id` (`^[a-z][a-z0-9-]{1,63}$`), `name` (≤80), `description` (≤400), `triggers` (≤12, tekrarsız, küçük harfe normalize; boş liste = yalnız açık çağrı), `execution` (`inline` veya `fork`), `prompt` (≤20.000).

Opsiyonel: `allowedTools` (≤12 tekrarsız izin), `arguments` (≤8 giriş; `name`/`required`/`description`), `model`, `scope` (yalnız `project` kaynağında zorunlu; diğer kaynaklarda verilmesi hatadır).

Bilinmeyen üst düzey alanlar, bilinmeyen argüman alanları ve tekrarlı değerler reddedilir.

## Güvenlik sınırları

- **Skill kendi yetkisini yükseltemez.** `secret.read`, `repo.delete`, `external.write`, `external.send`, `repo.merge` ve `repo.write_branch` manifestte istenemez; hangi kaynaktan gelirse gelsin manifest reddedilir.
- **Agent politikası son sözü söyler.** `resolveSkillForAgent`, skill'in istediği her izni `authorizeAgentTool` ile ajana karşı doğrular; ajanda olmayan izin `SKILL_TOOL_NOT_AUTHORIZED` ile reddedilir. Skill, parent yetkilerini otomatik miras almaz.
- **Prompt credential taşıyamaz.** PEM private key blokları, `api_key: …` / `client_secret = …` biçimli atamalar, `NVIDIA_API_KEY=…` gibi ortam değişkeni atamaları ve `nvapi-`, `ghp_`, `github_pat_`, `sk-…` önekli değerler manifesti reddettirir.
- **Project skill yalnız açıkça izin verilen kapsamdan yüklenir.** `allowedProjectScopes` listesinde olmayan bir `scope` reddedilir.

## Kaynak önceliği

`project` > `user` > `builtin`. Aynı `id` birden çok kaynaktan gelirse daha yüksek öncelikli kaynak kazanır; project kaynağı yukarıdaki scope kapısından geçmek zorunda olduğu için bu öncelik yetki genişletmesi anlamına gelmez.

## Test ve geri alma

`scripts/test-skill-manifest.mjs` alan sözleşmesini, altı yasak izni, beş credential desenini, project scope kapısını, kaynak önceliğini ve ajan yetkilendirmesini doğrular; `npm run check` kapısı bu testi keşifle çalıştırır.

Geri alma: `lib/skill-manifest.mjs` ve `scripts/test-skill-manifest.mjs` bağımsız dosyalardır ve henüz hiçbir çalışma zamanına bağlanmamıştır; silinmeleri mevcut davranışı etkilemez.
