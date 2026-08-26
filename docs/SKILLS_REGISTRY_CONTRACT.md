# Skills manifest sözleşmesi

Bu belge `docs/CLAUDE_RESEARCH_INTEGRATION.md` uygulama sırasındaki 2. maddenin
ilk adımıdır: strict skill manifesti.

Bu turda uygulanan: `lib/skill-manifest.mjs`, test `scripts/test-skill-manifest.mjs`.
Sonraki tura bırakılan: kaynak öncelikli registry, trigger eşleşmesi ve
`inline` / `fork` execution yürütmesi (aşağıda sözleşmesi tanımlıdır).

## Manifest alanları

| Alan | Zorunlu | Kural |
| --- | --- | --- |
| `name` | evet | `^[a-z][a-z0-9-]{1,47}$`, küçük harfe normalize edilir |
| `description` | evet | 1–500 karakter |
| `prompt` | evet | 1–20.000 karakter, credential materyali içeremez |
| `triggers` | hayır | en fazla 12, küçük harf, tekrarsız |
| `allowedTools` | hayır | en fazla 16 izin adı, tekrarsız |
| `arguments` | hayır | en fazla 8; `name`, `description`, `required`, `maxLength` |
| `execution` | hayır | `inline` (varsayılan) veya `fork` |
| `model` | hayır | model tercihi; backend nihai kararı verir |
| `scope` | yalnız `project` | proje skill'i için açık kapsam etiketi |

Geçersiz manifest sessizce düzeltilmez; `normalizeSkillManifest` tek bir hata kodu
döndürür ve doğrulanan skill nesnesi dondurulur.

## Güvenlik sınırları

- **Yetki yükseltme yok.** `secret.read` ve `repo.delete` manifestte bildirilemez
  (`SKILL_TOOL_FORBIDDEN`). `external.write`, `external.send`, `repo.merge` ve
  `repo.write_branch` yalnız onay akışıyla verilir; manifestte bildirilemez
  (`SKILL_TOOL_APPROVAL_ONLY`).
- **Secret hijyeni.** `prompt` ve `description`; private key blokları, `sk-` /
  `nvapi-` / `gh*_` / `AKIA` biçimli anahtarlar veya `api_key=`, `client_secret=`
  benzeri atamalar içeriyorsa manifest reddedilir
  (`SKILL_PROMPT_SECRET_MATERIAL`).
- **Proje kapsamı.** `project` kaynaklı skill `scope` alanı olmadan geçerli
  değildir; `builtin` ve `user` kaynakları `scope` taşıyamaz.

## Sonraki tur: registry ve execution sözleşmesi

Registry katmanı bu sözleşmeyi tüketecek ve şu kuralları uygulayacaktır:

- **Kaynak önceliği user → builtin → project.** Kullanıcı kendi skill'lerinde en
  yüksek güvene sahiptir; `project` kaynağı depo içeriğinden geldiği için mevcut
  bir `builtin` veya `user` adını gölgeleyemez (`SKILL_NAME_SHADOWING`). Aynı
  kaynakta yinelenen ad `SKILL_NAME_DUPLICATE` ile atlanır. Atlanan her kayıt
  gerekçesiyle raporlanır; sessizce düşmez.
- **İzinli proje kapsamı.** `project` skill'i yalnız açıkça izin verilmiş bir
  `scope` ile yüklenir (`SKILL_SCOPE_NOT_PERMITTED`).
- **Kesişim kuralı.** Etkin araç kümesi, skill'in bildirdiği araçlar ile
  çalıştıran ajanın `toolPolicy` allowlist'inin kesişimidir; kesişim dışı her
  araç gerekçesiyle raporlanır. Skill hiçbir koşulda ajana yeni yetki kazandırmaz.
- **Veri, talimat değil.** Üretilen prompt skill gövdesini ve argümanları açıkça
  kullanıcı düzeyi veri olarak işaretler; skill metni sistem yetkisi kazanmaz.
- **Trigger eşleşmesi** sözcük sınırına saygı duyar; `özet` trigger'ı
  `özetleme` kelimesini eşleştirmez.
- **`inline`** skill mevcut ajan bağlamında çalışır. **`fork`** parent ajanın
  `agent.delegate` yetkisini gerektirir, hedef yalnız `specialist` olabilir ve
  alt ajan parent'ın araçlarını otomatik miras almaz.

Server / tool-runtime bağlantısı ve UI görünürlüğü ayrı ve tek amaçlı turlarda
ele alınır.
