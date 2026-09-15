# Composer History — Erişilebilirlik

## Keyboard

`Ctrl/⌘ + Shift + H` history panelini açar veya kapatır.

`Escape` açık paneli kapatır.

`↑` ve `↓` composer geçmişinde gezinir.

Arrow navigation yalnız imleç başta veya sonda iken etkinleşir.

IME composition sırasında shortcut işlenmez.

## Semantics

History paneli başlık ve controls için anlamlı label'lar taşır.

Arama alanı `type=search` kullanır.

Liste `role=list`, kayıtlar `role=listitem` kullanır.

Silme düğmeleri içerik hakkında aria-label taşır.

Gizlilik ayarlarında native checkbox ve select kullanılır.

## Focus

Panel açıldığında arama alanına odak verilir.

Panel Escape ile kapanınca toggle'a odak döner.

Dialog kullanılmadığından modal focus trap gerektirmez.

Arrow navigation input cursor konumunu bozmadan çalışmalıdır.

## Visual

Focus-visible outline görünür kalır.

Forced-colors modunda border ve focus renkleri sistem renklerine düşer.

Dar ekranlarda history rows kırılmayan metinleri overflow-wrap ile taşır.

Reduced-motion ayarlarına karşı panelde animasyon bağımlılığı yoktur.

## Screen reader

Panel başlığı ayrıdır.

Arama sonucu sayısı status metninde okunabilir.

Boş history ve boş arama durumları açık text ile ifade edilir.

## Validation

A11y testleri keyboard, labels, role, focus ve forced-colors sözleşmelerini kilitlemelidir.
