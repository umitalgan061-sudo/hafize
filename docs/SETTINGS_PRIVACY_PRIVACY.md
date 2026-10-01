# Veri Minimizasyonu ve Gizlilik

Gizlilik merkezi yeni bir kişisel veri deposu oluşturmaz. Sadece mevcut localStorage alanlarını özetler.

Raporun purpose alanı envanter ve kapasite bilgisidir. Prompt veya sohbet metni rapor formatına dahil edilmez.

Smart Fill gibi değişken değerleri içeren alanlar yüzey düzeyinde sayılır; değerlerin kendisi ekrana veya rapora yazılmaz.

Bilinmeyen anahtarlar için yalnız sayı gösterilmesi, üçüncü taraf veya gelecekteki feature verilerinin accidental disclosure riskini azaltır.

Gizlilik merkezi tarafından üretilen dosya kullanıcının açık download/copy eylemiyle oluşur. Backend endpoint'i, analytics olayı veya telemetry kaydı oluşturulmaz.

Feature gelecekte remote sync kazanırsa bu doküman ve consent modeli yeniden tasarlanmalıdır.
