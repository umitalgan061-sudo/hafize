# Prompt Workspace — Browser Matrix

## Modern Chromium

LocalStorage, FileReader, Blob, URL.createObjectURL, MutationObserver ve native form elementleri desteklenmelidir.

## Firefox

Dialog görünümü native olmayan section overlay ile sağlandığından temel davranış browser dialog API'sine bağlı değildir. FileReader ve LocalStorage kullanımı normal beklenir.

## Safari

Private browsing veya düşük storage durumunda localStorage write başarısız olabilir. UI fallback status göstermeli ve mevcut in-memory state'i korumaya çalışmalıdır.

## Mobile Safari

Toolbar genişliği tek sütuna düşebilmelidir. Dialog alt-sheet görünümünde scroll edilebilir olmalıdır. Uzun prompt başlıkları wrap edilir.

## Android WebView/PWA

Service worker cache bulunmasa bile bootstrap asset loader ağdan yeni modülleri yükleyebilir. API yanıtları cache edilmez.

## Keyboard matrix

Windows/Linux `Ctrl+Shift+W/B/R`, macOS `Meta+Shift+W/B/R` kullanılabilir. Input, textarea, select ve contenteditable içinde global shortcut devre dışıdır.

## Accessibility matrix

Screen reader kullanıcıları section/dialog başlıklarını, live status mesajlarını ve native select/button kontrollerini algılayabilmelidir.

## Reduced motion

Özellikler animasyon bağımlı değildir. Browser reduce motion tercihi temel kullanılabilirliği değiştirmemelidir.

## Forced colors

Sistem renkleri border ve focus görünürlüğünü koruyacak şekilde devreye girebilir.

## Storage matrix

Normal storage, quota failure, malformed JSON, empty storage ve duplicate ID durumları test edilmelidir.

## File matrix

Valid JSON, invalid JSON, wrong version, oversized file, empty prompt set ve duplicate prompt set senaryoları test edilmelidir.
