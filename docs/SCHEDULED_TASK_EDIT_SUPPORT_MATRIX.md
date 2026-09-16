# Schedule Edit Support Matrix

| Sorun | Kontrol | Sonraki adım |
|---|---|---|
| Edit düğmesi yok | status scheduled mi | listeyi yenile |
| Kaydetme reddedildi | hata kodu | formu düzelt |
| 404 | ownership/id | doğru hesapla tekrar aç |
| 409 | execution başladı mı | edit yerine yeni plan |
| 400 | field/date/task | validation düzelt |
| 500 | persistence | runtime/storage kontrol |
| Bulk başarısız | x/y mesajı | kalanları yeniden dene |
| PWA stale | service worker | cache yenile |

Destek ekibi task içeriğini istemeden önce yalnız traceId ve güvenli hata kodunu istemelidir.
