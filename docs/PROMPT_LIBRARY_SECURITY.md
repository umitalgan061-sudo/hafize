# Prompt Library Güvenlik Sözleşmesi

## 1. Veri sınırı

Prompt Library yalnızca tarayıcı `localStorage` kullanır.

Yeni bir API endpoint'i açmaz ve sunucuya prompt göndermez.

`hafize.conversations.v1` ile paylaşılan bir veri yapısı kullanmaz.

Bir storage write başarısız olduğunda mevcut sohbet verisi değiştirilmez.

## 2. HTML güvenliği

Prompt başlığı, gövdesi, etiketleri ve değişken değerleri güvenilmeyen metin kabul edilir.

Dinamik değerler `textContent` veya form value ile yazılır.

Prompt gövdesinin kendisi HTML olarak parse edilmez.

`javascript:`, `data:` gibi URL işlemleri bulunmaz.

## 3. Import sınırı

JSON dosyası 1 MB'tan büyükse işleme alınmaz.

Parse hatasında mevcut kayıt koleksiyonu değiştirilmez.

Kayıtlar import sonrası tekrar normalize edilir.

120 kayıt hard limit olarak korunur.

Aynı id overwrite edilmez; yeni id oluşturulur.

## 4. Değişken sınırı

Değişken adı yalnız `[A-Za-z0-9_-]` kümesine göre temizlenir.

Bir prompt içinde en fazla 12 değişken bulunabilir.

Bir değişken değeri 1.000 karakteri aşamaz.

Eksik değişken değerleri boş string olarak doldurulur.

Kullanıcının girdiği değer otomatik gönderim başlatmaz.

## 5. Export sınırı

Export cihazda Blob üretir.

Dosya adı sabittir ve prompt metninden türetilmez.

1 MB sonrası export fallback'i daha küçük kayıt kümesine indirir.

## 6. Yetki izolasyonu

Prompt Library sohbet silme, agent yönetme veya connector yazma yetkisine sahip değildir.

`Kullan` eylemi yalnızca `#messageInput` değerini değiştirir.

Gönderme butonuna programatik click yapılmaz.

## 7. Clipboard

Kopyalama Clipboard API mevcutsa denenir.

Hata durumunda kullanıcıya durum mesajı verilir.

Clipboard içeriği server'a taşınmaz.

## 8. PWA

Prompt library shell cache'e alınır.

API çağrıları service worker tarafından yine network-only kalır.

Cache sürümü prompt library asset listesi değiştiğinde artırılır.

## 9. Regresyon

Kaynak kontratı yeni network surface oluşmamasını kontrol eder.

DOM kontratı prompt verisinin markup'a dönüştürülmemesini kontrol eder.

Storage kontratı import/export verisinin conversation history'yi ezmemesini kontrol eder.
