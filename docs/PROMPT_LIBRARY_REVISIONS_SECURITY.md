# Revision History Security

## Güven sınırı

Revision history tamamen tarayıcı tarafındadır. Backend endpoint, fetch, XMLHttpRequest, WebSocket ve connector çağrısı kullanmaz.

## DOM güvenliği

Revision başlığı, gövdesi, tarihleri ve etiketleri kullanıcı verisi olduğu için `textContent`/form value ile ekrana aktarılır. Kullanıcı metni HTML olarak çalıştırılmaz.

## Depolama güvenliği

JSON parse hataları kontrollü şekilde boş store'a düşer. Storage yazma hatası uygulamanın ana sohbet akışını kesmez.

## Veri sınırları

Uzun body 8000 karaktere kırpılır. Etiketler ve prompt id'leri sabit sınırlarla normalize edilir. Revision sayısı prompt başına 10 ile sınırlıdır.

## Export

Export yalnızca açıkça kullanıcı tarafından istenir. Oluşturulan Blob uzak sunucuya gönderilmez. Dosya adı sabittir; kullanıcı verisi dosya adında kullanılmaz.

## Restore

Geri yükleme öncesinde onay sorulur. Mevcut prompt önce manual snapshot'a alınır. Böylece yanlış restore işlemi tekrar tersine çevrilebilir.

## Yetki

Revision geçmişi yalnız mevcut tarayıcı profiline erişimi olan kullanıcı için görünür. Dış servis yetkisi veya OAuth scope gerektirmez.

## Tehditler

Kötücül HTML, aşırı uzun veri, bozuk JSON, revision id çakışması ve storage quota hataları ana savunma alanlarıdır. Normalizasyon ve bounded retention bu riskleri sınırlar.
