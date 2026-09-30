# Çalışma Alanı Yedekleme Gizlilik Notu

## Veri ilkesi

Özellik kişisel workspace state'ini cihazdan dışarı çıkarmanın kontrollü yoludur.

Dışarı çıkış kullanıcı tarafından başlatılan download işlemiyle gerçekleşir.

Uygulama veriyi backend endpoint'ine göndermez.

Yedek dosyasının sonraki yaşam döngüsü kullanıcı kontrolündedir.

## Taşınabilir veriler

Sohbet geçmişi kullanıcı tarafından seçilebilir.

Mesaj metadata'sı kullanıcı tarafından seçilebilir.

İstemler ve istem state'i kullanıcı tarafından seçilebilir.

Koleksiyonlar ve revision geçmişi kullanıcı tarafından seçilebilir.

Model tercih profilleri kullanıcı tarafından seçilebilir.

Composer geçmişi kullanıcı tarafından seçilebilir.

Yerel görev şablonları kullanıcı tarafından seçilebilir.

Task draft kullanıcı tarafından seçilebilir.

Smart Fill preset değerleri kullanıcı tarafından seçilebilir.

## Taşınmayan veriler

Application auth token'ları taşınmaz.

Connector credentials taşınmaz.

OAuth access token taşınmaz.

OAuth refresh token taşınmaz.

Session cookie state'i taşınmaz.

Redis lease veya worker state'i taşınmaz.

Sunucu scheduled task execution state'i taşınmaz.

Telemetry state'i taşınmaz.

## Metadata

Uygulama son backup zamanı gibi küçük metadata saklar.

Metadata backup içeriğini içermez.

Metadata tam dosyanın ikinci kopyası değildir.

Metadata delete işlemi workspace state'ini silmez.

## Import

Import dosyası browser memory'sinde okunur.

Yedek server'a upload edilmez.

Preview verileri DOM text node olarak oluşturulur.

Bilinmeyen field'ler restore yüzeyine taşınmaz.

## Paylaşım riski

Yedek dosyası seçilen workspace verilerini içerebilir.

Prompt içeriği hassas olabilir.

Sohbet geçmişi hassas olabilir.

Composer history hassas olabilir.

Model tercihleri çalışma tercihlerinin izlerini taşıyabilir.

Yedek güvenilmeyen cihazlara kopyalanmamalıdır.

## Kullanıcı kontrolü

Export kapsamı kullanıcı seçer.

Import kapsamı kullanıcı seçer.

Restore öncesi confirmation gösterilir.

Panel otomatik backup oluşturmaz.

Panel cloud sync başlatmaz.

## Saklama

Uygulama backup dosyasını kendi storage'ına kopyalamaz.

Yalnız metadata anahtarı tutulur.

Download dosyası browser dışında kullanıcı tarafından yönetilir.

## Privacy testleri

Source testleri network API olmadığını kontrol eder.

Security testleri sensitive key sınırını kontrol eder.

Storage testleri alternatif telemetry deposu kullanılmadığını kontrol eder.

PWA testleri yalnız feature asset'lerinin shell cache'e girdiğini kontrol eder.

## Privacy kabul kriterleri

Export remote write yapmamalıdır.

Sensitive key export edilmemelidir.

Import remote write yapmamalıdır.

Metadata gerçek payload içermemelidir.

Restore yalnız seçilen alanları değiştirmelidir.

## Kullanıcı uyarısı

Yedek dosyası seçilen tüm içerikleri taşıyabilir.

Bu nedenle yedek normal kişisel belge gibi korunmalıdır.

Paylaşılan backup dosyasını silmek uygulamadaki local state'i silmez.

Import sırasında dosyanın kaynağı ve kapsamı kontrol edilmelidir.
