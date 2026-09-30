# Smart Fill — Final Review Notu

Bu paket Prompt Library içindeki değişkenli istem kullanımını tek bir kullanıcı akışında toplar.

Kontrol edilen noktalar: erişilebilir dialog, değişken sınırları, canlı önizleme, yerel preset/son değer saklama, eksik değişken doğrulaması, değiştir veya sona ekle aktarımı, kullanım sayacı, panoya kopyalama, discovery etiketi ve PWA cache entegrasyonu.

Güvenlik açısından prompt gövdesi ile değişken değerleri DOM'a güvenli API'lerle yazılır. Otomatik gönderim yoktur ve dış ağ çağrısı eklenmez.

Geriye uyumluluk açısından Smart Fill bulunmasa bile ana Prompt Library kayıt formatı aynı kalır. Ek yerel anahtarlar bozuksa güvenli boş varsayılanlar kullanılır.

Kabul ölçütü: kullanıcı değişkenli bir istemi seçtiğinde değerleri kontrollü bir panelde doldurabilmeli, önizleyebilmeli ve sonucu mevcut sohbet taslağına göndermeden aktarabilmelidir.
