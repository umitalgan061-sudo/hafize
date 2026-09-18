# Prompt Library import safety — release note

Bu sürüm, yerel Prompt Library içe aktarma ve veri sağlığı yüzeyini birlikte güvenli hale getirir.

## Kullanıcı etkisi

Import artık önce önizlenir ve açık onaydan sonra yazılır. Duplicate ID'ler yeni kimlik alır. Kapasite etkisi gösterilir.

Diagnostics paneli repair öncesi etki özeti üretir. Repair checkpoint'i oluşturulur. Geçersiz kayıtlar quarantine alanında korunabilir ve son repair geri alınabilir.

Recovery snapshot tekrar import edilebilir.

## Gizlilik

İşlem istemci tarafında kalır. Import, diagnostics ve recovery katmanları remote telemetry kullanmaz.

## Geri alma

PR revert edildiğinde ana Prompt Library storage anahtarları korunur. Repair checkpoint ve quarantine de ayrı namespace'lerdir.

## QA

Release öncesi final safety, lifecycle, accessibility, PWA ve no-network sözleşmeleri çalıştırılmalıdır.
