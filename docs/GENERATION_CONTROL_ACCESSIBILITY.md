# Üretim Kontrolü — Erişilebilirlik

## Semantik

Kontrol alanı `role="group"` ve açıklayıcı bir `aria-label` ile tanımlanır. Canlı durum metni `role="status"`, `aria-live="polite"` ve `aria-atomic="true"` kullanır.

Durdurma butonu açık bir `aria-label` ile duyurulur. Tanı ve geçmiş butonları kendi kontrol ettikleri yüzeye `aria-controls` ile bağlanır.

## Canlı durum

Aktif üretim sırasında ekran okuyucuya gereksiz her token değişimini okutmak yerine kısa durum özeti güncellenir. Süre, SSE olayları ve byte bilgisi tek satırda bounded biçimde gösterilir.

Terminal durum beş saniye görünür; ardından kontrol yüzeyi idle haline döner. Böylece ekran okuyucu odağında sürekli değişen tarih/sayaç metni bırakılmaz.

## Klavye

Durdurma kısayolu Ctrl/⌘ + Shift + X'tir. Metin yazılan alanlarda kısayol devre dışıdır. Kontrol düğmeleri normal tab sırasına katılır.

Durdurma butonu native button olduğundan Enter ve Space ile erişilebilir. Panel açıkken history toggle yine native button davranışı gösterir.

## Görsel erişilebilirlik

`generation-control.css`:

- focus-visible outline uygular,
- forced-colors modunda sistem renklerine uyum sağlar,
- reduced-motion tercihinde animasyon geçişi zorlamaz,
- 700 px altında düğmeleri tam genişlikte ve dikey düzende gösterir.

Renk tek başına phase göstergesi değildir; text status ve düğme etiketleri anlamı taşır.

## Mobil kullanım

Dar ekranlarda uzun label kesilse bile durumun bütün anlamı metadata sırasıyla korunur. Düğmeler tek kolona iner ve dokunma alanı normal button padding'i içinde kalır.

## Test yaklaşımı

Accessibility testleri role/aria sözleşmesini, klavye guard'ını, mobile media query'yi ve forced-colors/reduced-motion kurallarını kontrol eder. UI testleri ayrıca active → terminal ve terminal → idle yaşam döngüsünü doğrular.
