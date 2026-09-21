# Composer Ekleri — Güvenlik SSS

### Neden dosya okumadan önce boyut kontrol ediliyor?
Büyük dosyanın gereksiz biçimde memory'e alınmasını önlemek için.

### Secret scanner dosyayı gönderiyor mu?
Hayır. Scanner browser memory içinde pattern arar.

### Uyarıyı kapatınca dosya gönderiliyor mu?
Hayır. Cancel seçimi insert işlemini iptal eder.

### Secret scanner tüm anahtarları bulur mu?
Hayır. Bu yalnız yaygın patternlere dayalı bir warning katmanıdır.

### Dosya adı güvenli mi?
Slash ve kontrol karakterleri normalize edilir ve DOM'a text olarak yazılır.

### Attachment localStorage'a yazılıyor mu?
Hayır. Staged queue kalıcı değildir.

### Insert formu submit ediyor mu?
Hayır. Yalnız input event'i yayınlanır.

### Cache'de dosyam kalır mı?
Kullanıcı dosya içeriği shell cache'e yazılmaz.