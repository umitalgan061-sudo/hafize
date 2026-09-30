# Çalışma Alanı Yedekleme Erişilebilirlik Kriterleri

## Semantik yapı

Ana panel section olarak oluşturulur.

Panel başlığı aria-labelledby ile ilişkilendirilir.

Geri yükleme preview bölümü dialog rolü taşır.

Preview aria-labelledby ile başlığına bağlanır.

Status alanı role=status kullanır.

Status alanı aria-live=polite ile duyurulur.

Section listeleri group veya list semantics ile sunulur.

## Klavye

Kullanıcı tüm checkbox'lara klavye ile erişebilir.

Tüm butonlar native button elementidir.

Native button type button olarak ayarlanır.

Tab sırası DOM sırasını takip eder.

Preview açıldığında ilk section checkbox'ı focus alabilir.

Preview kapanınca önceki focus mümkünse geri yüklenir.

Ctrl veya Command Shift Y yedek paneline erişim sağlar.

Shortcut editable controls içinde devreye girmez.

## Focus

Focus görünürlüğü CSS focus-visible ile korunur.

Focus ring sistem temasıyla uyumlu değişkene dayanır.

Disabled control focus ile etkin işlem başlatamaz.

Preview button focus durumları açık kalır.

## Screen reader

Section label checkbox ile aynı label içinde ilişkilidir.

Description small text node olarak oluşturulur.

Boyut bilgisi ayrı erişilebilir metindir.

Integrity status yalnız görsel renkle anlatılmaz.

Başarı mesajı status alanından duyurulur.

Hata mesajı aynı status alanından duyurulur.

## Motion

Reduced motion medya kuralı panel içinde scroll behavior'ı sadeleştirir.

Yeni bir zorunlu animasyon kullanılmaz.

Preview açılması animasyon bağımlı değildir.

## High contrast

Forced colors medya sorgusu border'ları sistem renklerine geçirir.

Canvas ve CanvasText renkleri kullanılır.

Focus outline Highlight olarak korunur.

Metin kontrastı yalnız custom theme değişkenlerine bağlı değildir.

## Mobile

700px altında section choice iki satırlı düzene geçer.

Boyut bilgisi ikinci satıra taşınır.

Action button'lar tek satıra sıkışmaz.

Preview listesi daha düşük max-height kullanır.

## Form davranışı

Checkbox seçiminin hedef alanı label'dır.

Kullanıcı küçük hit area ile sınırlı kalmaz.

Boş selection açık hata mesajı üretir.

Destructive restore confirmation metni açıktır.

## Dil

UI metinleri Türkçedir.

Kısaltmalar yerine açıklayıcı ifadeler tercih edilir.

Dosya boyutu insan tarafından okunabilir biçimde gösterilir.

Integrity bilgisi teknik olsa da status mesajı açıklayıcıdır.

## Erişilebilirlik testleri

aria-labelledby marker'ı kontrol edilmelidir.

aria-live marker'ı kontrol edilmelidir.

aria-modal veya dialog semantics kontrol edilmelidir.

focus-visible CSS kontrol edilmelidir.

forced-colors CSS kontrol edilmelidir.

reduced-motion CSS kontrol edilmelidir.

Shortcut'in form kontrollerini engellemediği test edilmelidir.

## Kabul kriterleri

Ana panel başlığını ekran okuyucu duyabilir.

Import sonucu ekran okuyucuya status olarak ulaşır.

Restore confirmation metni açık ve anlaşılırdır.

Checkbox label'ı section adını ve açıklamasını taşır.

Klavye ile export ve import butonlarına ulaşılabilir.

Preview kapatıldığında focus kaybolmaz.

## Regresyon

Yedek panelinin focus CSS'i global focus stilini bozmamalıdır.

Mobile breakpoint diğer utility rail kartlarını bozmamalıdır.

Forced colors diğer global renk değişkenlerini ezmemelidir.

Reduced motion yalnız feature-specific davranışı etkiler.

## Tasarım ilkesi

Erişilebilirlik ek bir mod değil, default davranıştır.

Klavye yolu mouse yolunun aynısını tamamlar.

Status alanı görsel toast yerine kalıcı metinsel feedback verir.

Destructive işlem her zaman kullanıcı iradesini bekler.
