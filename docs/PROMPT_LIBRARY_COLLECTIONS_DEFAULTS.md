# Varsayılan Koleksiyon

Varsayılan koleksiyon seçimi isteğe bağlıdır.

Başlangıç değeri "Otomatik atama kapalı"dır.

Bir koleksiyon seçildiğinde bundan sonra oluşan yeni prompt kayıtları, herhangi bir koleksiyona atanmamışlarsa seçilen koleksiyona otomatik atanır.

Mevcut prompt kayıtları seçim değiştiğinde geriye dönük topluca taşınmaz.

Bu ayrım kullanıcı verisinin sessizce yeniden sınıflandırılmasını önler.

Kullanıcı varsayılan koleksiyonu tekrar "Otomatik atama kapalı" yapabilir.

Seçilen koleksiyon daha sonra silinirse default değer güvenli biçimde NONE'a döner.

Default collection storage `hafize.prompt-library.collections.default.v1` anahtarında tutulur.

Varsayılan seçim prompt gövdesini değiştirmez; yalnızca prompt ID → collection ID map'ine yeni kayıt ekleyebilir.

Yeni prompt algılama mevcut prompt ID snapshot'ı ile yapılır.

Sayfa ilk açıldığında mevcut promptlar known set'e alınır; bu nedenle eski kayıtlar otomatik atanmaz.

Testlerde özellikle iki senaryo ayrıştırılmalıdır: ilk açılıştaki mevcut kayıtlar ve sonradan eklenen kayıtlar.

Import sırasında yeni promptlar doğrudan oluşturulmadığı için default davranış import'a sessizce uygulanmamalıdır.

Default seçim bir kullanıcı tercihi olarak local storage'da tutulur ve backend'e gönderilmez.
