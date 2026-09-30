# Akıllı Görünümler

Akıllı Görünümler, Prompt Library içindeki tekrar kullanılan filtreleri isimlendirip cihaz üzerinde yeniden uygulanabilir hale getirir.

## Kapsam

- Mevcut Prompt Library arama, etiket, favori ve sıralama durumunu görünüm olarak kaydetmek.
- Kullanım sayısı ve değişken varlığı gibi ikinci katman filtreleri desteklemek.
- `tag:`, `-tag:`, `is:favorite`, `has:variable` ve `used:` operatörlerini değerlendirmek.
- Görünümleri sabitlemek, çoğaltmak, yeniden adlandırmak ve silmek.
- Görünüm verilerini JSON ile yedekleyip geri yüklemek.
- Son kullanılan görünümlerin yerel geçmişini tutmak.
- Görsel sorgu oluşturucuyla operatör yazmadan görünüm oluşturmak.

## Veri konumu

Görünüm tanımları `hafize.prompt-library.smart-views.v1` anahtarında tutulur.
Panel durumu `hafize.prompt-library.smart-views.v1.state` anahtarındadır.
Kullanım geçmişi `hafize.prompt-library.smart-views-history.v1` altında tutulur.

## Kullanıcı davranışı

Görünüm uygulamak sohbet göndermez.
Composer yalnız görünümün temsil ettiği filtrelerle eşleşen istemleri gösterir.
Silme işlemi görünümü kaldırır; istem kayıtlarını silmez.
İçe aktarma mevcut görünümleri ada göre korur ve çakışan kayıtları atlar.

## Sınırlar

En fazla 24 görünüm tutulur.
Görünüm adı 72 karakterle sınırlıdır.
Açıklama 180 karakterle sınırlıdır.
Gelişmiş sorgu 180 karakterle sınırlıdır.
Yedek 300 KB ile sınırlandırılır.
Geçmiş en fazla 20 giriş tutar.

## Ürün kabul kriterleri

Bir görünüm yeniden açıldığında aynı filtre mantığı korunmalıdır.
Operatörler normal metin aramasını yanlışlıkla bozmayacak şekilde ayrıştırılmalıdır.
Aynı cihazdaki iki pencere storage değişikliklerini yeniden render edebilmelidir.
PWA shell görünüm modüllerini cache'leyebilmelidir.
DOM'a yazılan kullanıcı verisi `textContent` veya form değerleri üzerinden güvenli biçimde oluşturulmalıdır.

## Kapsam dışı

Sunucu taraflı görünüm depolama yoktur.
Kullanıcılar arasında görünüm senkronizasyonu yoktur.
Telemetry veya analytics çağrısı yoktur.
Görünüm uygulamak mesaj göndermez.

Ayrıntılı kurallar için diğer `PROMPT_SMART_VIEWS_*.md` belgelerine bakılır.