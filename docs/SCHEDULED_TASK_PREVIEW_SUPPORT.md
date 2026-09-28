# Preview Destek Rehberi

## Preview açılmıyor

Scheduled task workspace formunun DOM'a geldiğini, preview JS assetinin yüklendiğini ve browser console'da syntax hatası olmadığını kontrol et.

## Görev onay öncesi oluşuyor

Network sekmesinde ilk submitte POST görülüyorsa preview capture listener çalışmıyor demektir. Duplicate veya başka bir submit listener ile yeni bir network yolu eklenmemelidir.

## Onay çalışmıyor

Preview düğmesinin disabled durumunu ve tarih doğrulamasını kontrol et. Geçerli gelecek zaman ve ajan seçimi olmadan onay kapalıdır.

## Tekrar planla görünmüyor

Task row üzerinde agentId, maxAttempts ve runAt dataset alanlarının bulunup bulunmadığını kontrol et. Çalışıyor görevlerde düğme bilinçli olarak gösterilmez.

## PWA'da eski davranış görünüyorsa

Service worker cache versionını ve dört yeni assetin shell listesinde olduğunu kontrol et.
