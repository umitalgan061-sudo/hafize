# Zamanlanmış Görevler — Kullanıcı Kılavuzu

## Amaç

Zamanlanmış Görevler çalışma alanı, Hafize'nin belirli bir ajanı seçilen gelecekte tek seferlik bir görev için çalıştırmasına arayüz sağlar.

Görevler sunucu tarafındaki mevcut schedule runtime üzerinden oluşturulur. Tarayıcı yalnızca görev isteğini gönderir, sonucu veya durumu sorgular ve kullanıcının seçimine göre iptal işlemi yapar.

## Görev oluşturma

1. Sol menüden **Görevler** öğesini aç.
2. Bir ajan seç.
3. Görev metnini yaz veya hızlı şablonlardan birini kullan.
4. Gelecekte bir tarih ve saat seç.
5. Gerekirse maksimum deneme sayısını 1–5 aralığında değiştir.
6. **Görevi planla** düğmesine bas.

Görev oluşturma sırasında istemin boş olması, zamanın geçmişte olması veya geçerli ajan bulunmaması istemci tarafından reddedilir. Sunucu ayrıca ajanı, görev boyutunu ve kimlik doğrulamayı yeniden doğrular.

## Hızlı şablonlar

Günlük özet şablonu günlük gelişmelerin kısa bir özetini ister.

Satış özeti şablonu satış verilerindeki önemli sapmaları ve takip noktalarını ister.

Kod incelemesi şablonu son değişiklikleri ve regresyon risklerini inceleyecek bir görev metni üretir.

Araştırma özeti şablonu güvenilir kaynaklarla kısa bir karar notu üretmeye yöneliktir.

Haftalık plan şablonu gelecek haftanın işlerini önceliklendirmeye yardımcı olur.

Kontrol listesi şablonu verilen iş için uygulanabilir kontrol adımlarını üretmeye yardımcı olur.

Şablonlar yalnızca form alanını doldurur. Kullanıcı ayrıca değiştirip gönderebilir.

## Görev durumları

### Planlandı

Görev zamanını bekliyor. Bu aşamada **İptal et** kullanılabilir.

### Çalışıyor

Worker görevi talep etmiş ve yürütüyor. Arayüz yenileme ile durumu tekrar okuyabilir; yeni bir çalıştırma başlatmaz.

### Tamamlandı

Görev başarıyla sonlanmıştır. Tamamlanmış kayıt yeniden çalıştırma düğmesi sunmaz çünkü backend sözleşmesinde yeniden çalıştırma komutu yoktur.

### Başarısız

Son çalıştırmada hata oluşmuştur. Hata kodu varsa kayıt altında gösterilir. Arayüz unsupported bir otomatik retry düğmesi eklemez; retry politikası schedule runtime tarafından yönetilir.

### İptal edildi

Kullanıcı planlanmış görev için iptal komutu göndermiştir. İptal edildikten sonra görev satırı yalnızca durum bilgisini gösterir.

## İptal

İptal işlemi yalnızca durum `Planlandı` iken görünür. Kullanıcı onayı alınmadan silme/iptal yapılmaz.

İptal isteği programatik olarak schedule ID üzerinden yapılır. ID URL içinde encode edilir.

## Yenileme

Panel açıkken görev listesi düzenli aralıklarla yenilenir. Yenileme mevcut kayıtları sorgular; görev oluşturmaz ve yürütme başlatmaz.

Kullanıcı ayrıca **Yenile** düğmesiyle anlık sorgu yapabilir.

## Trace ID

Her görev kayıtında gözlemleme için bir Trace ID bulunur. Arayüz Trace ID'yi gizli bir sır gibi saklamaz; yalnızca görev kaydının hata ayıklama metadata'sını gösterir.

Trace ID sunucu tarafından üretilir ve kullanıcı hesabına ait schedule kaydıyla ilişkilidir.

## Kimlik doğrulama

Schedule API oturum kimliğine bağlıdır. 401 yanıtı alındığında görev listesi ve oluşturma yüzeyi kullanıcıya oturum gerektirdiğini belirtir.

Tarayıcıya `HAFIZE_SCHEDULE_AUTH_TOKEN` veya başka bir server secret aktarılmaz.

## Zaman dilimi

Form `datetime-local` kullanır. Kullanıcının yerel tarih/saat seçimi istemci tarafında ISO zaman damgasına dönüştürülür ve backend'e gönderilir.

Sunucu son doğrulamada tarihi ISO biçimine normalize eder. Böylece runtime kayıtları karşılaştırılabilir hale gelir.

Geçmiş bir zaman seçimi için istemci görev oluşturmayı durdurur. Sunucu ayrıca kendi zaman doğrulamasını uygular.

## Maksimum deneme

UI 1 ile 5 arasında değer sunar. Backend store da 5 üst sınırını uygular.

Bu alan worker davranışını doğrudan yeniden kodlamaz; yalnızca mevcut schedule komutuna `maxAttempts` değerini verir.

## Veri ve mahremiyet

Görev metni schedule backend'ine gönderilir çünkü görevin yürütülebilmesi için sunucunun görevi bilmesi gerekir.

Tarayıcı schedule kimlik doğrulama secret'ını localStorage'a yazmaz.

Analytics, üçüncü taraf telemetry veya reklam çağrısı eklenmemiştir.

## Sınırlar

Mevcut arayüz tek seferlik schedule API'sine uyumludur.

Tekrarlayan cron kuralı, takvim daveti, dış servis bildirim zinciri veya yapay olarak eklenmiş retry endpoint'i bu özellik kapsamında değildir.

Backend kapasitesi dolduğunda kullanıcı `Görev kapasitesi dolu` mesajı alır.

## Hızlı sorun çözme

Görev listesi görünmüyorsa önce oturum durumunu kontrol et.

Ajan seçilemiyorsa ana ajan listesinin yüklenmesini bekleyip paneli yeniden aç.

Planlama başarısızsa seçilen zamanın gelecekte olduğundan emin ol.

Bir görev çalışırken iptal düğmesinin kaybolması beklenen davranıştır.

Bir görev tamamlandıysa aynı kaydı tekrar çalıştırma desteği yoktur.

## Erişilebilirlik

Panel `role=dialog` kullanır.

Durum mesajları `aria-live=polite` ile duyurulur.

Form alanları görünür metin etiketlerine ve ARIA isimlerine sahiptir.

Klavye kullanıcıları paneli Escape ile kapatabilir ve standart Tab akışıyla kontroller arasında dolaşabilir.

Mobil düzen dar ekranlarda tek sütuna iner.

Forced-colors ve reduced-motion kuralları desteklenir.
