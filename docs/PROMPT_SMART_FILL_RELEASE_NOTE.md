# Prompt Smart Fill — Release Note

## Kapsam

Bu sürüm, yerel Prompt Library'deki değişkenli istemlerin kullanımını daha kontrollü ve erişilebilir hale getirir.

## Kullanıcıya görünen değişiklik

Değişken içeren bir istemin `Kullan` akışı, tarayıcıya ait ham `prompt()` penceresine bağlı kalmadan uygulama içindeki akıllı doldurma panelini kullanır. Her değişken ayrı bir alanda doldurulur ve sonuç canlı önizlemede görünür.

## Hızlı kullanım

Değişkensiz istemlerde doğrudan composer aktarımı korunur. Değişkenli istemlerde kullanıcı alanları doldurur, önizlemeyi kontrol eder ve `Mesaja aktar` ile sonucu composer'a gönderir. Uygulama otomatik submit yapmaz.

## Tekrar kullanım

Kullanıcı, belirli bir istem için değişken değerlerinden oluşan yerel setler kaydedebilir. Setler yalnızca aynı cihazdaki local storage alanında tutulur; en fazla altı set ve değişken başına 1000 karakter saklanır.

## Güvenlik ve gizlilik

Akıllı doldurma katmanı sunucu çağrısı yapmaz. Değerler analytics, telemetry veya backend prompt geçmişine gönderilmez. Dinamik metin DOM'a güvenli düğüm ve form değerleri üzerinden yazılır.

## PWA ve uyumluluk

Yeni asset'ler service worker shell listesine dahil edilmiştir. Mobil ekranlar, forced-colors ve reduced-motion modları için stiller bulunur. Focus yönetimi `Escape`, `Tab`, `Shift+Tab` ve `Ctrl/Cmd+Enter` akışlarını kapsar.

## Doğrulama

Kaynak, limit, storage izolasyonu, preset veri şekli, preview, intercept, no-submit, DOM güvenliği, accessibility, PWA ve kullanıcı yolculuğu kontrat testleri sürüme eşlik eder.
