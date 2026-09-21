# Composer Ekleri — Incident Playbook

## Şikayet: dosya seçince ağ isteği
Attachment runtime'ında network sink ara. Özellikle fetch, XHR, WebSocket ve Beacon olmadığını doğrula. Browser network logunda dosya seçimi isteği görülmemeli.

## Şikayet: büyük dosya uygulamayı yavaşlatıyor
Pre-read validateFile kontrolünü doğrula. 256 KB üstü dosya readText çağrısından önce reddedilmelidir.

## Şikayet: gizli bilgi uyarısı gelmedi
Secret scanner asset yükleme sırasını, scanner globalini ve finding regexlerini kontrol et.

## Şikayet: yanlışlıkla mesaj gönderildi
Attachment insert içinde submit/requestSubmit araması yap. Sadece input event'i kullanılmalıdır.

## Şikayet: geri alma çalışmıyor
Composer değerinin insert sonrası dışarıdan değişip değişmediğini incele. Güvenli olmayan durumda undo bilinçli olarak vazgeçebilir.

## Şikayet: staged dosya çok uzun tutuluyor
Expiry timer ve destroy lifecycle'ını kontrol et. Default 15 dakika sınırdır.

## Veri toplama
Incident çözümü için kullanıcıdan dosyanın kendisini isteme. Uzantı, boyut ve hata mesajı yeterlidir.

## Rollback
Kritik güvenlik regressyonunda attachment JS/CSS bağlantıları ve shell cache entryleri revert edilir. Mevcut sohbet kayıtları silinmez.