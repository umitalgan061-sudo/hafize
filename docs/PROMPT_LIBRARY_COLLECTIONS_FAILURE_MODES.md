# Koleksiyon Failure Modes

## Storage okunamıyor

Boş koleksiyon veya map fallback'i kullanılır. Prompt library verisi etkilenmez.

## Storage yazılamıyor

Status mesajı gösterilir. Modül başarıyı sessizce iddia etmez.

## Bozuk JSON import

Parse catch bloğu devreye girer. Mevcut veri korunur.

## Aşırı büyük import

Dosya 500 KB sınırını aşarsa FileReader başlatılmaz.

## Duplicate collection name

Yeni kayıt oluşturulmaz. Kullanıcıya açık hata mesajı verilir.

## Duplicate collection ID

Import sırasında yeni ID üretilir.

## Stale assignment

Render öncesi valid collection ve prompt IDs ile prune edilir.

## Prompt silme

Assignment mapping'deki stale prompt ID sonraki reconciliation'da kaldırılır.

## Collection silme

Assignment'lar çıkarılır; prompt kaydı korunur.

## Observer yok

MutationObserver bulunmayan ortamda mevcut ilk render yine çalışır; dinamik re-render sonrası enhancement sınırlı olabilir.

## Clipboard veya diğer prompt enhancement sorunları

Koleksiyon modülü ayrı tutulduğu için kopyalama özelliğinin hatası assignment verisini bozmaz.

## PWA cache eskiyse

Sayfa eski shell ile açılabilir. Service worker yeni asset listesini sonraki activation döngüsünde alır.

## Kullanıcı iptali

Silme onayı veya import dosyası seçimi iptal edilirse state değişmez.
