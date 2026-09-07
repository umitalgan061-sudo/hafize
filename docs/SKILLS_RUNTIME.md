# Skills runtime

`lib/skills-runtime.mjs`, strict `skills-registry` sözleşmesini server tarafında okunabilir bir builtin katalogla bağlayan küçük runtime katmanıdır.

Builtin skill'ler `skills/builtin.json` içinden yüklenir ve her kayıt `source: builtin` olarak normalize edilir. Runtime yalnız doğrulanmış manifestleri registry'ye sokar; proje veya kullanıcı skill yükleme politikaları ayrı kapsamlar olarak kalır.

Bir skill seçildiğinde `resolveForAgent()` yalnız ajanın zaten sahip olabileceği yetkilerle kesişen araçları döndürür. `getAllowedNvidiaTools(..., { allowedPermissions })` bu ikinci sınırı tool catalog tarafında uygular; böylece skill adı veya prompt'u tek başına yeni bir yetki oluşturmaz.

Skill prompt'u system mesajı değildir. Skill argümanları manifest şemasına göre doğrulanır ve credential benzeri değerler reddedilir. Bu tur server endpoint'ine otomatik trigger eklemez; açık `skillId` tüketimi bir sonraki wiring adımında yapılabilir.
