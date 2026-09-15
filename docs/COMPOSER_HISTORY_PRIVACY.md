# Composer History — Gizlilik

Composer History cihaz-yerel bir yardımcı özelliktir.

## Veri akışı

Kullanıcı mesajı composer'a yazılır.

Kullanıcı gönderdiğinde history modülü submit olayını gözlemler.

Metin normalize edilir.

Boş metin kaydedilmez.

Kayıt localStorage'a yazılır.

Sunucuya ek bir history isteği yapılmaz.

Analytics event'i üretilmez.

Remote telemetry çağrısı yapılmaz.

## Saklanan veri

Yalnız gönderilen metnin bounded kopyası tutulur.

Gönderim zamanı ayrıca kaydedilmez.

IP, kullanıcı hesabı, model, ajan veya sohbet kimliği history kaydına eklenmez.

Bu nedenle history tek başına sohbet metadata'sı değildir.

## Kapatma

Kullanıcı `Gönderim geçmişini cihazda sakla` seçeneğini kapatabilir.

Kapatma sırasında ana history storage alanı temizlenir.

Ayar kaydı ayrı key'de kalabilir.

Yeni mesajlar kapalı modda history'ye eklenmez.

Arrow navigation kapalı modda devre dışıdır.

## Retention

Varsayılan limit 40'tır.

Kullanıcı 10, 20 veya 40 kayıt limitinden birini seçebilir.

0 değeri history'yi tamamen kapatır.

Retention azaltıldığında eski kayıtlar yeni limitte kırpılır.

## Backup

Export kullanıcı tarafından başlatılır.

Export dosyası cihazdan dışarı çıkmak için browser indirme mekanizmasını kullanır.

Uygulama dosyayı kendiliğinden yüklemez.

Import yalnız kullanıcı tarafından seçilen JSON dosyasından yapılır.

## Tehdit sınırı

Başka origin'den gelen storage değerleri uygulama tarafından trusted kabul edilmez.

JSON bozuksa empty fallback kullanılır.

Aşırı uzun değerler bounded hale getirilir.

History verisi prompt injection yürütme mekanizmasına dönüştürülmez.

Bir history kaydı seçildiğinde sadece composer metni olarak yerleştirilir.

## Kullanıcı beklentisi

History kolaylık özelliğidir; kalıcı sohbet arşivi değildir.

Hassas metinler kullanıcı tarafından history'den kapatılmalı veya temizlenmelidir.

Private browsing veya storage kısıtlamalarında history kullanılamayabilir.
