# Recurrence Support

## Common
Görev neden tekrar etmiyor? Kayıt paused, cancelled veya worker configured değil olabilir.
Haftalık görev neden beklenen günde çalışmadı? Seçili günler ve interval kontrol edilmelidir.
Series anchor ilk runAt'tan türetilir.
31. gün seçildiğinde 31 olmayan aylarda son geçerli gün kullanılır.

## Pause
Pause yeni claim oluşmasını durdurur ama kaydı silmez.

## Resume
Resume paused recurring kaydı future occurrence zamanına getirip scheduled yapar.

## History
Retention 20 occurrence'tır; UI son 8 satırı gösterir.

## Presets
Preset schedule'ı otomatik oluşturmaz.
Import mevcut başlıkları korur.
256 KB sınırı aşılırsa dosya alınmaz.

## Security
Credential-bearing task rejected davranışı korunur.
History controlled error codes only.

## Escalation
State transition hatası schedule API seviyesinde incelenir.
Invalid recurrence client 400 response üretir.
Storage save error persistence layer recovery gerektirir.
