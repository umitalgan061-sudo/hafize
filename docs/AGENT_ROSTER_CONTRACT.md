# Hafize exact agent roster contract

Hafize runtime'ı genişleyen bir ajan kataloğu değildir. Aktif registry tam olarak dört ajan taşır ve bu sınır backend tarafından fail-closed doğrulanır.

## Sabit roster

| Agent ID | Kind | Sorumluluk |
| --- | --- | --- |
| `minimal-engineer` | `selector` | Varsayılan geliştirme seçicisi; en küçük güvenli kapsamı seçer ve gerektiğinde specialist'e delege eder. |
| `agency-code-reviewer` | `specialist` | Salt-okunur doğruluk, güvenlik ve test incelemesi. |
| `movie-coordinator` | `selector` | Film/izleme isteklerini sınıflandıran ikinci selector. |
| `handyman-advisor` | `specialist` | Pratik bakım/onarım sorularında dar kapsamlı güvenlik odaklı uzman. |

`defaultAgent` yalnız `minimal-engineer` olabilir. Beşinci bir ajan, eski bir ajan kimliği veya roster içindeki kind değişikliği server başlangıcında reddedilir.

## Selector / specialist sınırı

Selector kullanıcı isteğini doğrudan çözebilir ve kendi tool policy'si izin veriyorsa dar bir alt görevi delege edebilir. Delegasyon runtime'ı hedefin `kind: specialist` olmasını zorunlu tuttuğu için selector -> selector çağrısı yoktur.

Specialist parent selector'ın yetkilerini miras almaz. Her specialist kendi `default: deny` tool policy'siyle yeniden yetkilendirilir. Bir specialist'in sonucu selector'a yeni izin vermez.

## Skills ajan değildir

`skills/registry.json` içindeki `/plan`, `/review` veya ileride eklenecek prosedürler yeni ajan oluşturmaz. Inline skill aynı ajan bağlamında user-role prosedürü uygular. Fork skill ise yalnız mevcut roster içindeki bir `specialist` kimliğine yönlenebilir.

Mevcut `/review` prosedürü yalnız `agency-code-reviewer` specialist'ine fork eder. Skill metadata'sı target agent'ın backend tool policy'sini genişletemez.

## Agency Agents kullanımı

`msitarzewski/agency-agents` bir rol ve prosedür fikir kaynağıdır; runtime roster kaynağı değildir. Katalogdan yeni profil kopyalamak, otomatik ajan üretmek veya geniş bir framework ithal etmek yasaktır. Yararlı fikirler mevcut dört ajan veya skill prosedürü içine dar biçimde uyarlanır.

Bu nedenle eski `hafize-general`, `agency-orchestrator` ve `agency-minimal-engineer` aktif runtime kimlikleri değildir. Tarihsel dokümanlarda kaynak analizi olarak geçebilmeleri yeni aktif ajan anlamına gelmez.

## Güvenlik invariants

- Registry tam dört ajan içerir.
- ID ve `kind` eşleşmeleri sabittir.
- `minimal-engineer` varsayılan selector'dır.
- Tool policy her ajan için `default: deny` kalır.
- `secret.read` ve `repo.delete` hiçbir ajana verilemez.
- `repo.write_branch`, `repo.merge`, `external.write` ve `external.send` doğrudan allowlist edilemez; ilgili write capability varsa backend approval sınırı uygulanır.
- Delegasyon yalnız specialist hedefe yapılabilir.
- Skill fork yalnız specialist hedefe yapılabilir.
- Shared `trace_id` ve mevcut cancellation/lifecycle sınırları korunur.

## Değişiklik prosedürü

Roster değişikliği sıradan feature ekleme değildir. Yeni agent ID eklemek yerine önce mevcut dört rolden birine prosedür/skill eklenip eklenemeyeceği değerlendirilir. Gerçekten ayrı bir güvenlik ve tool-policy sınırı gerekse bile roster genişletmesi ayrıca açık mimari karar ve test güncellemesi olmadan kabul edilmez.

Bu kontratın amacı Hafize'yi az sayıda, gözlenebilir ve yetkisi sınırlandırılmış ajanlarla tutmaktır; ajan sayısını ürün metriği haline getirmek değildir.
