# Health Center Performans

## Amaç

Tanı paneli kullanıcı arayüzünü dondurmadan küçük ve bounded bir veri kümesini incelemelidir.

## Limitler

Prompt adayları 240 kayıt üzerinde okunup ilk 120 ile değerlendirilir.

Koleksiyonlar en fazla 80 aday olarak işlenir.

Revizyonlar en fazla 1200 adaydan sonra 600 kayıtla sınırlandırılır.

Issue listesi 240 kayıtla sınırlıdır.

## Benzerlik

Yakın tekrar analizi token kümeleriyle yürür.

Her prompt çifti için token setleri en fazla 240 kelimelik sınır kullanır.

Tarama 120 prompt üst sınırına bağlı olduğu için maliyet kontrollüdür.

## Render

Sorun listesinde en fazla 80 görünür satır oluşturulur.

Uzun detaylar DOM'a sınırsız olarak aktarılmaz.

## Export

Health report 240000 karakterlik çekirdek sınıra ve enhancement tarafında 900000 karakterlik dosya sınırına tabidir.

## Storage

Health state küçük bir JSON nesnesidir.

Prompt metinleri health state'e kopyalanmaz.

## PWA

Assetler shell cache'e alınarak panelin statik yükü ağ bağlantısından bağımsız hale getirilir.

API response'ları cache'lenmez.

## Kabul ölçütü

120 prompt ile tarama, normal cihazlarda görünür UI gecikmesi yaratmayacak kadar küçük bir bounded iş yükü olmalıdır.
