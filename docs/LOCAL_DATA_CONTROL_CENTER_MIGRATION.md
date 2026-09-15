# Yerel Veri Merkezi — Migration

## İlk kurulum

Mevcut storage anahtarları olduğu gibi okunur. Veri merkezi kullanıcı kayıtlarını yeniden serialize ederek değiştirmez.

## Key versioning

Registry'deki key isimleri feature'ın mevcut sürüm sözleşmesini temsil eder. Bir feature v2'ye geçerken migration sorumluluğu o feature'a aittir.

## Unknown keys

Yeni bir key görüldüğünde veri merkezi onu otomatik temizlemez veya dönüştürmez. Önce ürün sözleşmesine alınması gerekir.

## Schema failure

Parse edilemeyen içerik silinmez. Kullanıcı açıkça clear seçeneğini kullanmadıkça mevcut byte dizisi korunur.

## Storage quota

Migration işlemi yapılmaz; yalnız okunur. Böylece veri merkezi kendi başına quota tüketmez.

## Import interaction

Prompt ve history import süreçleri ilgili modüllerce yönetilir. Data center manifest import etmez ve kullanıcı verilerini yeniden yazmaz.

## Future v2

Yeni registry descriptor'ları eklenebilir. Eski key kaldırılacaksa önce release notu, migration planı ve rollback koşulları tanımlanmalıdır.

## Compatibility goal

Data center eklentisi yokken uygulama davranışı değişmemelidir. Data center mevcutken de temel feature'ların storage şemaları korunur.
