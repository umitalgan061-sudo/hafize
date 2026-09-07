# Skills runtime wiring

Hafize skill registry artık model tool runtime'ına `skill_invoke` üzerinden bağlanır.

## Çalışma modeli

`lib/skills-runtime.mjs` tek registry/selector uygulamasıdır. Normal uygulama başlangıcında `createSkillsRuntime()` asenkron yükleme yoludur. Tool runtime'ın model çağrısı başlamadan önce hazır olması gerektiği için aynı modüldeki `createBuiltinSkillsRuntimeSync()` yalnızca repository içindeki güvenilen `skills/builtin.json` kaynağını senkron olarak yükleyen bootstrap yüzeyidir. Ayrı bir registry veya ikinci skill authorization sistemi oluşturulmaz.

`lib/tool-runtime.mjs` yalnız `skill.invoke` izni agent policy'sinde bulunan ajanlara `skill_invoke` aracını yayınlar. Araç çağrısı geldiğinde skill id ve argümanları mevcut registry'ye gönderilir; manifest doğrulaması, argüman doğrulaması ve agent/tool kesişimi yeniden uygulanır.

## Güvenlik sınırı

Skill manifesti yeni yetki kaynağı değildir. `allowedTools`, agent policy ile kesişmeden model çağrısına taşınmaz. `secret.read`, `repo.delete` ve diğer yasaklı izinler registry katmanında reddedilir.

Skill çıktısındaki `prompt`, `role: system` mesajı olarak eklenmemelidir. `skill_invoke` bunu tool sonucu olarak döndürür; model bu içeriği backend tarafından verilmiş kullanıcı düzeyinde veri olarak ele almalıdır.

Built-in bootstrap yalnız `skills/builtin.json` okur. Project/user skill yükleme yetkisi veya kapsamı bu senkron bootstrap üzerinden açılmaz; bunlar `createSkillsRuntime()` ve caller tarafından verilen `allowedProjects` bağlamında kalır.

## Test sözleşmesi

`test-skills-runtime.mjs` iki runtime oluşturma yolunun aynı builtin skill setini ürettiğini doğrular. `test-tool-runtime.mjs` ise:

- `skill_invoke` aracının katalogda kayıtlı olmasını,
- yalnız policy tarafından izin verilen ajanlarda görünmesini,
- gerçek builtin skill çözümlemesini,
- araç listesinin agent policy ile daralmasını,
- bilinmeyen skill ve bilinmeyen argümanların fail-closed hata vermesini

doğrular.

## Geri alma

Bu katman tek PR olarak geri alınabilir. `skill.invoke` izinleri agent registry'den, `skill_invoke` tool kaydı tool runtime'dan ve senkron bootstrap helper'ı skills runtime'dan kaldırıldığında önceki tool kataloğuna dönülür.
