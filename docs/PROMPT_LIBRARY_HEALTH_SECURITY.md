# Health Center Güvenlik

## Veri sınırı

Sağlık merkezi yalnızca cihazdaki Prompt Library storage alanlarını okur.

NVIDIA, GitHub, Google, Gmail, Canva veya başka bir dış servise sağlık verisi gönderilmez.

## Secret politikası

Modül hiçbir API anahtarı, cookie, access token veya OAuth credential okumaz.

Health report içeriği prompt metnini varsayılan olarak dışa aktaran bir alan değildir; rapor yalnızca teşhis bulgularını taşır.

Sorunlu prompt dışa aktarma kullanıcı tarafından ayrı bir düğmeyle tetiklenir.

## DOM güvenliği

Kullanıcı kontrollü prompt başlığı, detay veya id değerleri HTML olarak yorumlanmaz.

UI düğmeleri ve metinleri DOM API ile oluşturulur.

## Download sınırı

Rapor ve problemli prompt çıktıları bounded boyutla sınırlandırılır.

Dosya adı kullanıcı metninden doğrudan üretilmez; yalnızca sabit dosya adı şablonları kullanılır.

Object URL işlemi tamamlandıktan sonra serbest bırakılır.

## Onarım

Onarım kullanıcı onayı olmadan çalışmaz.

Onarım mevcut normalizer ve storage API'lerini kullanır; yeni bir veri formatı icat etmez.

Başarısız storage yazımında hata kullanıcıya bildirilir.

## Privacy

Health state anahtarı prompt gövdelerini veya konuşma geçmişini kopyalamaz.

Sağlık taraması analytics veya telemetry event'i oluşturmaz.

## Tehditler

Kötücül biçimlendirme, bozuk JSON, devasa kayıt, yinelenen kimlik ve yetim ilişkiler bounded parser ile ele alınır.

Regex ve benzerlik taraması sınırlı veri kümesinde çalışır.

## Geri alma

Sağlık modülü kaldırıldığında ana storage kayıtları korunur. Sağlık state anahtarı da bağımsız olarak silinebilir.
