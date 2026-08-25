# Hafize klavye kısayolları

Hafize'nin sohbet kabuğu, fare veya dokunmatik kullanmadan temel konuşma kontrolüne ulaşmak için küçük ve kasıtlı bir klavye kısayolu kümesi sağlar.

## Aktif kısayollar

| Kısayol | Davranış |
| --- | --- |
| `Ctrl+K` / `⌘K` | Mesaj yazarına odaklanır ve imleci mevcut taslağın sonuna taşır. |
| `/` | Yalnız düzenlenebilir bir alanda değilken mesaj yazarına odaklanır. |
| `Ctrl+Shift+F` / `⌘⇧F` | Konuşma arama alanına odaklanır ve mevcut sorguyu seçer. |
| `Esc` | Yalnız aktif bir yanıt üretiliyorsa görünür **Yanıtı durdur** kontrolünü tetikler. |

## Güvenlik ve kullanıcı kontrolü

Kısayol katmanı yalnız tarayıcı DOM kontrollerini yönlendirir. Ayrı bir ağ, model, ajan veya tool runtime'ı değildir.

- `fetch`, WebSocket veya başka bir network yolu açmaz.
- `localStorage`, `sessionStorage`, cookie veya clipboard okumaz/yazmaz.
- API key, bearer token, owner ID veya başka credential işlemez.
- `Esc` doğrudan `AbortController` nesnesine erişmez; mevcut görünür stop düğmesinin click yolunu kullanır.
- Böylece stop-generation davranışının generation-token ve cancellation sınırı `app.js` / `chat-run-controller.js` tarafında tek kaynak olarak kalır.
- Kısayol hiçbir tool çağrısı, dış yazma, mesaj gönderme veya merge yetkisi üretmez.
- Ajan registry'si ve backend default-deny permission enforcement değişmez.

## Tuş yakalama sınırı

Global klavye handler'ı mümkün olduğunca az tuşu sahiplenir.

### `/`

Düz slash yalnız odak bir `input`, `textarea`, `select` veya `contenteditable` alanında değilse ele alınır. Böylece kullanıcı normal metin yazarken `/` karakteri engellenmez.

`Alt`, `Ctrl`, `Meta` veya `Shift` ile değiştirilmiş slash kombinasyonları Hafize tarafından sahiplenilmez.

### `Ctrl/⌘+K`

Yalnız `K` + platform modifier kombinasyonu kabul edilir. `Alt` veya `Shift` eklenmiş varyantlar Hafize tarafından ele alınmaz.

Composer bulunamazsa veya disabled durumdaysa browser'ın varsayılan davranışı engellenmez.

### `Ctrl/⌘+Shift+F`

Yalnız `F` + platform modifier + `Shift` kombinasyonu konuşma aramasına ayrılır; `Alt` eklenmiş varyantlar kabul edilmez. Açık kullanıcı kısayolu olduğu için composer gibi düzenlenebilir bir alan odaktayken de arama alanına geçebilir.

`#conversationSearchInput` bulunamazsa veya disabled durumdaysa event sahiplenilmez ve browser'ın varsayılan davranışı engellenmez. Alan uygunsa focus edilir ve mevcut sorgu seçilerek yeni aramanın doğrudan yazılabilmesi sağlanır.

### `Esc`

Escape yalnız `#sendBtn` kontrolü `streaming` durumundaysa ele alınır. Aktif generation yoksa event'e dokunulmaz; modal, tarayıcı veya diğer UI katmanları Escape'i kullanmaya devam edebilir.

Aktif generation sırasında composer odakta olsa bile Escape stop kontrolünü çalıştırabilir. Bu davranış görünür stop düğmesiyle aynı kullanıcı niyetidir.

## Repeat ve event önceliği

- `event.repeat` kısayol çağrısı üretmez.
- Daha önce başka bir handler tarafından `preventDefault()` uygulanmış event tekrar işlenmez.
- `mount()` idempotenttir; aynı controller birden fazla global keydown listener eklemez.
- `destroy()` listener'ı kaldırır ve ikinci çağrıda yan etki üretmez.

## PWA davranışı

`/keyboard-shortcuts.js` sabit same-origin shell asset'idir ve service-worker cache listesinde bulunur. API istekleri yine network-only sınıfındadır; kısayol katmanı offline cache politikasını genişletmez.

## Bilerek eklenmeyenler

- Browser veya işletim sistemiyle güçlü çakışma riski taşıyan yeni pencere/incognito benzeri global kombinasyonlar.
- Tek tuşla otomatik mesaj gönderme.
- Klavye üzerinden dış servis write/send/merge işlemi.
- Kullanıcı tarafından özelleştirilen ve storage'a kalıcı yazılan global shortcut config'i.
- Model veya ajan tarafından runtime sırasında kısayol tanımlama.

Yeni kısayol eklemek için somut kullanıcı ihtiyacı, çakışma analizi ve regresyon testi gerekir.
