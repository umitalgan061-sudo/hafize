# Akıllı Görünümler Erişilebilirlik

## Semantik

Panel `section` olarak oluşturulur.
Başlıklar `aria-labelledby` ile bağlanır.
Listeler `role=list`, satırlar `role=listitem` kullanır.
Durum mesajları `role=status` ve `aria-live=polite` ile duyurulur.

## Formlar

Arama, sıralama, etiket, favori, değişken ve sayı alanlarında görünür veya programatik etiket bulunur.
Kullanıcı metni placeholder'a bağımlı bırakılmaz.

## Klavye

Sorgu oluşturucu Ctrl / ⌘ + Shift + Q ile odaklanabilir.
Tab normal browser akışını kullanır.
Düğmeler `type=button` olarak üretilir ve form submit'i başlatmaz.

## Görsel durumlar

Sabitleme yalnız renk ile ifade edilmez; metin ve yıldız göstergesi birlikte kullanılır.
Aktif görünüm “Aktifi kaldır” eylemiyle açıkça anlaşılır.
Durum mesajları filtre sonucu veya işlemin başarısını ifade eder.

## Hareket

prefers-reduced-motion: reduce altında ek scroll animation zorlanmaz.

## Forced colors

Forced-colors ortamında kontrol ve satır kenarlıkları CanvasText/Highlight kontrastını koruyacak şekilde yeniden tanımlanır.

## Mobil

700 px altında toolbar tek sütuna düşer.
Görünüm satırları dikey yerleşime geçer.
Düğmeler taşma yapmayacak şekilde sarılabilir.

## Test hedefleri

Klavye ile tüm eylemlere erişilebilmelidir.
Odak görünür olmalıdır.
Aria-expanded değerleri göster/gizle durumuyla eşleşmelidir.
Kişisel görünüm adları ekran okuyucuya textContent ile ulaşmalıdır.