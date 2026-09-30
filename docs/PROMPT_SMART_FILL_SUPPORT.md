# Smart Fill Destek Rehberi

## Panel açılmıyor

Önce Prompt Library kartının mevcut olduğunu kontrol et. Ardından Smart Fill JS asset'inin yüklenip yüklenmediğini ve `HafizePromptLibrarySmartFill` globalinin oluştuğunu kontrol et.

## Değişkenler görünmüyor

Prompt gövdesinin `{{konu}}` biçimini kullandığını kontrol et. Desteklenen karakterler harf, rakam, alt çizgi ve tiredir.

## Önizleme güncellenmiyor

Input `input` event'i ile güncellenir. Browser console'da hata varsa feature dosyasındaki DOM erişimlerini kontrol et.

## Set kaydedilmiyor

Local storage yazma izni kapalıysa yeni preset kalıcı olmayabilir. Bu durum uygulamanın ana prompt kayıtlarını silmez.

## Palette açılmıyor

`/prompt` komutunun satır başlangıcında veya boşluk sonrasında kullanıldığını kontrol et. `Ctrl/⌘+Shift+O` doğrudan palette açma yoludur.

## Yanlış prompt seçiliyor

Tam başlık eşleşmesi en yüksek skora sahiptir. Sonra başlık başlangıcı, başlık içi, etiket ve gövde gelir.

## Gönderim neden olmuyor

Bu bilinçli bir güvenlik davranışıdır. Smart Fill yalnız textarea'yı doldurur; son gönderim kullanıcı tarafından yapılır.

## PWA'da eski görünüm

Service worker cache v28'e geçmelidir. Gerekirse normal yenileme sonrası service worker'ın güncel shell assetlerini aldığı doğrulanır.

## Destek kaydı

Loglara prompt içeriği veya değişken değeri eklenmemelidir. Destek notu yalnız hata türü, release commit'i ve browser koşullarını içermelidir.
