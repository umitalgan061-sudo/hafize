# Akıllı Görünüm Sorgu Sözdizimi

Sorgular yerel olarak ayrıştırılır ve Prompt Library kayıtları üzerinde değerlendirilir.

## Normal metin

`araştırma` başlığında, gövdede, etiketlerde veya değişken adlarında bu kelimenin geçtiği kayıtları eşleştirir.
Birden fazla normal kelime verildiğinde tüm kelimeler aranır.
Boşluk içeren ifadeler çift tırnakla tek parça yapılabilir.

## Etiket

`tag:rapor` etiketi `rapor` olan kayıtları seçer.
`-tag:arşiv` etiketi `arşiv` olmayan kayıtları seçer.
Etiket karşılaştırması Türkçe küçük/büyük harf duyarsız yapılır.

## Favori

`is:favorite` yalnız favorileri seçer.
`is:not-favorite` favori olmayanları seçer.
Eşdeğer biçimler `favorite:true` ve `favorite:false` olarak kabul edilir.

## Değişken

`has:variable` en az bir `{{değişken}}` içeren istemleri seçer.
`has:no-variable` değişken içermeyen istemleri seçer.

## Kullanım

`used:>=3` en az üç kullanım ister.
`used:<5` beşten az kullanım ister.
`used:4` tam dört kullanım ister.
`usage:` öneki de desteklenir.

## Birleştirme

Operatörler aynı sorguda birlikte kullanılabilir.

Örnek:
`tag:kod used:>=3 has:variable is:favorite`

Bu ifade, kod etiketli, en az üç kez kullanılmış, değişken içeren ve favori istemleri seçer.

## Güvenlik

Bilinmeyen operatörler sorgunun normal metin parçası olarak ele alınır.
Sorgu uzunluğu 180 karakterle sınırlandırılır.
Değişken isimleri veya etiketler HTML olarak yorumlanmaz.
Sorgu değerlendirmesi ağ isteği oluşturmaz.

## Core arama uyumluluğu

Akıllı görünüm uygulandığında operatörler core search alanına ham biçimde yazılmaz.
Normal metin parçaları core aramasına aktarılır.
Etiket, kullanım ve değişken gibi ikinci katman koşullar görünüm filtresinde ayrıca uygulanır.

## Öncelik

Önce sorgu ayrıştırılır.
Sonra normal metin, etiket, favori ve değişken koşulları birlikte değerlendirilir.
Son olarak görünümün minimum/maksimum kullanım aralığı ve sabitlenmiş core filtreleri uygulanır.

Bu sıra deterministik olmalı ve aynı istem kümesine aynı sonucu vermelidir.