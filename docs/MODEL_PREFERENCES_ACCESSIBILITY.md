# Model ve Ajan Tercihleri Erişilebilirlik

## Dialog

Panel role dialog ile işaretlenir.
Başlık aria-labelledby ile bağlanır.
Açma düğmesi aria-controls ve aria-expanded durumunu taşır.
Panel modal değildir; sohbet bağlamı görünür kalır.

## Odak

Panel açıldığında odak kapatma düğmesine gider.
Escape kapatır.
Kapatma sonrası odak açma düğmesine döner.
Tab son öğeden ilk öğeye döner.
Shift+Tab ilk öğeden son öğeye döner.

## Kısayol

Ctrl veya Command + Shift + M paneli açıp kapatır.
Kısayol input, textarea ve select üzerinde ele geçirilmez.
Böylece form yazımı sırasında global komut yanlışlıkla çalışmaz.

## Metin

Profil adı, model ve ajan etiketleri textContent üzerinden yazılır.
Özel karakterlerin HTML olarak yorumlanması beklenmez.
Uzun değerler CSS ile satıra sarılır.

## Responsive

700 px altında profil satırları tek kolona düşer.
Panel ekran genişliğini aşmayacak şekilde sınırlandırılır.
Liste dikey olarak kaydırılabilir.
Mobilde butonlar sarmalanır.

## Renk ve hareket

Panel yalnız renge bağlı durum bilgisi taşımaz.
Araç modu metinle de gösterilir.
Focus-visible görünür tutulur.
Reduced motion ve forced colors stilleri vardır.

## Test odakları

Dialog semantiği.
Escape kapanışı.
Tab focus trap.
Focus restoration.
Kısayol guard'ı.
Focus-visible.
Reduced motion.
Forced colors.
