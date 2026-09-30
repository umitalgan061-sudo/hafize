# GitHub Güvenli Yazma Değişiklik Özeti

## Başlangıç
GitHub workspace daha önce repository, branch, commit, PR ve dosya verisini salt-okunur okuyabiliyordu. Bu özellik write capability eklemeden önce explicit read sınırları kullanıyordu.

## Bu tur
Write capability ayrı server modülüne taşındı. Browser tarafı mevcut read workspace'i değiştirmeden yeni bir panel kullanıyor.

## Güvenlik katmanları
Write allowlist read allowlist'ten ayrıldı. Kullanıcı onayı server-side ticket üretimiyle bağlandı. Ticket kısa ömürlü, tek kullanımlık ve payload fingerprint'ine bağlı hale getirildi.

## Git işlemleri
Yeni branch Git refs API ile oluşturuluyor. Dosya commit'leri Contents API üzerinden yalnız non-default branch'te yapılabiliyor. PR API yalnız head/base arasında yeni PR oluşturuyor.

## Yasaklanan capability'ler
Merge, force-push, branch delete, workflow değişikliği, secret write ve credential payload'ı writer API tarafından sağlanmıyor.

## Browser
Token client'a verilmedi. UI dinamik GitHub verisini text node olarak gösteriyor. Son başarılı işlemler içerik saklamayan session history olarak tutuluyor.

## Release
Vite, HTML ve PWA shell entegrasyonu yapıldı. Unit ve source-contract testleri release gate olarak eklendi.
