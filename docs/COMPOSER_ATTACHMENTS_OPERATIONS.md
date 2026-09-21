# Composer Ekleri — Operasyon

## Release öncesi
PWA cache listesi, index wiring, byte sınırı, network boundary ve no-submit sözleşmeleri kontrol edilir.

## Gözlemlenebilirlik
Attachment modülü bağımsız telemetry üretmez. Operasyon loglarında dosya içeriği veya dosya adı aranmaz.

## Cache
Yeni asset eklenirse shell cache version bir defa artırılır. API yolları network-only kalır.

## Incident
Dosya seçimi sunucuda istek oluşturuyorsa ilk kontrol attachment modülünde network sink aramaktır.

## Memory incident
Bekleyen queue beklenenden uzun yaşıyorsa expiry timer, controller destroy ve sayfa lifecycle incelenir.

## UX incident
Insert sırasında textarea değişmiyorsa composer maxlength ve payload size hesapları kontrol edilir.

## Support
Kullanıcıdan dosyanın kendisini istemek yerine dosya uzantısı, boyutu ve status mesajı istenir.

## Roll forward
Düzeltme yeni branch'te PR üzerinden çıkarılır; main'e doğrudan yazılmaz.

## Roll back
UI ve shell wiring geri alınır; conversation history geriye dönük değiştirilmez.