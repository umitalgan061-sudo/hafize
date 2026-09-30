# Çalışma Alanı Yedeği Kullanıcı Rehberi

## Yedek nedir

Bu özellik Hafize'nin cihazda tuttuğu kişisel çalışma alanını taşınabilir hale getirir.

Bir JSON dosyası oluşturulur.

Dosyayı başka bir cihazda tekrar içeri alabilirsin.

Uygulama dosyayı sunucuya yüklemez.

## Ne yedeklenebilir

Sohbetler.

Mesaj çalışma alanı.

İstemler.

İstem filtre tercihleri.

İstem koleksiyonları.

İstem sürüm geçmişi.

Model tercihleri.

Composer geçmişi.

Composer geçmişi ayarları.

Görev şablonları.

Görev taslağı.

Smart Fill yerel değerleri.

## Ne yedeklenmez

Sunucu tarafı gerçek görev kayıtları.

API anahtarları.

Connector kimlikleri.

OAuth token'ları.

Session bilgileri.

Redis worker state.

Telemetry.

## Yedek alma

Çalışma Alanı Yedeği panelini aç.

Yedek kapsamı altındaki yüzeyleri incele.

Taşımak istemediğin alanların seçimini kaldır.

En az bir alan bırak.

Yedeği indir düğmesine bas.

Tarayıcı JSON dosyasını download alanına kaydeder.

Dosyayı güvenli bir yerde sakla.

## Yedek dosyasını koruma

Yedek seçtiğin konuşmaları ve istemleri içerebilir.

Bu nedenle yedek hassas bir kişisel dosya gibi korunmalıdır.

Ortak bilgisayara bırakılmamalıdır.

Güvenilmeyen bir kişiye gönderilmemelidir.

Dosya adı varsayılan olsa da kullanıcı değiştirebilir.

## Yedekten geri yükleme

Yedekten geri yükle düğmesine bas.

JSON dosyasını seç.

Hafize dosyanın yapısını kontrol eder.

Integrity doğrulaması yapılır.

Preview ekranında section'lar gösterilir.

Geri getirmek istediğin alanları seç.

Seçilenleri geri yükle düğmesine bas.

Onay penceresini dikkatle oku.

Onay sonrası seçilen local state üzerine yazılır.

## Selective restore

Tüm workspace'i geri almak zorunda değilsin.

Yalnız istem kütüphanesini geri alabilirsin.

Yalnız model tercihlerini geri alabilirsin.

Yalnız sohbet geçmişini geri alabilirsin.

Seçmediğin yüzeyler değiştirilmez.

## Integrity

Bütünlük doğrulandı mesajı dosyanın digest ile eşleştiğini gösterir.

Unverified dosyada güvenilir digest bulunmayabilir.

Başarısız bütünlük doğrulaması restore işlemine izin vermez.

Dosyayı yeniden export etmek veya güvenilir kopyasını kullanmak gerekir.

## Import preview

Preview aşamasında henüz restore yapılmaz.

Section boyutu görünür.

Section açıklaması görünür.

Checkbox ile seçim yapılır.

Tümünü seç hızlı seçim sağlar.

Seçimleri temizle hızlı temizleme sağlar.

Vazgeç hiçbir state'i değiştirmez.

## Restore sonrası

İlgili workspace panelleri kendi state'lerini yeniler.

Tarayıcıyı yeniden açmak bazı eski paneller için yardımcı olabilir.

Backup metadata yalnız son export bilgisini gösterir.

Restore backup dosyasını silmez.

## Sorun olursa

Büyük dosya uyarısı alırsan dosya sınırını kontrol et.

Geçersiz JSON uyarısı alırsan dosyanın sağlam kopyasını kullan.

Integrity failure alırsan değiştirilmiş dosyayı kullanma.

Storage failure alırsan browser quota'sını kontrol et.

Restore rollback uyarısı alırsan mevcut veriyi ayrıca kontrol et.

## Güvenlik

Hafize senden token istemez.

Hafize senden API secret istemez.

Hafize backup'ı remote servise göndermez.

Restore işlemi confirmation bekler.

## Kısayol

Ctrl veya Command Shift Y klavye kısayolu backup paneline erişir.

Bu kısayol metin giriş alanlarında yazmayı bozmaz.

## İpuçları

Düzenli olarak seçmeli backup alabilirsin.

Büyük conversation history yerine yalnız istemlerini taşımak isteyebilirsin.

Revision history önemliyse onu ayrıca seçebilirsin.

Model preference cihazlar arasında taşınabilir.

Task templates yeni cihazda tekrar kullanılabilir.

## Veri kaybını önleme

Restore'dan önce güvenilir backup dosyanın olduğundan emin ol.

Destructive confirmation metnini oku.

Yanlış section seçtiysen Vazgeç ile çık.

Quota sorunu varsa tekrar denemeden önce storage durumunu kontrol et.

## Basit senaryo

Eski cihazda yalnız Prompt Library seç.

Yedeği indir.

Yeni cihazda Hafize'yi aç.

Yedekten geri yükle.

Dosyayı seç.

Prompt Library checkbox'ını açık bırak.

Diğer section'ları kapat.

Restore işlemini onayla.

Yeni cihazdaki istemler geri gelir.

## Kullanıcı beklentisi

Bu özellik cloud sync değildir.

Bu özellik otomatik background backup değildir.

Bu özellik account-to-account transfer sistemi değildir.

Bu özellik yerel state export ve import aracıdır.
