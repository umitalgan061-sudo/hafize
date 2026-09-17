# Prompt Collection Workspace — Accessibility

## Semantik

Ana workspace `section` olarak sunulur.

Başlık `aria-labelledby` ile workspace'e bağlanır.

Koleksiyon listesi `role=list` kullanır.

Koleksiyon satırları `role=listitem` semantiğine sahiptir.

Üye listesi de aynı liste modelini kullanır.

Düzenleyici `role=dialog` ile işaretlenir.

Düzenleyicide `aria-modal=true` bulunur.

Düzenleyici başlığı `aria-labelledby` ile bağlanır.

Durum mesajı `role=status` ve `aria-live=polite` kullanır.

Hatalar `role=alert` ile ayrı görünür.

## Odak

Koleksiyon satırı klavye odağı alabilir.

Focus-visible için belirgin outline sağlanır.

Toolbar kontrolleri normal tab sırasına dahil olur.

Modal açıldığında ad alanı odaklanır.

Modal kapanınca son odaklanan elemente dönülür.

Modal içinde Tab odağı döngüsel tutulur.

Shift+Tab de aynı döngüyü korur.

Escape modalı kapatır.

## Klavye

Ctrl/⌘+Shift+L arama alanını odaklar.

Satır üzerinde Enter aç/kapat davranışını çalıştırır.

F favori durumunu değiştirir.

A arşiv durumunu değiştirir.

Delete silme onayı başlatır.

ArrowUp önceki satıra odaklanır.

ArrowDown sonraki satıra odaklanır.

Düzenlenebilir alanlarda global kısayollar engellenir.

## Görsel durum

Favori `aria-pressed` ile açıklanır.

Workspace daraltma `aria-expanded` ile açıklanır.

Düzenleyici düğmeler metin etiketine sahiptir.

Renk noktası dekoratif olarak `aria-hidden` olur.

Renk anlamı yalnızca renge bırakılmaz.

Arşiv durumu metinsel eylemle belirtilir.

## Hareket

Reduced-motion medya sorgusu desteklenir.

Workspace listesindeki otomatik animasyon kullanılmaz.

Klavye odağı hareket ettirilirken scroll yalnızca gerektiğinde değişir.

## Kontrast

Forced-colors modunda sınırlar ve arka planlar sistem renklerine döner.

Focus outline system highlight rengine uyarlanabilir.

Metin ve eylem ayrımı yalnızca renk ile yapılmaz.

## Mobil

Dar ekranda kontroller sıkışık tek satıra zorlanmaz.

İşlem düğmeleri ikinci satıra düşer.

Form kontrolleri tam genişliği kullanabilir.

Modal içerik ekran yüksekliğine göre scroll edebilir.

## Dinamik içerik

Kullanıcı verisi `textContent` ile eklenir.

HTML enjeksiyonu için `innerHTML` kullanılmaz.

Koleksiyon ve prompt adları ARIA metnine doğrudan güvenli metin olarak eklenir.

Uzun metinler bounded gösterilir.

## Screen reader beklentileri

Listeye girildiğinde kayıtların adları okunabilir.

Seçim kutuları hangi koleksiyonu seçtiğini açıklar.

Favori düğmesi mevcut durumunu bildirir.

Arşiv eylemi açık metin kullanır.

Detay alanı başlıkla ilişkilidir.

Üye çıkarma düğmesi açık ve tekil eylem adıdır.

Durum mesajları kullanıcı işlemlerinden sonra güncellenir.

## Test

A11y sözleşme testi ARIA rollerini kontrol eder.

Odak yönetimi sözleşme testi modal davranışını kontrol eder.

CSS testi reduced-motion ve forced-colors kurallarını kontrol eder.

Keyboard testi düzenlenebilir alan guard'ını kontrol eder.
