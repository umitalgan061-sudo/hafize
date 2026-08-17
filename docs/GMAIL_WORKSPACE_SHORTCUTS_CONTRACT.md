# Gmail Workspace Shortcuts Contract

## Amaç

Bu enhancement, bağlı Gmail hesabındaki mevcut **salt-okunur** ajan aracını sohbet arayüzünde daha keşfedilebilir hale getirir. Kullanıcı hazır Gmail görevlerinden birini seçebilir veya kısa bir arama konusu yazabilir; sonuç yalnız mevcut Hafize composer'ında düzenlenebilir bir taslak olarak hazırlanır.

Bu özellik Gmail API'sine doğrudan bağlanan ikinci bir istemci oluşturmaz. Gmail okuma işlemi ancak kullanıcı taslağı kontrol edip gönderdiğinde ve mevcut agent/tool runtime koşulları izin verdiğinde backend üzerinden gerçekleşebilir.

## Açık kullanıcı eylemi

Kısayol seçimi mesaj göndermez. `requestSubmit()`, form `submit()`, send düğmesi click'i veya benzeri otomatik gönderim yolu kullanılmaz.

Composer'da anlamlı bir taslak varsa yeni Gmail isteği mevcut içeriğin üzerine yazılmaz. Aktif streaming sırasında yeni taslak hazırlanmaz. Kullanıcı son metni her zaman görür, değiştirebilir veya tamamen silebilir.

Araç modu kapalıysa görünür durum bunu açıklar. `Araç modunu aç` düğmesi yalnız kullanıcının kendi click'iyle mevcut `#toolModeBtn` click yolunu çağırır. Gmail workspace kendiliğinden tool modunu açmaz ve tool permission politikasını değiştirmez.

## Gmail sınırı

Hazır görevler yalnız okuma niyeti taşır:

- son e-postaları inceleme,
- okunmamış e-postaları inceleme,
- dikkat gerektiren son e-postaları değerlendirme,
- kullanıcının girdiği bounded ifadeyle ilgili e-postaları arama.

Her hazır prompt gönderme, silme, arşivleme, etiketleme veya değiştirme yapılmamasını açıkça belirtir. Bununla birlikte gerçek güvenlik prompt metnine dayanmaz: mevcut Gmail backend boundary yalnız `profile.get`, `message.list` ve `message.get` operasyonlarını allowlist eder ve `gmail.readonly` scope'unu zorunlu tutar.

## Veri ve secret sınırı

Gmail workspace:

- `localStorage`, `sessionStorage`, IndexedDB veya cookie okumaz/yazmaz,
- clipboard kullanmaz,
- access/refresh token, Google client secret, owner ID veya connector bearer tokenı okumaz,
- `fetch`, XHR, WebSocket, EventSource veya sendBeacon kullanmaz,
- Gmail mesaj içeriğini ayrı bir kalıcı kopyaya dönüştürmez,
- doğrudan Google/Gmail originine istek göndermez.

Bağlantı görünürlüğü yalnız mevcut `#gmailConnectionStatus[data-state]` DOM durumundan türetilir.

## Girdi sınırları

Serbest Gmail arama konusu en fazla **120 karakter** olabilir. Boş değerler ve kontrol karakterleri reddedilir; whitespace tek boşluğa normalize edilir. Kullanıcı girdisi oluşturulan prompt içinde `JSON.stringify` ile açıkça sınırlandırılır.

Oluşturulabilen composer prompt'u en fazla **900 karakter** ile sınırlandırılır. Hazır prompt seti immutable ve kod içinde allowlist'tir; model, Gmail verisi veya dış içerik yeni bir hazır komut üretemez.

## Erişilebilirlik ve lifecycle

Durum alanı `role=status`, `aria-live=polite` ve `aria-atomic=true` kullanır. Mobilde etkileşim hedefleri en az 44 px olur. `focus-visible`, reduced-motion ve forced-colors davranışları tanımlıdır.

Gmail bağlantı durumu, tool modu ve streaming sınıfı MutationObserver ile izlenir. Controller `destroy()` çağrısında observer ve listener'ları temizler, ürettiği DOM'u kaldırır.

## PWA ve geri alma

`gmail-workspace.js`, `gmail-workspace-style.js` ve `gmail-workspace.css` PWA shell allowlist'indedir; `/api/*` istekleri service worker açısından network-only kalır.

Revert için bu üç asset, testler, bu belge ve `chat-run-controller.js` / `sw-policy.js` wiring'i kaldırılır. Gmail OAuth, token store, agent registry, tool boundary veya server endpointlerinde migrasyon yoktur.
