# Smart Fill Erişilebilirlik

## Diyalog

Smart Fill gerçek bir `dialog` semantiği kullanır. Başlık ve açıklama `aria-labelledby` ve `aria-describedby` ile ilişkilidir. Panel açıkken Escape ile kapanır.

## Odak

Panel açıldığında ilk değişken alanı odaklanır. Panel kapanırken önceki odak elemanına dönülür. Tab dolaşımı panel içinde tutulur; Shift+Tab ters yönde ilerler.

## Canlı önizleme

Değer değiştiğinde önizleme güncellenir. Önizleme bölümü `aria-live="polite"` olduğundan ekran okuyucu kullanıcıyı agresif biçimde kesmez.

## Hata mesajları

Hata alanı `role="alert"` kullanır. Boş değişkenlerle aktarım engellendiğinde neden açıkça yazılır.

## Form alanları

Her input kendi değişken adıyla erişilebilir bir `aria-label` taşır. Placeholder tek başına etiket olarak kullanılmaz.

## Command palette

Palette `listbox` ve `option` semantiğiyle sonuçları temsil eder. Aktif seçenek `aria-selected` ile belirtilir. Yukarı/aşağı oklar arasında dolaşılabilir ve Enter seçimi tamamlar.

## Mobil

700px altındaki ekranlarda değişken etiketi input'un üstüne taşınır. Butonlar satırları doldurabilecek şekilde esner. Panel yüksekliği viewport'a göre sınırlanır.

## Forced colors

Forced-colors modunda kenarlıklar ve odak çizgileri sistem renklerine uyarlanır. Renk tek başına durum belirtmez.

## Hareket azaltma

`prefers-reduced-motion` açık olduğunda panel içinde kaydırma davranışı sade tutulur. Özellik işlevini animasyona bağımlı kılmaz.

## Klavye sözleşmesi

Command palette için `Ctrl/⌘+Shift+O` aç/kapat kısayoludur. Smart Fill panelinde Escape kapanış, Tab odak dolaşımı ve değişken alanlarında Enter/ok tuşları kontrollü gezinme sağlar.

## Test yaklaşımı

Erişilebilirlik testleri kaynak sözleşmelerini, ARIA semantiğini, focus trap'i ve mobile/forced-colors CSS kurallarını kontrol eder. Tam ekran okuyucu otomasyonu bu sürümün dışında bırakılmıştır; bu sınır release notlarında belirtilir.
