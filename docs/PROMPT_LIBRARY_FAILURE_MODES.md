# Prompt Library Failure Modes

| Durum | Davranış | Kullanıcı mesajı |
| --- | --- | --- |
| Storage okunamıyor | boş/fallback state | gerekirse durum alanı |
| Storage yazılamıyor | mevcut ekran korunur | kalıcı kayıt başarısız |
| JSON bozuk | import uygulanmaz | geçersiz yedek |
| JSON çok büyük | import reddedilir | 1 MB sınırı |
| Duplicate id | yeni id | import devam eder |
| Clipboard yok | işlem reddedilir | kopyalama kullanılamıyor |
| FileReader hata | import uygulanmaz | yedek okunamadı |
| Blob yok | export başarısız | indirme desteklenmiyor |
| Card yok | mount atlanır | ana sohbet çalışmaya devam eder |
| Core yok | starter/enhancement atlanır | ana uygulama çalışmaya devam eder |
| Starter eksik | restore ile eklenir | status bildirilir |
| 120 kayıt dolu | yeni kayıt reddedilir/normalize edilir | sınır bilgisi |
| 40 seçim dolu | yeni seçim reddedilir | seçim sınırı |
| Boş body | kayıt reddedilir | istem metni boş olamaz |
| Geçersiz sort | default sort | görünüm korunur |
| Geçersiz değişken | normalize edilir | prompt kullanılabilir kalır |

## İlke

Prompt Library hatası uygulamanın geri kalanını bozacak global exception üretmemelidir.

Import ve storage hataları conversation history üzerinde yan etki oluşturmamalıdır.

Enhancement katmanı yoksa core prompt işlemleri yine kullanılabilir kalmalıdır.
