# Composer Ekleri — Scanner Operasyonları

## Scope
Secret scanner yaygın pattern sınıflarını yerel olarak tarar.

## Alert
Riskli dosya satırında kısa uyarı gösterilir. Finding tam secret değerini yazmaz.

## Confirmation
Riskli content insert ve quick action öncesinde browser confirm ile explicit kullanıcı kararı gerekir.

## Non-blocking
Scanner bulunamadıysa attachment runtime normal content flow'u sürdürebilir; bu nedenle scanner tek zorunlu doğrulama değildir.

## Incident
Scanner false negative şüphesi varsa kullanıcıya final composer metnini kontrol etmesi önerilir.

## Update
Yeni pattern eklemek scanner file'ını günceller; attachment storage sözleşmesi değişmez.

## Logging
Dosya içeriği ve finding values server loglarına gönderilmez.