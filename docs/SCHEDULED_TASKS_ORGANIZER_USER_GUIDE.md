# Zamanlanmış Görev Organizer — Kullanıcı Rehberi

## Açma

Görevler menüsünü açın veya `Ctrl / ⌘ + Shift + T` kullanın.

Klavye kısayolu input, textarea, select ve contenteditable alanlarında devre dışıdır.

## Arama

`Görevlerde ara…` alanı görev başlığı ve satır metninde arama yapar.

Arama anlık uygulanır.

Boş arama bütün görevleri gösterir.

## Ajan filtresi

Ajan filtresi mevcut ajan seçeneklerinden ve server listesindeki ajanlardan oluşturulur.

`Tüm ajanlar` seçildiğinde ajan sınırlaması kaldırılır.

Geçersiz saklanmış ajan değeri otomatik olarak tüm ajanlara döner.

## Sıralama

Yaklaşan görevler en erken `runAt` değerini öne çıkarır.

Uzaklaşan görevler en geç zamanı öne çıkarır.

Duruma göre görünüm; planlandı, çalışıyor, başarısız, tamamlandı ve iptal edildi sırasını kullanır.

Görev adına göre görünüm Türkçe locale sıralaması kullanır.

## Zaman penceresi

Bugün, sonraki 24 saat, sonraki 7 gün ve geçmiş filtreleri görev zamanına uygulanır.

Geçmiş seçimi plan zamanı geçmiş tüm kayıtları gösterir.

Zaman penceresi server durumunu değiştirmez.

## Görünümler

Görünümü kaydet seçeneği mevcut filtre ve sıralamayı kısa isimle saklar.

En fazla altı görünüm tutulur.

Aynı isim yeniden kaydedildiğinde mevcut görünüm güncellenir.

Preset silmek yalnızca cihazdaki görünüm ayarını kaldırır.

## Toplu seçim

`Planlananları seç` yalnızca görünür ve iptal edilebilir görevleri seçer.

Seçilen görevler anlık panel sayacında gösterilir.

`Seçimleri temizle` seçimi kaldırır.

Toplu iptal öncesi kullanıcı onayı gerekir.

## Dışa aktarma

`Görünürleri dışa aktar` server listesini tekrar okur ve görünür görevleri JSON dosyası olarak indirir.

Export içinde yalnızca server'ın döndürdüğü kayıtlar kullanılır.

Organizer export verisini localStorage'a yazmaz.

## Tek görev işlemleri

`Metni kopyala` yalnızca görev metnini clipboard'a gönderir.

`Ayrıntı` görev için durum, ajan, zaman ve trace özetini gösterir.

Ayrıntı ekranındaki JSON kopyalama da yalnızca kullanıcı tıklamasıyla gerçekleşir.

`Çoğalt` mevcut organizer modülünden gelir ve kullanıcı onayıyla yeni planlama oluşturur.

## Hata durumları

Oturum süresi dolarsa kullanıcıya kimlik doğrulama mesajı gösterilir.

Clipboard kullanılamıyorsa görev panoya kopyalanmadan hata bildirimi verilir.

Sunucu hataları görevleri yerelde uydurmaz; mevcut server mesajı genel kullanıcı açıklamasına dönüştürülür.

## Gizlilik

Organizer görev metnini localStorage'a kopyalamaz.

Kayıtlı görünüm task içeriği, trace ID veya agent secret içermez.

Export kullanıcı tarafından açıkça başlatılır.

## Mobil

Dar ekranlarda organizer kontrolleri iki sütuna iner.

Ayrıntı paneli alt-sheet benzeri yerleşime geçer.

Toplu işlem düğmeleri dokunma hedefini koruyacak şekilde büyütülür.
