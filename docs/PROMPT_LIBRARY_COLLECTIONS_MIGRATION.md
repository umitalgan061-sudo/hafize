# Koleksiyon Migration Planı

Bu sürüm yeni bir prompt item alanı eklemez.

Migration yalnızca collection storage anahtarlarının ilk kullanımda oluşturulmasına dayanır.

## Eski kullanıcı

Eski Prompt Library verisi aynen okunur. Koleksiyon modülü yoksa prompt davranışı değişmez.

## İlk açılış

`hafize.prompt-library.collections.v1` yoksa boş dizi varsayılır.

`hafize.prompt-library.collections.map.v1` yoksa boş nesne varsayılır.

## Geriye dönük veri

Yeni modül kaldırılırsa eski prompt library kaydı okunmaya devam eder. Collection metadata kullanılmasa bile ana prompt storage'ı bozulmaz.

## Import migration

Eski collection export formatında version alanı eksikse normalizeImported yalnızca beklenen object yapısını kabul eder.

Tanımlanamayan alanlar yoksayılır.

## İsim çakışması

Import sırasında aynı isimli koleksiyon mevcutsa yeni koleksiyon yaratılmaz. Mevcut koleksiyonun ID'si korunur.

## ID çakışması

Aynı ID farklı isimle gelirse yeni ID atanır ve import edilen assignment'lar yeni ID'ye çevrilir.

## Rollback

Rollback için data migration geri çevrilmez. UI geri alınır; collection storage anahtarları pasif kalabilir.

## Temizlik

Stale assignment'lar mevcut prompt IDs ve mevcut collection IDs üzerinden prune edilir.

Bu işlem prompt gövdesine dokunmaz.
