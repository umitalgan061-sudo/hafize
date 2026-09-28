# Yanıt Yeniden Üretme Güvenlik Notları

## Tehdit yüzeyi
Yüzey tarayıcı içindeki sohbet kontrolüdür. Backend endpoint ve authentication politikası değiştirilmez.

## Veri
Alternatif yanıtlar localStorage konuşma kaydına girer. Regeneration request body alternatif geçmişi ayrı alan olduğu için otomatik olarak göndermez.

## Secret
Model ve ajan kimlikleri metadata olabilir. API key, OAuth secret, cookie, bearer token veya connector credential kaydedilmez.

## XSS
Yanıt mevcut Markdown renderer'dan geçer. Yeni eylem metinleri sabit string'tir. Kullanıcı kontrollü değerler textContent ile yazılır.

## Ağ
Regeneration yalnızca same-origin chat veya agent endpoint'lerini kullanır. Telemetry, analytics ve WebSocket eklenmez.

## Abuse
Global isStreaming guard'ı aynı anda tek üretime izin verir. Tek tıklamayla çoklu stream başlatılamaz.

## Veri kaybı
Başarısız üretimde eski yanıt memory'den geri konur. Başarılı üretimde eski yanıt bounded alternatif listesine yazılır.

## Review
- local storage sınırı
- request endpoint doğrulaması
- empty response recovery
- duplicate history
- no-submit davranışı
