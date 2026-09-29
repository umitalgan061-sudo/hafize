# Model ve Ajan Tercihleri Profil Eylemleri

## Uygula

Model, ajan ve araç modu aktif sohbet ayarlarına taşınır.
Mesaj gönderilmez.
Profil kullanım sayacı bir artırılır.
Son seçim state'i güncellenir.

## Adlandır

Mevcut profil ID'si korunur.
Boş isim kabul edilmez.
İsim üst sınırda normalize edilir.
Model, ajan ve kullanım sayısı korunur.

## Çoğalt

Yeni profil yeni ID alır.
Yeni profil kullanım sayısını sıfırdan başlatır.
Model, ajan ve araç modu kopyalanır.
Kapasite doluysa yeni kayıt eklenmez.

## Sil

Açık onay olmadan silme yapılmaz.
Silme diğer profilleri değiştirmez.
Silinen profil ancak dışa aktarılmış yedekten geri alınabilir.

## Sıralama

Aktif kombinasyon öne gelir.
Sonra kullanım sıklığı dikkate alınır.
Son eşitlik güncelleme zamanıdır.
