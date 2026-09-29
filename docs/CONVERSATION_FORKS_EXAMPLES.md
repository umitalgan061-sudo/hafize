# Konuşma Dalları Örnekleri

## Araştırma sorusu
Kullanıcı bir araştırma sohbetinde assistant cevabının ortasında alternatif bir yaklaşım denemek ister. O mesajın altından fork açar ve ikinci yolu ayrı bir conversation olarak ilerletir.

## Kod incelemesi
Bir bug analizinden sonra belirli user mesajına kadar olan bağlam korunur. Yeni dalda aynı başlangıç korunurken sonraki mesajlar farklı olabilir.

## Karar karşılaştırması
Bir assistant cevabından iki ayrı devam yolu çıkarılabilir. Parent kayıt değişmediği için ilk yol referans olarak kalır.

## Derin dallar
Bir fork içinden tekrar fork açılabilir. Dördüncü seviyeden sonra yeni fork reddedilir.

## Doluluk
30 conversation doluyken yeni fork oluşturulmaz; mevcut kayıtların üzerine sessizce yazılmaz.
