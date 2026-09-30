# Akıllı Görünümler Örnekleri

## Kod istemleri

`tag:kod used:>=3`

Kod etiketli ve en az üç kez kullanılan istemleri bırakır.

## Favori araştırmalar

`tag:araştırma is:favorite has:variable`

Araştırma etiketli, favori ve değişken içeren istemleri seçer.

## Kullanılmayan istemleri bulma

`used:0`

Henüz kullanılmamış istemleri gösterir.

## Metin + etiket

`"haftalık rapor" tag:rapor`

Normal metin eşleşmesi ile etiket koşulunu birlikte kullanır.

## Hariç tutma

`-tag:arşiv`

Arşiv etiketli kayıtları sonuçtan çıkarır.

## Kullanım aralığı

`used:>=2 used:<=8`

İki ile sekiz kullanım arasında kalan kayıtları seçer.

## Kalıcılaştırma

Hızlı sorgu oluşturucudaki aynı koşullar “Görünüm olarak kaydet” ile isimlendirilebilir.
Kayıt yeniden uygulandığında sorgu ve core filtreleri birlikte değerlendirilir.

## Güvenlik örneği

Görünüm adı HTML etiketleri içeriyor olsa bile DOM'a textContent olarak yazıldığı için markup çalıştırılmaz.
Sorgu metni backend'e gönderilmez.

## Geri dönüş

Yanlış bir görünüm tanımı üretildiğinde Görünüm sağlığı taranabilir.
Onarım öncesi checkpoint tutulur.
Son onarım geri alınabilir.