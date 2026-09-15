# Revision State Machine

## CLOSED

Revision paneli görünmez durumdadır. Active prompt ve focus referansı tutulmaz.

## OPENING

Kullanıcı `Geçmiş` düğmesine bastığında prompt kaydı güncel storage'dan yeniden çözülür. Kayıt bulunamazsa panel açılmaz.

## OPEN

Panel active prompt ile render edilir. Revision listesi storage'dan okunur. Kapatma düğmesi odaklanır.

## COMPARING

Kullanıcı `Karşılaştır` seçtiğinde mevcut body ile seçili revision yan yana gösterilir. Her iki içerik 2000 karakterle preview edilir.

## RESTORING

Restore öncesi kullanıcı onayı alınır. Mevcut prompt manual snapshot olarak kaydedilir. Ardından seçili revision core normalize fonksiyonu üzerinden uygulanır.

## RESTORED

Başarılı restore sonrası active prompt yeni içerikle yenilenir ve liste tekrar render edilir.

## DELETING_REVISION

Tek revision silme işlemi onay gerektirir. Başarılı işlem sonrası liste yeniden render edilir.

## CLEARING

Tüm history temizleme yalnız aktif prompt id'sini hedefler. Ana prompt kaydı etkilenmez.

## EXPORTING

Export yalnız kullanıcı action'ı ile oluşturulur. Blob URL işlem sonrası revoke edilir.

## ERROR

Storage veya prompt bulunamama hatalarında kullanıcıya status mesajı verilir; mevcut uygulama shell'i exception ile devrilmez.

## DESTROYED

Observer, DOM event listener'ları ve storage listener'ı kaldırılır. Panel DOM'dan silinir ve mount guard temizlenir.
