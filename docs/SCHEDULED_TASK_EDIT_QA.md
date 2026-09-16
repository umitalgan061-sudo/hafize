# Schedule Edit QA

| Alan | Beklenen |
|---|---|
| Planlandı + sahip | Düzenleme açılır |
| Planlandı + başka sahip | 404 |
| Running | 409 |
| Completed | 409 |
| Failed | 409 |
| Cancelled | 409 |
| Geçmiş tarih | 400 |
| Geçersiz ajan | 400 |
| Credential metni | reddedilir |
| 1–5 deneme | kabul edilir |
| Attempt üstü maxAttempts | kabul edilmez |
| Boş patch | 400 |
| Ek alan | 400 |
| API cache | no-store |
| UI mobile | tek kolon |
| UI keyboard | native focus |

## Smoke
1. Giriş yap.
2. Görev oluştur.
3. Düzenle.
4. Saati ileri al.
5. Kaydet.
6. Listeyi yenile.
7. Değerlerin korunduğunu doğrula.
8. İptal akışının hâlâ çalıştığını doğrula.
