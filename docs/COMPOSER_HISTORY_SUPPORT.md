# Composer History — Destek Rehberi

## History görünmüyorsa

Önce `Geçmiş` düğmesinin görünür olduğunu doğrula.

Sonra tarayıcı storage izinlerini kontrol et.

History kapalıysa kayıt oluşmaz.

## Arrow kısayolu çalışmıyorsa

Composer odakta olmalıdır.

İmleç metnin başında veya sonunda olmalıdır.

IME composition bitmiş olmalıdır.

History limiti 0 olmamalıdır.

## Panel kayıt göstermiyorsa

Arama alanını temizle.

Storage key'i `hafize.composer-history.v1` olarak kontrol et.

Bozuk JSON varsa modül bilinçli olarak empty state'e döner.

## Kayıt silme

Panelde `Sil` yalnız seçilen kaydı kaldırır.

`Geçmişi temizle` tüm kayıtları confirmation sonrasında kaldırır.

Kullanıcı iptal ederse veri değişmez.

## Yedekleme sorunu

Dosyanın JSON olduğuna bak.

512 KB boyut sınırını kontrol et.

Array veya `{ items }` payload kullan.

Import başarısızsa mevcut history korunmalıdır.

## Gizlilik

History sunucuda görünmez.

Analytics panelinden bağımsızdır.

Kapatma ve retention kontrolleri cihaz başınadır.

## Escalation

Browser storage, FileReader veya Blob desteği eksikse feature partial olabilir.

Ana sohbet gönderimi bundan etkilenmemelidir.
