# Kötüye Kullanım Senaryoları

### Sahte bilinmeyen key

Bir üçüncü taraf script localStorage'a credential benzeri bir alan ekler. Privacy center bunu tanımaz, sadece bilinmeyen sayaçta gösterir ve toplu silmez.

### Zehirli prompt başlığı

Prompt başlığı HTML benzeri içerik taşır. Panel bunu textContent ile gösterir.

### Büyük storage

Tarayıcı yüzlerce anahtar döndürür. Inventory 300 anahtarla bounded kalır.

### Silme yarış koşulu

Başka bir kod aynı key'i silmiştir. removeItem tekrarlandığında panel bütün storage reset yapmaz.

### Clipboard kapalı

Kullanıcı raporu kopyalamayı seçer fakat Clipboard API yoktur. Veri başka kanala gönderilmez.

### Kota doluluğu

navigator.storage.estimate yüzde değeri yüksek döner. Panel kullanıcıya kapasite uyarısı verir; otomatik silme yapmaz.
