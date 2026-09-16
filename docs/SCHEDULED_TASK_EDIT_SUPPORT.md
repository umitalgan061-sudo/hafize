# Schedule Edit Support

## Kullanıcı görevi düzenleyemiyor
Önce kaydın `Planlandı` durumda olduğunu doğrula. `Running`, `Completed`, `Failed` ve `Cancelled` kayıtlar edit edilemez.

## Tarih hatası
Tarayıcı tarih/saat alanı kullanılır. Sunucu yine de ISO tarihi normalize eder ve geçmiş zamanları reddeder.

## Görev güncellenmiyor
Aynı kullanıcı oturumunun schedule principal'ına sahip olduğunu doğrula. Başka kullanıcıya ait kayıtlar 404 olarak döner.

## Credential hatası
Task text içinde düz metin credential bulunuyorsa update reddedilir. Güvenli veri yönetimi kullanılmalıdır.

## Bulk işlem
En fazla 40 planlanmış kayıt seçilebilir. Başarılı ve başarısız tekil işlemler sonuç mesajında sayılır.

## Ağ kesintisi
UI hata mesajını gösterir ve yeniden yenileme yapılabilir. Schedule API no-store kaldığı için eski cache state kullanılmaz.
