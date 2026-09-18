# Import failure modes

| Durum | Sonuç |
| --- | --- |
| Dosya yok | İşlem yapılmaz |
| 1 MB üstü | Önizleme hata durumu |
| Geçersiz JSON | Yazma yapılmaz |
| Geçersiz prompt | Skip |
| ID çakışması | Yeni ID |
| Kapasite dolu | Kalanlar skip |
| Storage yazma hatası | Mevcut veri korunur |
| Kullanıcı iptal | Yazma yapılmaz |

Hata mesajları kısa ve eyleme dönüktür. Import katmanı sunucuya bağımlı değildir.
