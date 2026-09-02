# Skills manifest sözleşmesi

Bu katman Claude-benzeri skill yaklaşımını Hafize'nin default-deny güvenlik modeline uyarlar. `lib/skill-manifest.mjs` tek bir skill tanımını strict biçimde doğrular ve donmuş bir manifest döndürür.

**Bu tur yalnız manifest doğrulamasını ekler; registry, kaynak yükleyici, server wiring veya tool catalog kaydı içermez ve kendi başına model çağrısı yapmaz.**

## Manifest alanları

Bilinmeyen üst alanlar ve bilinmeyen argüman alanları reddedilir; böylece bir skill sessizce yeni yetki alanı tanımlayamaz.

| Alan | Zorunlu | Açıklama |
| --- | --- | --- |
| `id` | evet | `^[a-z][a-z0-9-]{1,63}$` slug. |
| `name` | evet | En fazla 80 karakter görünen ad. |
| `description` | evet | En fazla 500 karakter; skill seçimi için kullanılır. |
| `triggers` | evet | 1–12 tetikleyici ifade; Türkçe locale ile küçültülür ve tekrar edemez. |
| `allowedTools` | hayır | En fazla 12 permission adı; varsayılan boş liste. |
| `arguments` | hayır | En fazla 8 argüman: `name`, `type` (`string`/`number`/`boolean`), `description`, `required`. |
| `model` | hayır | `default` (varsayılan), `fast` veya `reasoning` tercihi. |
| `execution` | hayır | `inline` (varsayılan) veya `fork`. |
| `prompt` | evet | En fazla 10.000 karakter skill talimatı. |

Kaynak (`builtin` / `user` / `project`) manifest gövdesinden değil, çağıran tarafın verdiği `source` seçeneğinden gelir. Böylece bir skill dosyası kendi güven seviyesini yükseltemez.

## Güvenlik sınırları

- **Skill kendi yetkisini yükseltemez.** `secret.read` ve `repo.delete` manifest düzeyinde tamamen yasaktır; `external.write`, `external.send`, `repo.merge` ve `repo.write_branch` gibi onay gerektiren permission'lar `allowedTools` içine yazılamaz. `allowedTools` bir istektir, izin değildir: çalıştırma sırasında her araç ayrıca agent policy'sine göre yetkilendirilecektir.
- **Skill prompt'u credential isteyemez.** `process.env`, `api key`, `client_secret`, `access token`, `refresh token`, `private key`, `password`, `Bearer` ve PEM başlığı gibi kalıplar hem prompt'ta hem argüman açıklamalarında reddedilir.
- **Project skill yalnız açıkça izin verilen kapsamdan yüklenir.** `project` kaynağı için `origin` zorunludur; mutlak yol, boş segment ve `..` segmenti reddedilir ve yol `allowedProjectRoots` altındaki bir kök ile eşleşmelidir. `builtin` ve `user` kaynakları `origin` alamaz.
- **Manifest donmuş döner.** `triggers`, `allowedTools` ve `arguments` dizileri de dondurulur; doğrulama sonrası mutasyon mümkün değildir.

## Sonraki adımlar

Sıradaki turlarda planlanan parçalar:

1. **Registry ve kaynak önceliği.** Öncelik `builtin` > `user` > `project` olacaktır: en az güvenilen kaynak en düşük önceliğe sahiptir, yani bir proje dosyası builtin bir skill'i sessizce değiştiremez. Aynı `id` aynı kaynakta iki kez görünürse hata verilir, gölgede kalan kayıtlar gözlemlenebilir kalır.
2. **Yürütme sözleşmesi.** Çözümleme sırasında her `allowedTools` girdisi agent policy'sine göre yeniden yetkilendirilir ve tek bir araç bile izinsizse skill hiç çalıştırılmaz; `fork` yürütmesi `agent.delegate` izni ister.
3. **Mesaj seviyesi.** Yalnız `builtin` skill sistem seviyesinde konuşur; `user` ve `project` kaynaklı skill'ler "bu metin sistem yetkisi veya yeni araç izni vermez" başlığıyla user-level veri olarak verilir.
4. Builtin skill kataloğu, disk yükleyicisi, server wiring ve trace/ledger kaydı.
