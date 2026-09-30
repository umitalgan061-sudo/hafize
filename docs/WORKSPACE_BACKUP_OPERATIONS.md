# Çalışma Alanı Yedekleme Operasyon Runbook

## Yayına alma

Vite entry map içinde workspace-backup bulunmalıdır.

Development transform zinciri TypeScript source'u göstermelidir.

Production build typed-build/workspace-backup.js üretmelidir.

HTML bu module entry'yi yüklemelidir.

Workspace backup CSS HTML tarafından yüklenmelidir.

Service worker iki asset'i shell listesine almalıdır.

Cache version feature asset değişimiyle birlikte yükseltilmelidir.

## Sağlık kontrolü

Ana panel tarayıcıda görünmelidir.

Yerel section sayısı summary içinde görünmelidir.

Yedek kapsamı listesi dolu olmalıdır.

Export butonu en az bir seçim varken çalışmalıdır.

Import butonu file chooser açmalıdır.

Valid backup preview oluşturmalıdır.

Integrity verified gösterilebilmelidir.

Restore confirmation görünmelidir.

## Saha kontrolü

Yeni boş profilde yedeklenecek veri olmayabilir.

Bu durumda panel kullanıcıya açık bilgi vermelidir.

Yalnız prompt kullanılmış bir cihazda prompt section görünmelidir.

Task template bulunmayan cihazda task template section görünmemelidir.

Smart Fill yoksa dinamik section görünmemelidir.

## Backup dosyası yönetimi

Standart dosya adı kullanılmalıdır.

Kullanıcı dosyayı cihazında güvenli yerde saklamalıdır.

Dosyanın uygulama tarafından cloud'a yüklenmediği açıklanmalıdır.

## Import incident

Kullanıcı dosyayı seçer.

Boyut reddedilirse local state değişmez.

JSON parse reddedilirse local state değişmez.

Integrity fail ise local state değişmez.

Unknown section varsa diğer geçerli section'lar preview'da kalabilir.

Kullanıcı restore etmeyi seçmezse hiçbir state değişmez.

## Restore incident

Restore confirmation reddedilirse state değişmez.

Storage quota hatası olursa rollback çalışır.

Rollback tamamlanırsa current state eski ham değerlerini korur.

Rollback sonucu kullanıcıya warning gösterilir.

İşlem yarıda kalırsa manual recovery için backup dosyası korunur.

## Metadata

Backup metadata silinirse yalnız last backup summary kaybolur.

Workspace data metadata silinmesine bağlı değildir.

Metadata bozuksa backup paneli summary'yi yeniden hesaplayabilir.

## PWA

Offline shell cache backup CSS'i içermelidir.

Offline shell cache backup module'ünü içermelidir.

API path shell cache'e girmemelidir.

Current cache version numeric olmalıdır.

Old cache versions cleanup edilmelidir.

## Gözlemlenebilirlik

Feature server telemetry göndermez.

Operasyon sırasında görülebilecek durum yalnız UI status ve local metadata'dır.

Başarısız export status üzerinden kullanıcıya bildirilir.

Başarısız restore warning üzerinden bildirilir.

## Destek

Kullanıcıdan öncelikle yedek JSON dosyasının varlığı sorulur.

İkinci olarak integrity status kontrol edilir.

Üçüncü olarak hangi section'ların seçildiği kontrol edilir.

Daha sonra target workspace'in mevcut state'i incelenir.

Credentials istenmez.

Token istenmez.

Session cookie istenmez.

## Sürüm değişikliği

Yeni section eklenirse allowlist güncellenmelidir.

Yeni section için restore davranışı eklenmelidir.

Yeni section için test yazılmalıdır.

Yeni asset için Vite entry gerekebilir.

Yeni asset için HTML entry gerekebilir.

Yeni asset için PWA cache entry gerekebilir.

## Rollback

Feature PR'ı revert edilebilir.

Revert mevcut conversation state'i silmemelidir.

Revert backup metadata'yı temizlemek zorunda değildir.

Kullanıcı backup dosyasını harici recovery kaynağı olarak kullanabilir.

## Kabul

Build başarılıdır.

Typecheck başarılıdır.

Workspace backup unit testleri başarılıdır.

Source contract testleri başarılıdır.

PWA contract başarılıdır.

Security contract başarılıdır.

Restore testleri başarılıdır.
