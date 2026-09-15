# Manual Revision QA

## Desktop

1. Prompt Library açılır.
2. Bir prompt için `Geçmiş` görünür.
3. History paneli açılır ve focus kapatma düğmesine gider.
4. `Karşılaştır` iki metni yan yana gösterir.
5. `Sürümü koru` yeni manual snapshot üretir.
6. `Geri yükle` confirmation ister.
7. Restore sonrası current içerik değişir.
8. Favorite ve useCount korunur.
9. `Sil` yalnız seçilen revision'ı kaldırır.
10. `Geçmişi temizle` yalnız aktif history'yi kaldırır.
11. Export JSON indirir.
12. Escape paneli kapatır.
13. Tab odağı dialog içinde kalır.

## Mobile

Panel viewport'a sığar, comparison tek kolona iner ve preview scroll edilir.

## Offline

PWA offline açılışından sonra revision scripti shell cache'ten yüklenir.

## Storage failure

Developer tools ile storage exception simüle edildiğinde ana shell crash olmamalıdır.

## Malicious text

Title/body içine HTML, SVG, script, event attribute benzeri text yazılır. İçerik text olarak kalmalıdır.

## Long input

8000+ karakter body ve 100+ karakter title denendiğinde bounded data görülür.

## Retention

11 snapshot oluşturulduğunda yalnız 10 revision kalır.

## Duplicate

Aynı snapshot tekrar oluşturulduğunda history count değişmez.

## Restore chain

A → B → restore A → restore B akışı denenir. Manual checkpoints sayesinde zincirin kopmadığı doğrulanır.

## Release sign-off

Tüm kritik akışlar başarılı olmadan production release yapılmaz.
