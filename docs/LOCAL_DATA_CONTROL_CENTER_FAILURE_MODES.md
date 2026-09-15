# Yerel Veri Merkezi — Failure Modes

## Storage yok

`localStorage` erişimi exception verirse inspector `unavailable` state döndürür. UI çalışmaya devam eder ve chat akışı etkilenmez.

## Bozuk JSON

Tek bir key parse edilemezse yalnız o alanın sayımı belirsizleşir. Diğer alanlar normal şekilde raporlanır.

## Büyük değer

Tek storage değeri 1.5 MB sınırını aşarsa içerik kesilmiş kabul edilir. Yapısal parse yapılmaz ve daha fazla içerik okunmaz.

## Remove başarısızlığı

`removeItem` exception verirse kullanıcıya başarısızlık bildirilir. Başka alanlar otomatik olarak silinmeye çalışılmaz.

## Confirmation iptali

Kullanıcı confirmation penceresini iptal ederse işlem tamamlanmamış kabul edilir ve storage olduğu gibi kalır.

## Manifest oluşturulamaması

Blob veya Object URL üretimi yoksa manifest indirme başarısız olur. Storage içeriği buna rağmen değişmez.

## Bilinmeyen key

Registry dışında kalan Hafize key'leri görünür bilgi olarak sayılabilir ancak clear işleminin hedefi değildir.

## Duplicate mount

Aynı Settings DOM'una ikinci controller bağlanmak yerine mevcut `CENTER_ID` algılanır ve yeni mount engellenir.

## Late callback

Controller destroy edildiğinde event listener'lar kaldırılır ve UI düğümü silinir. Yeni callback'ler veri merkezine yazmamalıdır.

## PWA cache mismatch

Asset cache'e eklenmemişse yeni UI install/relaunch sonrasında görünmeyebilir. Bu durumda cache version ve shell asset listesi kontrol edilir.
