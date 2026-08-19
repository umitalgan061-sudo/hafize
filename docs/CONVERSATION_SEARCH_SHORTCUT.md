# Conversation search keyboard shortcut

Hafize'nin canonical conversation content search özelliği klavyeden hızlı erişim için `Ctrl/⌘ + Shift + F` kısayolunu kullanır.

## Davranış

- Kısayol yalnız mevcut `#conversationSearchInput` alanına odaklanır.
- Arama alanında mevcut bir sorgu varsa metin seçilir; kullanıcı doğrudan yeni sorgu yazabilir.
- Arama alanı yoksa veya disabled ise event tüketilmez ve tarayıcı/uygulamanın normal davranışı korunur.
- `event.repeat` tekrarları işlenmez.
- Mevcut `Ctrl/⌘ + K` composer odağı, `/` composer odağı ve `Escape` stream durdurma davranışları değişmez.

## Veri ve güvenlik sınırı

Bu kısayol yeni bir arama motoru veya veri erişim yolu açmaz. Yalnız #305'teki conversation search input'una odaklanır. Canonical içerik indeksi `HafizeConversationStorageGuard` çıktısıyla sınırlı kalır; sorgu backend'e, memory API'ye veya persistent storage'a gönderilmez.

Kısayol:

- network isteği başlatmaz,
- mesaj veya tool çağrısı göndermez,
- local/session storage yazmaz,
- cookie/token/credential okumaz,
- agent tool permission genişletmez.

Dört profilli selector/specialist roster ve backend default-deny tool authorization sözleşmesi değişmez.

## Doğrulama

`scripts/test-conversation-search-shortcut.mjs` Windows/Linux `Ctrl`, macOS `⌘`, modifier allowlist'i, repeat suppression, disabled/missing search alanında fail-open davranışı ve mevcut composer `Ctrl/⌘ + K` kısayoluyla birlikte çalışmayı doğrular.
