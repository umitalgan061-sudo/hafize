# Smart Insert — Erişilebilirlik

## Dialog

Smart Insert dialogu `role="dialog"`, `aria-modal="true"` ve `aria-labelledby` kullanır. Görsel başlık ile yardımcı metin arasındaki ilişki DOM üzerinden kuruludur.

## Odak

Modal açıldığında ilk değişken alanı odaklanır. Tab son odaklanabilir kontrolden ilk kontrole döner. Shift+Tab ilk kontrolden son kontrole sarar. Escape dialogu kapatır ve açan düğmeye odaklanır.

## Klavye

Ctrl/Cmd+Enter aktarımı onaylar. Ctrl/Cmd+Shift+I, L ve H hızlı erişim kısayollarıdır. Kullanıcı input veya textarea içinde yazarken global kısayollar engellenir.

## Canlı durum

Eksik değişken, başarılı aktarım, profil kayıt/silme ve geçmiş temizleme gibi sonuçlar `role="status"` ve `aria-live="polite"` bölgelerinde duyurulur.

## Renk

Focus görünürlüğü `:focus-visible` ile sağlanır. Forced-colors modunda sınırlar ve outline sistem renklerine bağlanır. Renk tek başına durum göstergesi değildir; metin etiketleri de kullanılır.

## Hareket

Reduced-motion tercihinde Smart Insert panelleri için animasyonlu scroll davranışı kapatılır. İşlevsel akış hareket gerektirmez.

## Mobil

700px altında modal tek kolon düzenine geçer, form alanları tam genişlik kullanır ve aksiyonlar dikeyleşir. Geçmiş satırları mobilde iki satırlı grid ile okunabilir kalır.

## Dinamik içerik

Kullanıcı profil adları, değişken değerleri ve prompt başlıkları HTML olarak yorumlanmaz. Metin DOM node'larına `textContent` veya form `value` ile yazılır.

## Test

Accessibility testleri role/aria alanlarını, focus trap kodunu, Escape davranışını, keyboard shortcut guard'ını, focus-visible CSS'ini, forced-colors ve reduced-motion kurallarını doğrulamalıdır.
