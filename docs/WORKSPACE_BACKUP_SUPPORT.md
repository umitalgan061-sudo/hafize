# Çalışma Alanı Yedeği Destek Rehberi

## Destek triage

İlk soru kullanıcının export dosyasının olup olmadığıdır.

İkinci soru dosya boyutudur.

Üçüncü soru integrity durumudur.

Dördüncü soru seçilen section kapsamıdır.

Beşinci soru restore sırasında görülen status mesajıdır.

## Kullanıcı dosyası

Backup dosyasının tam içeriği kullanıcıdan istenmek zorunda değildir.

Hassas prompt veya konuşma içeriği destek kanalına kopyalanmamalıdır.

Mümkünse yalnız dosyanın formatı ve hata mesajı incelenmelidir.

Token veya credential istenmez.

## Yaygın sorun

Panel görünmüyorsa browser console ve build entry kontrol edilir.

Export disabled ise selection kapsamı kontrol edilir.

Import başarısızsa JSON formatı kontrol edilir.

Integrity failed ise dosya değiştirilmiş olabilir.

Restore no-op ise selection checkbox'ları kontrol edilir.

Restore rollback ise storage quota kontrol edilir.

## Storage

Browser storage dolu olabilir.

Privacy mode local storage erişimini engelleyebilir.

Site data temizlenmiş olabilir.

Başka bir profile ait backup ile mevcut profil karıştırılmamalıdır.

## PWA

Offline durumda backup paneli görünmeye devam etmelidir.

Export local olduğu için internet gerektirmez.

Import local olduğu için internet gerektirmez.

PWA cache eski olabilir.

Service worker yeni cache version alana kadar eski shell çalışabilir.

## Restore güvenliği

Support personeli kullanıcı adına destructive restore yapmamalıdır.

Kullanıcı confirmation vermelidir.

Unknown section restore edilmemelidir.

Integrity failed dosya kullanılmamalıdır.

## Recovery

Kullanıcı geçerli backup ile tekrar import deneyebilir.

Feature revert edilmiş olsa bile JSON dosyası harici recovery kaynağıdır.

Mevcut local state üzerinde işlem yapmadan önce mümkünse yeni backup alınmalıdır.

## Tanılama bilgileri

Export section sayısı.

Export byte boyutu.

Integrity durumu.

Section selection.

Error status.

Browser storage durumu.

Bunlar yeterli başlangıç sinyalleridir.

## Gizlilik

Backup dosyası hassas olabilir.

Support kanalına tüm backup içeriğinin yüklenmesi önerilmez.

Secret alanlarının backup'a girmemesi tasarım gereğidir.

## Hata sınıfları

NO_LOCAL_DATA normal boş state durumudur.

NO_EXPORT_SELECTION kullanıcı seçim hatasıdır.

BACKUP_TOO_LARGE boyut sınırıdır.

Invalid JSON biçim hatasıdır.

Integrity failed bütünlük hatasıdır.

Quota failure storage hatasıdır.

## Geliştiriciye aktarım

Hata tekrar üretilemiyorsa browser ve uygulama sürümü not edilmelidir.

Build SHA veya release commit'i not edilmelidir.

Feature branch içeriğiyle main içeriği karıştırılmamalıdır.

## Destek kabul kriteri

Kullanıcıya hangi state'in değişeceği açıklanmıştır.

Credential istenmemiştir.

Backup dosyası remote'a yüklenmemiştir.

Restore öncesi confirmation yapılmıştır.

Rollback warning kullanıcıya aktarılmıştır.
