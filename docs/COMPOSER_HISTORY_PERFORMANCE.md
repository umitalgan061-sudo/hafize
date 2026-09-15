# Composer History — Performans

History küçük ve bounded bir client-side koleksiyondur.

## Storage budget

En fazla 40 kayıt tutulur.

Her kayıt en fazla 12.000 karakterdir.

Storage payload bu nedenle kontrollü bir üst sınıra sahiptir.

Import ayrıca 512 KB ile sınırlandırılır.

## Rendering

Panel açılmadığında liste yeniden çizilmek zorunda değildir.

Arama sonuçları en fazla 40 kayıtla sınırlandırılır.

Metin preview'i 180 karaktere kadar görsel olarak kısaltılır.

Uzun geçmiş metni title attribute'unda da bounded kalır.

## Events

History değişiklikleri custom event ile bildirilir.

Storage event yalnız aynı key için işlenir.

Panel refresh'i kısa bir timer ile coalescing yapar.

Lifecycle destroy tüm listener'ları kaldırır.

## Navigation

Arrow navigation mevcut array üzerinde O(1) cursor hareketidir.

Yeni kayıt ekleme en fazla 40 elemanlık array kopyası üretir.

Deduplication lineer ve sabit boyutlu koleksiyonda çalışır.

## Backup

Export normal JSON stringify kullanır.

Import bounded string üzerinde parse edilir.

Dosya okuma kullanıcı seçimi sonrasında gerçekleşir.

## PWA

Static assets shell cache'e girer.

History API veya remote worker çağrısı eklemez.

## Regression

Performance suite büyük sentetik geçmiş payload'larının kontrollü kaldığını doğrulamalıdır.

60+ kayıt yüklendiğinde render yine 40 kayıtla sınırlandırılmalıdır.

12000+ karakterli girişler storage'a daha uzun yazılmamalıdır.

Storage exception durumunda UI bloke olmamalıdır.
