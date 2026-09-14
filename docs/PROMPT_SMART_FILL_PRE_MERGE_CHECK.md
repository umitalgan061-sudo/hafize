# Prompt Smart Fill — Pre-Merge Check

## Değişiklik bütçesi

Base `998547ddc63e8b3a62ad74c3ed49614df62620d4` ile son head arasındaki toplam diff yaklaşık 2.88k değişen satırdır ve 3000 satır sınırının altındadır.

## Özellik kontrolü

- [x] Değişkenli `Kullan` akışı akıllı doldurma paneline yönlenir.
- [x] Değişkensiz istemlerde hızlı aktarım korunur.
- [x] Canlı önizleme `replaceVariables` ile üretilir.
- [x] Yerel değişken setleri sınırlı ve prompt bazlı saklanır.
- [x] Mesaj alanına aktarım otomatik gönderim yapmaz.
- [x] `Escape`, `Tab`, `Shift+Tab` ve `Ctrl/Cmd+Enter` klavye yolları tanımlıdır.

## Güvenlik kontrolü

- [x] Yeni ağ istemcisi eklenmedi.
- [x] Secret veya yetkilendirme header'ı yok.
- [x] Dinamik metin `textContent`/form değeri üzerinden işlenir.
- [x] Storage kayıtları boyut ve adet sınırlarına tabidir.

## PWA ve erişilebilirlik

- [x] JS/CSS shell cache listesine eklenmiştir.
- [x] Dialog başlık ve açıklama ilişkisi kuruludur.
- [x] Preview canlı bölge olarak işaretlidir.
- [x] Mobil, forced-colors ve reduced-motion kuralları vardır.

## Test

Kaynak kontrat testleri, kullanıcı yolculuğu kontrolleri, storage izolasyonu, PWA ve DOM güvenliği testleri commit'e dahil edilmiştir. Bu oturumda tam yerel test komutunun çalıştırılması mümkün olmadığından bu durum PR açıklamasında ayrıca belirtilmelidir.
