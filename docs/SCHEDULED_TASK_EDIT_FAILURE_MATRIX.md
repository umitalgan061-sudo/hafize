# Schedule Edit Failure Matrix

| Koşul | Backend | UI |
|---|---|---|
| Auth yok | 401 | Oturum mesajı |
| Kayıt yok | 404 | Kaydedilemedi |
| Başka kullanıcı | 404 | Kaydedilemedi |
| Running | 409 | Artık düzenlenemez |
| Geçmiş zaman | 400 | Geçmiş zaman uyarısı |
| Geçersiz ajan | 400 | Ajan uyarısı |
| Credential | 400 | Credential uyarısı |
| Persistence save | 500 | Genel kaydetme hatası |
| PATCH dışı yöntem | 405 | Native akış korunur |
| Bulk kısmi hata | tekil hata | x/y sonucu |

Hata durumlarında mevcut kayıt silinmez ve worker state'i istemci tarafından değiştirilemez.
