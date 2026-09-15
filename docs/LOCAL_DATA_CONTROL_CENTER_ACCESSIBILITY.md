# Yerel Veri Merkezi — Erişilebilirlik

## Semantics

Kontrol merkezi Settings içindeki bağımsız bir `section` olarak adlandırılır. Başlık `aria-labelledby` üzerinden bağlanır. Veri listesi `role=list`, satırlar `role=listitem` taşır.

## Status

Toplam alan ve byte özeti `aria-live=polite` ile duyurulur. Temizleme veya refresh sonrası kısa sonuç mesajı okunabilir olur.

## Buttons

Her silme düğmesinin hangi alanı etkilediği `aria-label` ile açıklanır. Toplu silme düğmesi destructive olduğu için metinle açıkça ifade edilir.

## Keyboard

Kontroller normal Tab sırasına uyar. `Alt+Ctrl/⌘+D` veri merkezi yüzeyine odaklanmak için ek yardımcı kısayol sağlar. Kısayol başka form submiti üretmez.

## Focus

Panel mevcut Settings focus modelini bozmamalıdır. Native button ve DOM focus kullanılır; programatik focus yalnız kullanıcı tarafından kısayol başlatıldığında uygulanır.

## Contrast and modes

Focus-visible göstergesi görünür kalır. Forced-colors modunda sistem renkleri kullanılır. Reduced-motion etkinken yeni animasyon zorlanmaz.

## Touch

Dar ekranlarda veri satırları dikey akışa düşer ve ana aksiyonlar tam satıra yaklaşır. Satır içeriği `overflow-wrap` ile taşar.

## Screen reader expectation

Boş store normal state olarak duyurulur. Storage exception yanlış başarı mesajına dönüşmez. Yönetilmeyen key bilgisi açıklayıcı ama içerik göstermeyen metin olarak kalır.
