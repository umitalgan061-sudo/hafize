# Veri Yaşam Döngüsü

Bir local storage yüzeyi oluşturulduğunda privacy allowlist değerlendirmesi yapılır.

Kullanıcı verisi üretim sırasında localStorage'a yazılır. Privacy Center bu veriyi okurken yalnız byte ve varlık bilgisi çıkarır.

Temizleme sırasında ilgili exact veya prefix anahtarları kaldırılır. Bilinmeyen anahtarlar korunur.

Workspace Backup ile veriler bağımsız olarak dışa aktarılabilir. Privacy Center rollback mekanizması değil bir yönetim yüzeyidir.

Kod rollback'i storage rollback'i değildir. Kullanıcı verisinin korunması bu ayrım üzerine kuruludur.

Yeni storage migration'ı var olan değerleri sessizce silmemelidir.
