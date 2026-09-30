# Smart Fill — Yayın Sözleşmesi

## Kabul

Yayınlanacak dal 3000 değişen satırı geçmez. Smart Fill yalnızca Prompt Library içindeki değişkenli istemlerin kullanımını kolaylaştırır.

## UI

Değişkenler ayrı alanlarda doldurulur, önizleme gösterilir, son değerler ve kayıtlı setler cihazda tutulur. Kullanıcı isterse metni değiştirir veya mevcut composer metninin sonuna ekler.

## Veri

Smart Fill verisi local storage ile sınırlıdır. Prompt gövdesi veya değişken değerleri analytics amacıyla sunucuya gönderilmez.

## Güvenlik

Dinamik kullanıcı metni HTML olarak yorumlanmaz. İstem otomatik gönderilmez. Ağ çağrısı eklenmez.

## Operasyon

PWA shell cache sürümü yükseltilir ve yeni JS/CSS varlıkları cache listesine eklenir. Geri alma, ilgili Smart Fill varlıklarını ve entegrasyon satırlarını revert etmekle yapılır.
