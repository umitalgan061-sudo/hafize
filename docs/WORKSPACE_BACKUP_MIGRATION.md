# Çalışma Alanı Yedeği Migration ve Compatibility

## Migration ilkesi

Feature mevcut storage key'lerini yerinde dönüştürmez.

Yeni bir workspace backup metadata key'i dışında migration state'i oluşturmaz.

Mevcut local state olduğu gibi okunur.

Backup format version 1 taşınabilir belge formatıdır.

## Eski veriler

Eski Prompt Library kayıtları mevcut normalize logic ile okunur.

Eski conversation state mevcut normalize logic ile okunur.

Eski message workspace state mevcut normalize logic ile okunur.

Eski model preference state mevcut normalize logic ile okunur.

Backup merkezi bu normalize katmanlarının yerine geçmez.

## Yeni yedek

İlk export seçilen mevcut state'i snapshot olarak alır.

Export sırasında storage key'leri değiştirilmez.

Export sonrasında yalnız küçük metadata yazılır.

## Import compatibility

Version 1 backup yeni sürümde inspection'dan geçebilir.

Unknown future fields ignored olur.

Unknown future section kind'ları restore edilmez.

Future schema değişiminde version artırılmalıdır.

## Restore compatibility

Restore ham JSON state'i storage'a yazar.

Sonraki uygulama açılışında mevcut normalize logic state'i kontrol eder.

Bu nedenle feature uygulamanın veri modelini tek başına genişletmez.

## Section ekleme

Yeni section önce allowlist'e eklenir.

Ardından label ve description tanımlanır.

Sonra restore branch'i eklenir.

Daha sonra PWA ve Vite entry gerekiyorsa eklenir.

Son olarak test ve doküman eklenir.

## Section kaldırma

Bir section kaldırılacaksa yeni export onu üretmemelidir.

Eski backup içindeki removed section unknown olarak skip edilmelidir.

Kullanıcının seçtiği diğer section'lar restore edilebilmelidir.

## Format version

Version increment breaking change için kullanılır.

Non-breaking metadata field addition version artırmadan yapılabilir.

Section kind yeni davranış eklediğinde compatibility notu yazılmalıdır.

## Upgrade

Aynı backup dosyası upgrade işleminde otomatik restore edilmez.

Kullanıcı restore işlemini kendisi başlatır.

Upgrade sonrası backup tekrar alınabilir.

## Downgrade

Daha eski bir Hafize sürümü yeni section'ları tanımayabilir.

Unknown section'lar restore edilmemelidir.

Desteklenen eski section'lar restore edilebilir.

Bu nedenle eski sürümle yeni backup paylaşımında kapsam kontrol edilmelidir.

## Browser migration

LocalStorage key isimleri değişirse compatibility bridge gerekir.

Bu feature key migration yapmadığı için mevcut workspace state korunur.

## Safety

Migration sırasında backup dosyasının kendisi kaybolmamalıdır.

Import dosyası uygulama storage'ına kopyalanmamalıdır.

Restore öncesi confirmation korunmalıdır.

## Test

Version 1 valid.

Unknown section skip.

Missing optional skipped field.

Integrity absent unverified.

Integrity valid verified.

Integrity invalid failed.

Old section preserved.

Selective restore.

## Release

Format change migration dokümanına eklenmelidir.

User guide eski ve yeni cihaz akışını açıklamalıdır.

Rollback sonrası mevcut state silinmemelidir.

## Compatibility summary

Workspace Backup bir data migration motoru değildir.

Taşınabilir bir snapshot formatıdır.

Versioning yalnız snapshot schema'sını yönetir.

Application storage modelinin sahibi mevcut workspace modülleridir.
