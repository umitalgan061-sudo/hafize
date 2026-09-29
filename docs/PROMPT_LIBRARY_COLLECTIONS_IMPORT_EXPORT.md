# Koleksiyon Import / Export

## Export şeması

Payload şu alanları içerir:

`version`: 1

`source`: hafize-prompt-library-collections

`exportedAt`: ISO zaman

`collections`: collection listesi

`assignments`: prompt-to-collection map

## Import akışı

Dosya seçilir, 500 KB üzerinde ise reddedilir.

FileReader ile metin okunur. JSON parse başarısızsa mevcut veri korunur.

Collections normalize edilir, duplicate isimler mevcut koleksiyonlara bağlanır.

Assignment map yalnızca import edilen geçerli collection isimleri üzerinden hedef ID'ye çevrilir.

## Veri güvenliği

Import prompt içeriklerini değiştirmez. Yalnızca collection tanımları ve assignment ilişkileri eklenir.

## Boyut sınırı

Export payload sınırı aşarsa tüm collection listesi korunurken assignment girdileri bounded biçimde azaltılır.

## Kullanıcı iletişimi

Başarılı import kaç yeni koleksiyon geldiğini raporlar.

Geçersiz dosya "Geçersiz koleksiyon yedeği." mesajı ile bildirilir.

## Rollback

Export format version 1 olarak tanımlıdır. Daha sonra version 2 gelirse import katmanı version-aware genişletilebilir.
