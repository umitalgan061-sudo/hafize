# Skills manifest ve registry sözleşmesi

`docs/CLAUDE_RESEARCH_INTEGRATION.md` içindeki skills yaklaşımının Hafize uyarlaması. **Henüz production tool catalog'a `skill.run` kaydı eklemez ve kendi başına model veya ağ çağrısı yapmaz**; yalnız manifest doğrulaması, kaynak önceliği ve yetki sınırını tanımlar.

## Manifest alanları

`normalizeSkillManifest()` yalnız şu alanları kabul eder; tanınmayan alan `INVALID_SKILL_MANIFEST_FIELD` ile reddedilir.

- Zorunlu: `name` (`^[a-z][a-z0-9-]{0,63}$`), `description` (1–400 karakter), `triggers` (1–12 adet, küçük harfe normalize, tekrarsız), `execution` (`inline` | `fork`), `source` (`builtin` | `user` | `project`), `prompt` (1–20.000 karakter).
- Opsiyonel: `arguments` (en fazla 8; `string` / `number` / `boolean` ve boolean `required`), `allowedTools` (en fazla 16 permission adı), `model` (sağlayıcı bağımsız model kimliği).
- `project` yalnız `source: "project"` ile verilir ve küçük harfe normalize edilir.

## Güvenlik sınırları

- Skill kendi yetkisini yükseltemez: `secret.read`, `repo.delete`, `repo.merge`, `repo.write_branch`, `external.write` ve `external.send` manifest düzeyinde `SKILL_TOOL_ESCALATION_FORBIDDEN` ile reddedilir.
- Skill prompt'u credential taşıyamaz; private key, `sk-`, `gh*_`, `AKIA` ve `api_key=` benzeri kalıplar `SKILL_PROMPT_SECRET_FORBIDDEN` ile reddedilir.
- Project kaynaklı skill yalnız `createSkillRegistry(manifests, { allowedProjects })` ile açıkça izin verilen kapsamdan yüklenir; aksi halde `SKILL_PROJECT_NOT_ALLOWED`.
- `authorize(name, agent)` skill'in her aracını `authorizeAgentTool()` üzerinden doğrular. Approval gerektiren araç onay parametresi almadığı için skill üzerinden geçirilemez; tek bir yetkisiz araç tüm skill'i `SKILL_TOOL_NOT_AUTHORIZED` yapar.
- `prompt` yalnız `authorize()` sonucunda döner; `list()` ve `match()` yalnız keşif metadata'sı verir.

## Kaynak önceliği

Öncelik `project` > `user` > `builtin`; en özgül kaynak kazanır. Gölgelenen kayıtlar sessizce düşürülmez, `registry.shadowed` içinde `{ name, source, shadowedBy }` olarak görünür. Aynı kaynak içinde tekrar eden ad `DUPLICATE_SKILL_NAME` ile reddedilir.

## Sıradaki adım ve test

`fork` execution'ın delegation runtime'ına bağlanması, skill çağrılarının run ledger'a yazılması ve ancak bunlardan sonra tool catalog kaydı. Registry saf ve enjekte edilebilir olduğu için dosya sisteminden yükleme ayrı bir adapter turuna bırakıldı. Doğrulama: `node scripts/test-skill-manifest.mjs` ve `node scripts/test-skill-registry.mjs`, ikisi de `npm run check` içinde.
