# Health Center QA

## Fonksiyonel

Boş storage açıldığında panel sağlıklı başlangıç durumu vermelidir.

Geçerli prompt dizisi doğru prompt sayısını göstermelidir.

Bozuk kayıtlar hata sayacını artırmalıdır.

Yinelenen id kayıtları görünür olmalıdır.

Yinelenen başlık ve gövde uyarı üretmelidir.

Yakın tekrar algoritması bounded çalışmalıdır.

Etiketsiz kayıt uyarı üretmelidir.

Uzun gövde uyarı üretmelidir.

Sıfır kullanım bilgi bulgusu üretmelidir.

Eski kayıt bilgi bulgusu üretmelidir.

Koleksiyon yetimleri warning üretmelidir.

Yetim revizyonlar warning üretmelidir.

## Onarım

Onarım kullanıcı onayı olmadan çalışmamalıdır.

Onarım geçerli kayıtları kaybetmemelidir.

Onarım sonrası yeni sağlık raporu üretilmelidir.

Koleksiyon üyesi olmayan prompt'lar ana Prompt Library'de korunmalıdır.

## Güvenlik

Prompt metni HTML olarak yorumlanmamalıdır.

Rapor indirme boyutu bounded olmalıdır.

Problemli prompt export yalnızca error/warning eşleşen kayıtları içermelidir.

API, fetch, XMLHttpRequest ve WebSocket kullanılmamalıdır.

## Erişilebilirlik

Başlık bağlantısı ve status rolü bulunmalıdır.

Severity filtresi klavye ile kullanılmalıdır.

Forced-colors kuralı bulunmalıdır.

## PWA

Health CSS ve JS shell asset listesinde bulunmalıdır.

Yeni cache sürümü tanımlanmalıdır.

API istekleri network-only kalmalıdır.

## Lifecycle

Panel tek örnek olmalıdır.

Storage değişiminde yeniden çizilmelidir.

Destroy çağrısı event listener'ları kaldırmalıdır.
