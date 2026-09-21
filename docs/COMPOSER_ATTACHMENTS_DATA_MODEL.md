# Composer Ekleri — Veri Modeli

## Ana model
Attachment kuyruğu kalıcı veri modeli değildir; yalnız aktif oturum belleğinde tutulur.

| Alan | Tip | Kural |
| --- | --- | --- |
| id | string | ad + byte + lastModified türevi |
| name | string | normalize, en fazla 120 |
| size | number | 1–262144 |
| lastModified | number | File metadata |
| language | string | uzantı eşlemesi |
| content | string | normalize text |
| startLine | number | en az 1 |
| endLine | number | startLine sonrası, en fazla 400 satır |
| selected | boolean | insert kapsamı |

## Normalize
CRLF ve CR satır sonları LF olur. Satır sonu boşlukları ve NUL karakterleri temizlenir.

Tek dosya içerik sınırı 80.000 karakterdir. Toplam queue 200.000 karakterle sınırlıdır.

## Kimlik
Aynı ad + boyut + lastModified kombinasyonu mevcut kuyrukta tekrar eklenmez. Bu kalıcı kullanıcı ID'si değildir.

## Aralık
Range clamp işlemi kullanıcı inputunun yanlış veya aşırı değerlerini güvenli sınıra çeker. 400 satır üstü tek payload üretilemez.

## Serileştirme
Composer çıktısı dosya adı, seçilen aralık ve fenced code block biçiminde oluşturulur.

İçerikte üç backtick varsa dört backtick fence kullanılır.

## Kalıcı veri
Attachment metadata'sı conversation kaydına yazılmaz. Kullanıcı eklenen metni gönderirse ortaya çıkan normal mesaj conversation history'ye girebilir.

## Gelecek migration
Kalıcı attachment özelliği istenirse ayrı bir namespace ve açık opt-in migration gerektirir. Mevcut in-memory model sessizce kalıcı modele dönüştürülmemelidir.