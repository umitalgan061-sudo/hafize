# Koleksiyon QA Planı

## Fonksiyonel

Yeni koleksiyon oluştur.

Aynı isimle ikinci koleksiyon oluşturmaya çalış.

Koleksiyonu yeniden adlandır.

Koleksiyonu sil ve bağlı prompt'un silinmediğini doğrula.

Prompt'u tekli selector ile koleksiyona ata.

Prompt'u koleksiyondan çıkar.

Birden fazla prompt seçip toplu ata.

Koleksiyon filtresini kullan.

Koleksiyonsuz filtresini kullan.

Export al.

Export dosyasını tekrar import et.

## Veri

Bozuk collection JSON'u yükle.

Bozuk map tipini yükle.

Duplicate ID ver.

Duplicate name ver.

Eksik timestamp ver.

Çok uzun isim ver.

24'ten fazla collection ver.

## Güvenlik

HTML payload gibi görünen koleksiyon adı kullan.

Null karakter içeren isim kullan.

500 KB üstü dosya seç.

Dış network API'sinin çağrılmadığını kontrol et.

## Erişilebilirlik

Screen reader ile filtre ve assignment selector'larını algıla.

Tab sırasını kontrol et.

Enter/Escape editor davranışını doğrula.

Ctrl/Meta+Shift+O kısayolunu editable alanların dışında test et.

## PWA

Koleksiyon CSS/JS shell cache listesinde olsun.

## Regression

Mevcut prompt create/edit/delete, favorite ve import/export akışlarının koleksiyon modülü ile çalışmaya devam ettiğini doğrula.
