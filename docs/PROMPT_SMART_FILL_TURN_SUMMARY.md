# Prompt Smart Fill — Tur Özeti

Bu tur, yerel Prompt Library içindeki değişkenli istemleri daha kontrollü biçimde kullanmak için hazırlanmıştır.

## Ürün davranışı

`Kullan` düğmesine basılan değişkenli istemler erişilebilir bir modal/panel üzerinden açılır. Panel değişkenleri ayrı alanlarda toplar, canlı önizleme üretir ve tamamlanan istemi `#messageInput` alanına aktarır. Gönderme işlemini tetiklemez.

Değişkensiz istemlerde mevcut hızlı kullanım davranışı korunur. Değer alanları 1000 karakterle, değişken sayısı 12 ile sınırlandırılır. Panelde en fazla 6 yerel değişken seti tutulabilir.

## Yerel preset davranışı

Değişken setleri yalnızca cihazın local storage alanında tutulur. Prompt içeriği veya değerler uzak servise gönderilmez. Kullanıcı setleri seçebilir, yeniden kullanabilir, silebilir ve önizlemeyi panoya kopyalayabilir.

## Erişilebilirlik

Panel `dialog` semantiği, başlık/açıklama ilişkisi, canlı önizleme, `Escape` ile kapanma, `Tab` odak döngüsü ve klavye ile alanlar arasında ilerleme desteği sağlar. Mobil, forced-colors ve reduced-motion durumları için CSS kuralları vardır.

## Güvenlik

Yeni katman ağ çağrısı açmaz. `fetch`, XHR, WebSocket, Authorization veya secret kullanımına ihtiyaç duymaz. Dinamik kullanıcı verileri DOM'a `textContent`/form değeri üzerinden yazılır.

## PWA

Yeni JS/CSS varlıkları service worker shell politikasına dahil edilmiştir. API yolları mevcut network-only politikası altında kalır.

## Test kapsamı

Kaynak, DOM güvenliği, limitler, değişken dönüşümü, preset veri şekli, erişilebilirlik, focus, intercept, no-submit, PWA, storage izolasyonu, hata durumları ve uçtan uca kullanıcı yolculuğu için ayrı statik kontrat testleri eklenmiştir.

Tam `npm run check` bu geliştirme oturumunda yerel çalışma alanı üzerinden çalıştırılamamıştır; PR doğrulaması GitHub tarafındaki mevcut kontroller ve kaynak kontratlarıyla sınırlandırılmıştır.
