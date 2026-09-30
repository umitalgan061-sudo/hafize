# Akıllı Görünümler Gizlilik

Akıllı Görünümler yerel-first bir özelliktir.

## Saklananlar

Cihazda görünüm adı, açıklama, filtre değerleri ve görünüm kullanım geçmişi tutulur.
Prompt içeriği görünüm kaydının kendisine kopyalanmaz.
Görünüm geçmişi yalnız görünüm adı ve yerel id gibi sınırlı metadata içerir.

## Saklanmayanlar

API anahtarları saklanmaz.
OAuth token saklanmaz.
GitHub credential saklanmaz.
Sunucu yanıtları görünüm storage'ına yazılmaz.

## Network

Görünüm kaydetme, uygulama, düzenleme, silme, import/export ve geçmiş işlemleri yeni backend endpoint'i çağırmaz.
PWA shell yalnız statik asset'leri cache'ler.

## Aynı cihaz

İki sekme arasında browser storage değişikliği için storage event'i kullanılır.
Aynı sekmedeki yardımcı modüller kontrollü custom event veya StorageEvent benzeri refresh mekanizması kullanabilir.

## Yedekler

JSON dışa aktarma kullanıcı cihazında indirme oluşturur.
Dosya kullanıcı tarafından seçilmedikçe okunmaz.
İçe aktarma boyutu 300 KB ile sınırlıdır.
İçe aktarılan içerik normalize edilir.

## Güvenlik

Kullanıcı verisi dinamik DOM HTML'i olarak birleştirilmez.
Metin alanlarında textContent tercih edilir.
Sorgu operatörleri whitelist yaklaşımıyla ayrıştırılır.
Bilinmeyen sözdizimi normal metin olarak kalır.

## Telemetry

Kullanım geçmişi veya görünüm uygulama sayaçları uzaktaki analytics servisine gönderilmez.
Herhangi bir network entegrasyonu eklenmesi ayrı kullanıcı/onay ve gizlilik tasarımı gerektirir.