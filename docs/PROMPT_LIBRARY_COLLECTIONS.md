# İstem Kütüphanesi Koleksiyonları

## Amaç

Koleksiyonlar, yerel İstem Kütüphanesi kayıtlarını görev alanlarına göre gruplamak için kullanılır. Özellik backend'e yeni bir veri kaynağı eklemez.

## Kullanıcı davranışı

Kullanıcı yeni koleksiyon oluşturabilir, adını değiştirebilir ve koleksiyonu silebilir. Koleksiyon silindiğinde ona bağlı istemler korunur ve koleksiyonsuz kalır.

Bir istem tek bir koleksiyona atanabilir. İstem aynı anda sınırsız koleksiyona çoğaltılmaz; bu bilinçli olarak basit bir klasör modelidir.

Filtre üzerinden tek koleksiyon, koleksiyonsuz kayıtlar veya tüm kayıtlar gösterilebilir. Filtre ana prompt listesinin görünürlüğünü değiştirir; prompt verisi silinmez.

## Saklama

Koleksiyon tanımları `hafize.prompt-library.collections.v1` anahtarında tutulur. Prompt → koleksiyon eşleşmeleri `hafize.prompt-library.collections.map.v1` anahtarında tutulur.

İki anahtarın ayrı tutulması mevcut prompt veri modelini değiştirmez. Eski prompt yedekleri koleksiyon özelliği olmadan da geçerli kalır.

## Sınırlar

En fazla 24 koleksiyon ve 36 karakterlik koleksiyon adı desteklenir. Atama tablosu bounded biçimde normalize edilir.

İçe aktarma dosyası 500 KB ile sınırlandırılır. Dışa aktarma aynı sınırı gözeterek atamaları güvenli biçimde kısaltabilir.

## Güvenlik

Dinamik koleksiyon adları `textContent` ile DOM'a yazılır. HTML enjeksiyonu için template string ile markup üretilmez.

Koleksiyon işlemleri tamamen cihaz içi storage üzerinde gerçekleşir. Fetch, XHR, WebSocket veya uzaktan analitik gönderimi eklenmez.

## PWA

Koleksiyon CSS ve JavaScript dosyaları shell cache listesine eklenmiştir. API istekleri yine network-only politika altında kalır.

## Geri alma

UI modülleri kaldırıldığında temel prompt kayıtları korunur. Koleksiyon anahtarları ayrıca saklandığı için rollback sırasında prompt verisini silmek gerekmez.
