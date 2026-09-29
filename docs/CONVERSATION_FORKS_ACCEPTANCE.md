# Konuşma Dalları Kabul Kriterleri

## Kullanıcı akışı
- Her mesajda Buradan dallandır eylemi bulunur.
- Eylem açık bir onay dialogu açar.
- Dialog taşınacak mesaj sayısını ve kısa bir önizlemeyi gösterir.
- Onay verilmeden hafıza/storage değişmez.
- Onay sonrası yeni conversation kaydı oluşur ve uygulama bu kayda geçer.
- Yeni dal kendi başına ağ isteği başlatmaz.

## Bounded davranış
- En fazla 30 conversation korunur.
- Parent başına en fazla 8 doğrudan child vardır.
- Dal derinliği 4 ile sınırlıdır.
- Fork en fazla 100 mesaj taşır.
- Fork metadata alanları kısa ve normalize edilmiş durumdadır.

## Güvenlik
- User content DOM'a textContent ile yazılır.
- Fork modülünde network primitive'i bulunmaz.
- Streaming sırasında işlem reddedilir.
- Storage yazma başarısızsa yeni kayıt oluşturulmaz.

## Erişilebilirlik
- Dialog başlık ve açıklama ile ilişkilidir.
- Escape kapatır.
- Tab/Shift+Tab odak sınırında kalır.
- Enter onaylar.
- Kapanışta focus fork eylemine geri döner.
