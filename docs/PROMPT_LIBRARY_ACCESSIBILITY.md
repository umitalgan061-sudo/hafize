# Prompt Library Accessibility

## Semantics

Kütüphane kartı `section` olarak oluşturulur ve `aria-labelledby` ile başlıkla ilişkilendirilir.

Liste `role=list`, kayıtlar `role=listitem` olarak sunulur.

Durum mesajları `role=status` ve `aria-live=polite` taşır.

## Labels

Search, sort ve tag controls anlamlı `aria-label` içerir.

Favorite butonları durumlarını `aria-pressed` ile bildirir.

Selection checkbox'ları ilgili prompt başlığıyla ilişkilendirilecek bir label metni taşır.

Editor alanları kullanıcıya neyi düzenlediğini açıkça söyler.

## Keyboard

`Ctrl/⌘+Shift+P` arama alanını odaklar.

`Ctrl/⌘+Shift+N` yeni prompt editor'ünü açar.

Modifier olmadan normal karakter girişleri engellenmez.

## Focus

Focus-visible outline mevcut design token'larına göre görünür olmalıdır.

Yeni helper action'lar keyboard focus alabilir.

## Motion

Feature kendi animasyonunu zorunlu tutmaz.

`prefers-reduced-motion` altında scroll davranışı sadeleşir.

## Contrast

Tema renkleri mevcut token'lardan gelir.

Forced-colors mode border, button ve focus durumlarını sistem renkleriyle görünür tutar.

## Mobile

Dar ekranda toolbar tek kolona iner.

Liste iç scroll kullanır.

Uzun prompt başlıkları kelime kırma ile görünür kalır.

## Errors

Storage, import ve clipboard hataları status bölgesinde metinle bildirilir.

Hata bildirmek için yalnız renk kullanılmaz.
