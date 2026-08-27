# Skills manifest ve registry sözleşmesi

Bu katman skill tanımlarını doğrular ve çağrıyı çözer; **kendi başına model, ağ veya araç çağrısı yapmaz** ve production tool catalog'a yeni kayıt eklemez.

## Manifest (`lib/skill-manifest.mjs`)

- Zorunlu: `id` (slug), `name`, `description`, `prompt`. Opsiyonel: `triggers`, `allowedTools`, `arguments`, `model`, `execution`.
- `execution` yalnız `inline` veya `fork` olabilir (varsayılan `inline`); Claude tarafındaki `bypass` benzeri bir mod yoktur.
- Kaynak (`builtin` / `user` / `project`) çağıran tarafından verilir; manifest kendi güven seviyesini seçemez. `project` skill'i yalnız açıkça izin verilen `projectScope` ile yüklenir.
- `secret.read`, `repo.delete`, `repo.merge`, `repo.write_branch`, `external.write` ve `external.send` manifest seviyesinde reddedilir; skill onay gerektiren yetkiyi kendine veremez.
- Prompt gövdesi veya argüman adı secret/credential görünümlüyse manifest reddedilir.

## Registry ve çağrı (`lib/skill-registry.mjs`)

- Aynı `id` çakışırsa güven sırası kazanır: `builtin` > `user` > `project`; gölgelenen kayıt `shadowed` listesinde raporlanır. Geçersiz tek bir manifest defteri düşürmez, `errors` listesine alınır.
- `list()` modele yalnız katalog alanlarını verir; prompt gövdesi paylaşılmaz.
- `resolveSkillInvocation()` skill'in her aracını çağıran ajanın onaysız allowlist'ine karşı doğrular; `fork` ayrıca `agent.delegate` yetkisi ister; `model` tercihi izinli liste dışına çıkamaz.
- Argümanlar şemaya göre doğrulanır: bildirilmemiş alan, eksik zorunlu alan, tip uyuşmazlığı, 2000 karakter üstü ve kontrol karakteri (prompt/header injection) reddedilir.
- Üretilen prompt argümanları açıkça veri olarak işaretler ve izinli araç listesini yazar; izin kararı yine backend'dedir.

Server wiring, skill kaynaklarının yüklenmesi ve tool catalog'a `skill.invoke` kaydı ayrı turda ele alınacaktır.
