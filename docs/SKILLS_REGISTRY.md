# Skills manifest ve registry sözleşmesi

Skill katmanı tekrar eden yordamları adlandırılmış ve doğrulanabilir bir manifest ile tanımlar. Skill yeni yetki kaynağı değildir; ajanın hâlihazırda sahip olduğu izinler içinde çalışan kullanıcı seviyesinde bir talimat paketidir.

## Manifest (`lib/skill-manifest.mjs`)

- Alanlar: `name`, `description`, `source`, `projectScope`, `triggers`, `allowedTools`, `arguments`, `model`, `execution`, `instructions`. Bilinmeyen alan reddedilir.
- `source` yalnız `builtin`, `user`, `project`; `execution` varsayılanı `inline`, `fork` ayrı alt görev bağlamı içindir.
- `projectScope` yalnız project skill'lerinde zorunludur, diğer kaynaklarda yasaktır.
- `allowedTools` içinde `secret.read` ve `repo.delete` hiçbir zaman; `external.write`, `external.send`, `repo.merge`, `repo.write_branch` gibi onay gerektiren izinler manifest üzerinden tanımlanamaz.
- `instructions` içinde private key, `ghp_`, `sk-`, `AKIA`, `xox*` gibi credential kalıpları reddedilir.

## Registry (`lib/skill-registry.mjs`)

- Kaynak önceliği manifest sırasından bağımsızdır: `project` > `user` > `builtin`; aynı kaynakta yinelenen ad reddedilir.
- Project skill yalnız `allowedProjectScopes` içinde açıkça izin verilen kapsamdan yüklenir.
- Geçersiz tek bir manifest registry'yi düşürmez; `rejections()` ad, kaynak ve gerekçe ile raporlar.
- `authorizeSkill` her aracı `authorizeAgentTool` ile doğrular; ajanın izinli olmadığı tek bir araç varsa skill tümüyle reddedilir, onay gerektiren izin yalnız `approvalGranted` ile açılır.
- `buildSkillInvocation` argümanları sözleşmeye göre doğrular ve skill metnini **user** rolünde, "sistem yetkisi vermez" başlığıyla döndürür; system mesajı üretmez.

## Test ve geri alma

`node scripts/test-skill-manifest.mjs`, `node scripts/test-skill-registry.mjs` (ayrıca `npm run check` kapısında). Katman henüz server akışına bağlı değildir; iki lib dosyası, iki test ve `package.json` eklemesi geri alınarak davranış regresyonu olmadan kaldırılabilir.
