# Composer Ekleri — Gizlilik SSS

### Dosyam sunucuya yükleniyor mu?
Dosya seçildiğinde attachment modülü ayrı bir upload isteği yapmaz.

### Dosya cihazda kalıcı saklanıyor mu?
Hayır. Bekleyen attachment içeriği browser memory'de tutulur ve localStorage'a yazılmaz.

### Paneli kapatırsam dosya silinir mi?
Kapanış yalnız görünümü değiştirir. Bekleyen içerik expiry süresine kadar memory'de kalabilir.

### Dosyam ne zaman sunucuya gidebilir?
Kullanıcı içeriği composer'a açıkça ekledikten ve normal mesaj gönderimini başlattıktan sonra chat request'inin parçası olabilir.

### Secret uyarısı garanti mi?
Hayır. Scanner yaygın desenleri yakalayan bir warning layer'dır; tam secret detection sistemi değildir.

### Clipboard file desteği yoksa?
Dosya seç veya drag-drop kullanılabilir. Normal text paste bozulmaz.

### Dosya geçmişe kaydolur mu?
Attachment queue kalıcı değildir. Gönderilen metin normal sohbet mesajı olarak history'de yer alabilir.

### Service worker dosyayı cache'ler mi?
Hayır. Kullanıcı dosya içeriği shell cache'e girmez.