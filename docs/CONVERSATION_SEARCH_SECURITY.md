# Conversation search security boundary

Hafize'nin sohbet geçmişi araması yalnız sol menüde zaten render edilmiş **sohbet başlıklarını** filtreler.

## Veri sınırı

- Arama corpus'u yalnız `.conversation-row .conversation-open` görünür başlık metnidir.
- Mesaj gövdesi, tool activity, trace metadata, owner ID veya credential aranmaz ve indekslenmez.
- Controller `localStorage` / `sessionStorage` okumaz veya yazmaz. Mevcut sohbet saklama modeli `app.js` sorumluluğunda kalır.
- Arama sorgusu yalnız sayfa belleğinde input değeri olarak yaşar; reload sonrasında korunmaz.
- Arama sırasında ağ isteği, API çağrısı, WebSocket, clipboard veya cookie erişimi yoktur.

## Kullanıcı kontrolü

- Arama alanı görünür ve `role="search"` taşır.
- Sorgu en fazla **120 karakterdir**.
- `Escape` veya görünür `Temizle` düğmesi filtreyi kaldırır.
- Geçersiz/aşırı uzun sorgu sohbetleri gizlemek yerine fail-open davranır.
- Eşleşme sayısı `aria-live="polite"` durum metniyle bildirilir.

## Yeniden render davranışı

`app.js` sohbet listesini `replaceChildren()` ile yeniden oluşturduğu için controller yalnız `#conversationList` child-list değişikliklerini izler ve mevcut sorguyu yeni satırlara tekrar uygular. Mesaj DOM'u gözlemlenmez.

## PWA sınırı

`/conversation-search.js` statik shell asset'idir. `/api/*` istekleri service worker tarafından network-only kalır; sohbet/API cevapları cache'e alınmaz.

## Geri alma

Bu özellik bağımsız shell enhancement'ıdır. Loader satırı, `/conversation-search.js`, PWA shell kaydı, bu doküman ve test kaldırıldığında `app.js` içindeki sohbet geçmişi davranışı değişmeden kalır.
