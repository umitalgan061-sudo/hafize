# Zamanlanmış Görevler — Kullanıcı Akışları

## Akış 1 — İlk görev

Kullanıcı sol menüde Görevler'i görür.

Görevler paneli açılır.

Ajanlar mevcut seçimden listelenir.

Kullanıcı task metni girer.

Kullanıcı gelecekteki zamanı seçer.

Kullanıcı deneme sayısını seçer.

Kullanıcı planla düğmesine basar.

UI POST request gönderir.

Server schedule oluşturur.

UI listeyi yeniler.

Yeni task Planlandı olarak görünür.

## Akış 2 — Hızlı şablon

Kullanıcı Görevler panelini açar.

Hızlı şablonlardan birini seçer.

Textarea otomatik doldurulur.

Kullanıcı metni özelleştirir.

Kullanıcı zaman seçer.

Submit eder.

Template seçimi tek başına server'a request göndermez.

## Akış 3 — Bekleyen görev

Kullanıcı Planlandı filtrelerini kullanır.

Yaklaşan runAt tarihi görünür.

Countdown metadata zamanı kullanıcıya özetler.

Polling server snapshot'ını günceller.

Worker state değiştirirse UI refresh sırasında değişiklik görünür.

## Akış 4 — Çalışan görev

Worker task'ı claim eder.

Status running olur.

UI sonraki refresh'te Running badge'i gösterir.

Cancel button artık görünmez.

Client task'ı durdurmaya çalışmaz.

## Akış 5 — Başarılı görev

Worker execution tamamlar.

Status completed olur.

UI completed badge gösterir.

Last error boş olabilir.

Cancel button görünmez.

## Akış 6 — Başarısız görev

Worker execution başarısız olur.

Retry mümkünse backend yeniden schedule eder.

Retry mümkün değilse status failed olur.

UI lastError code varsa gösterir.

UI kendi retry request'ini üretmez.

## Akış 7 — İptal

Kullanıcı Planlandı satırında İptal et'i seçer.

Native confirm gösterilir.

Kullanıcı onaylarsa DELETE request gider.

Server state'i cancelled olur.

UI listeyi yeniden okur.

## Akış 8 — İptal yarışı

Kullanıcı cancel seçer.

Worker aynı anda task'ı running yapar.

Server DELETE 409 döndürebilir.

UI görev artık iptal edilemez mesajı gösterir.

UI refresh ile running state'i gösterir.

## Akış 9 — Kimliksiz erişim

Kullanıcı session olmadan panel açabilir.

GET 401 döner.

UI auth mesajı gösterir.

POST öncesi UI agent/task validation yapabilir, ancak server auth son otoritedir.

## Akış 10 — Geçersiz agent

Ajan listesi stale olabilir.

POST 400 INVALID_AGENT döner.

UI görevi oluşturmaz.

Kullanıcı ajan listesini yenileyip yeniden deneyebilir.

## Akış 11 — Geçmiş zaman

Kullanıcı geçmiş datetime seçer.

UI submit'i durdurur.

Server'a POST gönderilmez.

## Akış 12 — Kapasite dolu

Kullanıcı geçerli task girer.

POST 503 SCHEDULE_CAPACITY_REACHED döner.

UI capacity mesajı gösterir.

Form içeriği otomatik temizlenmez.

Operasyon server capacity'yi inceler.

## Akış 13 — Offline

Kullanıcı PWA'yı offline açar.

Static shell yüklenebilir.

Schedule API GET başarısız olur.

UI servis erişim hatası gösterir.

Stale schedule snapshot fake live data olarak gösterilmez.

## Akış 14 — Slow network

Panel açılır.

GET yavaş gelir.

Loading message görünür.

Kullanıcı paneli kapatabilir.

Pending request abort edilebilir.

## Akış 15 — Duplicate click

Kullanıcı planla düğmesine basar.

POST başladıktan sonra submit disabled olur.

İkinci click işlenmez.

Server duplicate prevention'a bağımlı kalınmaz.

## Akış 16 — Keyboard

Kullanıcı Ctrl+Shift+T basar.

Input/textarea/select dışında görev paneli açılır.

Task textarea içinde aynı kombinasyon yazarken panel açılmaz.

Escape paneli kapatır.

Focus mümkün olduğunca önceki elemente döner.

## Akış 17 — Mobile

Kullanıcı dar viewport'ta paneli açar.

Modal alt sheet düzenine iner.

Form tek sütun olur.

Task list scrollable kalır.

Action controls görünür kalır.

## Akış 18 — Screen reader

Dialog adı okunur.

Form field labels okunur.

Status updates polite live region ile aktarılır.

Filter label okunur.

Cancel action açık metinle anlaşılır.

## Akış 19 — Forced colors

System high contrast etkinleşir.

Panel border/text görünür kalır.

Focus outline görünür kalır.

Status anlamı sadece renge bağlı değildir.

## Akış 20 — Reduced motion

OS reduced motion açık olur.

Özel animation uygulanmaz.

Countdown yalnızca metin günceller.

## Akış 21 — Trace support

Kullanıcı failed task görür.

Trace ID düğmesine basar.

UI Trace ID'yi status alanında gösterir.

Support bu ID ile server loglarına bakabilir.

Token veya task secret UI'dan talep edilmez.

## Akış 22 — Refresh after error

GET hata verir.

UI generic failure gösterir.

Kullanıcı Yenile'ye basar.

Yeni GET yapılır.

Server snapshot güncel ise liste tekrar görünür.

## Akış 23 — PWA update

Yeni static asset release edilir.

Cache version artar.

Yeni task UI shell cache'e girer.

API cachelenmez.

Client yeni version'u alır.

## Akış 24 — Rollback

UI bug tespit edilir.

PR revert edilir.

Server schedule records korunur.

Worker mevcut backend policy ile çalışmaya devam edebilir.

Kullanıcıya rollback etkisi açıklanır.

## Akış 25 — Support sınırı

Support kullanıcıdan auth token istemez.

Support yalnızca status, error code ve Trace ID ister.

Task content gerekiyorsa minimum bilgi alınır.

## Akış 26 — Future recurrence

Kullanıcı tekrarlı task ister.

Bu release recurring UI sunmaz.

Desteklenmeyen özellik sahte biçimde schedule edilmez.

Gelecekte API contract ile eklenir.

## Akış 27 — Future edit

Kullanıcı planlanmış task'ı değiştirmek ister.

Bu release edit endpoint'i yoktur.

UI yalnızca cancel sunar.

Yeni task gerekiyorsa kullanıcı yeni schedule oluşturabilir.

## Akış 28 — Future retry-now

Kullanıcı failed task'ı hemen tekrar çalıştırmak ister.

Bu release retry-now endpoint'i yoktur.

UI sahte retry butonu göstermez.

## Akış 29 — Data boundary

Client server snapshot'ını alır.

UI yalnızca görünüm state'i tutar.

Schedule data browser persistent storage'a kopyalanmaz.

## Akış 30 — Completion

Feature yalnızca UI çizildiğinde tamamlanmış sayılmaz.

API contract, security, accessibility, PWA, error handling, rollback ve regression kontrolleri de geçmelidir.
