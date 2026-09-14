# Prompt Library Destek Rehberi

## Kart görünmüyor

`public/index.html` içinde `prompt-library.css` ve `prompt-library.js` referanslarını kontrol edin.

Tarayıcı konsolunda `HafizePromptLibrary` globalinin oluştuğunu kontrol edin.

Utility rail DOM'u yoksa core güvenli biçimde mount olmaz.

## Başlangıç istemleri yok

`HafizePromptLibraryStarters` globalini kontrol edin.

Storage'da mevcut kayıt varsa seed normal olarak tekrar çalışmaz.

Başlangıç seti butonu eksik starter'ları eklemek için `force: true` seed kullanır.

## Kayıt kayboluyor

Önce browser storage quota veya private mode'u kontrol edin.

Sonra `hafize.prompt-library.v1` key'inin yazılıp yazılmadığını inceleyin.

Conversation history key'iyle karıştırılmamalıdır.

## Import çalışmıyor

Dosya JSON olmalıdır.

1 MB sınırını kontrol edin.

Parse hatasında mevcut kayıtlar korunur.

Aynı id overwrite edilmemelidir.

## Export çalışmıyor

Tarayıcı Blob ve URL API'sini desteklemiyor olabilir.

Clipboard veya download policy bloklaması varsa kullanıcıya status gösterilir.

## Kopyala çalışmıyor

Clipboard API permission veya browser context'ini kontrol edin.

HTTP olmayan güvenli uygulama bağlamı gereksinimleri tarayıcıya bağlıdır.

Feature server'a fallback göndermez.

## UI duplicate

Card id'si `promptLibraryCard` olmalıdır.

Enhancement butonlarında `data-prompt-enhancement` bulunmalıdır.

MutationObserver zaten eklenmiş action'ları tekrar eklememelidir.

## Senkronizasyon

Aynı sekmedeki enhancement write işlemleri controlled `StorageEvent` ile core'a refresh sinyali verir.

Diğer sekmeler gerçek browser storage event'i ile yeniden yüklenir.

## Güvenlik bildirimi

Prompt kütüphanesi dış ağ çağrısı yapmamalıdır.

Prompt metni markup olarak execute edilmemelidir.

Import payload'ı normalize edilmeden UI'ye girmemelidir.
