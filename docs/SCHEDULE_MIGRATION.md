# Schedule Migration Guide

## Hedef

Bu sürümün amacı mevcut schedule verisini silmeden görev sayısı kısıtını kaldırmak ve büyük koleksiyonları sayfalı yönetilebilir hale getirmektir.

## Mevcut veriler

Eski snapshot formatı aynı `entries` yapısını korur.

Schedule id biçimi `schedule_N` değişmez.

Task metni ve owner ilişkisi korunur.

Durumlar `scheduled`, `running`, `completed`, `failed`, `cancelled` olarak kalır.

Bu nedenle schema migration zorunlu değildir.

## Storage formatı

Encrypted file adapter yeni kayıtları format v2 olarak yazar.

V2 payload gzip sıkıştırma ve AES-256-GCM içerir.

Eski v1 encrypted snapshot'ları adapter okuyabilir.

İlk başarılı v2 save sonrasında dosya yeni formata dönüşür.

## Migration adımları

1. Deployment'ı mevcut storage dosyasıyla başlat.
2. Scheduler runtime'ın snapshot'ı açtığını doğrula.
3. `GET /api/schedules/stats` ile toplam kayıt sayısını kontrol et.
4. İlk küçük schedule mutation'ı gerçekleştir.
5. Encrypted dosyanın v2 olarak yazıldığını doğrula.
6. Aynı dosyayı yeni process ile yeniden açarak restore testi yap.
7. Backlog worker'ını düşük concurrency ile gözlemle.
8. Ardından production concurrency değerini yükselt.

## Kapasite yükseltme

`HAFIZE_SCHEDULE_STORAGE_MAX_FILE_BYTES` mevcut deployment'ın encrypted snapshot boyutunu karşılayacak şekilde ayarlanmalıdır.

Önce disk boş alanı kontrol edilmelidir.

Dosya sınırı artırılırken process memory ve backup kapasitesi de değerlendirilmelidir.

## Rollback

Kod rollback'i storage formatını otomatik eski v1'e çevirmemelidir.

V2 dosyası rollback öncesi deployment tarafından okunabilen bir format olmalıdır.

Kodun gerçekten eski adapter sürümüne geri dönmesi gerekiyorsa v2→v1 migration export edilip kontrollü restore yapılmalıdır.

## Veri doğrulama

Migration sonrası şu invariant'lar korunmalıdır:

- schedule id benzersizdir;
- owner id kaybolmaz;
- task metni değişmez;
- runAt değişmez;
- attempts değeri değişmez;
- maxAttempts değeri değişmez;
- status geçerli kalır.

## Büyük collection doğrulaması

Binlerce task içeren fixture ile store açılmalıdır.

İlk ve son cursor sayfaları okunmalıdır.

Aynı schedule iki cursor sayfasında görünmemelidir.

Owner izolasyonu pagination boyunca değişmemelidir.

## Backup

Migration öncesinde encrypted schedule dosyasının bütünlüğü ve backup erişilebilirliği doğrulanmalıdır.

Encryption key backup'tan bağımsız ve güvenli secret yönetiminde tutulmalıdır.

## Kesintisiz geçiş

Scheduler worker çalışan process ile storage migration aynı anda yapılmamalıdır.

Önce yazma akışı kontrollü biçimde durdurulmalı, sonra backup alınmalı, ardından yeni process başlatılmalıdır.

Distributed deployment'ta tek aktif migrator kullanılması tercih edilir.
