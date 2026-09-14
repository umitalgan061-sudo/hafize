# Smart Fill Geliştirici Rehberi

## Modüller

`prompt-library.js` veri modeli ve temel CRUD'u sağlar. `prompt-library-smart-fill.js` değişkenli kullanım panelini sağlar. `prompt-library-command-palette.js` composer keşif akışını sağlar. `prompt-library-smart-fill-hints.js` limit sayaçlarını sağlar.

## Bağımlılık yönü

Smart Fill → Prompt Library core API kullanır.

Command Palette → Prompt Library core API ve Smart Fill public API kullanır.

Hints → Smart Fill DOM'u gözlemler; core storage'a yazmaz.

Service worker → asset listesini yönetir; uygulama state'ine dokunmaz.

## DOM sözleşmesi

Ana card `#promptLibraryCard`, composer `#messageInput`, Smart Fill paneli `#promptLibrarySmartFill` ve palette `#promptLibraryCommandPalette` id'lerini kullanır.

Bu id'ler feature'lar arası kontrattır ve gereksiz yere değiştirilmemelidir.

## Storage sözleşmesi

Prompt: `hafize.prompt-library.v1`.

Preset prefix: `hafize.prompt-library.smart-fill.v1.`.

Presetler core `saveItems` üzerinden yazılmaz.

## Event sözleşmesi

Composer değişimleri `input` event'i üretir. Smart Fill `Kullan` capture event'i ile yalnız değişkenli promptları intercept eder.

Palette seçimi variable varsa Smart Fill `open()` API'sini çağırır.

## Public API

`HafizePromptLibrarySmartFill.mount/open/close/readPresets/writePresets/variableNames`.

`PromptLibraryCommandPalette.mount/open/close/search`.

`HafizePromptSmartFillHints.mount/paint`.

## Güvenlik

User text HTML olarak oluşturulmaz. Network çağrısı eklenmez. Form submit feature tarafından yapılmaz.

## Test

Yeni helper veya selector eklenirse source, a11y ve integration contract testleri güncellenmelidir.

## Rollback

Feature dosyaları birbirinden bağımsız kaldırılabilecek şekilde tutulur. Core Prompt Library davranışını değiştirmek yerine enhanced katmanları geri almak tercih edilir.
