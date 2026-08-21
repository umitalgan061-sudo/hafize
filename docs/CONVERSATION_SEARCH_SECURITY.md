# Conversation search security boundary

Hafize'nin sohbet geçmişi araması sol menüdeki render edilmiş sohbet başlıklarını ve yalnız canonical sohbet deposundan alınan sınırlı kullanıcı/asistan mesaj gövdelerini arar.

## Veri sınırı

- Render edilmiş başlık kaynağı yalnız `.conversation-row .conversation-open` görünür metnidir.
- Mesaj gövdeleri DOM'dan, tool activity'den veya connector çıktısından okunmaz. Yalnız `HafizeConversationStorageGuard.sanitizeStoredValue(...)` tarafından doğrulanmış canonical conversation kayıtları indekslenir.
- Mesaj indeksinde yalnız `role: user` ve `role: assistant` kabul edilir; tool/system/trace metadata, owner ID, credential ve secret alanları corpus'a girmez.
- En fazla 30 sohbet, sohbet başına 120.000 karakter ve toplam 1.200.000 karakter indekslenir. Arama sorgusu en fazla 120 karakterdir.
- Storage guard veya canonical storage erişimi yoksa içerik araması fail-closed biçimde kapanır ve yalnız render edilmiş başlık araması sürer.
- Arama sırasında ağ isteği, API çağrısı, WebSocket, clipboard veya cookie erişimi yoktur.

## Lifecycle ve sahiplik

- Aynı `#conversationList` üzerinde yalnız bir conversation-search controller aktif olabilir. Duplicate controller kurulumu fail-closed olur.
- Controller kendi oluşturduğu search control ve style kaynaklarını bilir; foreign/existing `#conversationSearchControl` devralınmaz.
- Listener veya MutationObserver kurulumu yarıda kalırsa listener, style, control ve list ownership atomik olarak geri alınır.
- Filtreleme öncesinde her sohbet satırının mevcut `hidden` değeri snapshot edilir. Destroy veya failed-install sırasında yalnız controller'ın dokunduğu satırlar önceki görünürlüğüne exact restore edilir.
- Pending RAF/timer refresh destroy sırasında iptal edilir. İptal edilemeyen veya geç çalışan callback'ler canlı ownership doğrulaması olmadan storage okuyamaz ya da satır görünürlüğünü değiştiremez.
- Destroy edilen controller inert kalır ve aynı list üzerinde clean remount mümkündür.

## Kullanıcı kontrolü ve erişilebilirlik

- Arama alanı görünür ve `role="search"` taşır.
- `Escape` veya görünür `Temizle` düğmesi filtreyi kaldırır.
- Geçersiz/aşırı uzun sorgu sohbetleri gizlemek yerine fail-open davranır.
- Eşleşme sayısı `aria-live="polite"` durum metniyle bildirilir.
- Input `autocomplete="off"` ve `aria-controls="conversationList"` taşır.

## Yeniden render davranışı

Sohbet listesi yeniden render edildiğinde yalnız `#conversationList` child-list değişiklikleri izlenir. Refresh RAF varsa RAF, yoksa bounded zero-delay timer ile coalesce edilir. Storage değişikliği yalnız canonical conversation storage key'iyle eşleşiyorsa index yenilenir.

## PWA sınırı

`/conversation-search.js` statik shell asset'idir. `/api/*` istekleri service worker tarafından network-only kalır; sohbet/API cevapları cache'e alınmaz. Cached controller değiştiğinde shell cache sürümü yükseltilir.

## Geri alma

Bu özellik bağımsız shell enhancement'ıdır. Controller, testler, bu sözleşme ve ilgili PWA cache bump birlikte revert edilebilir; canonical conversation storage formatı veya backend tool izinleri değişmez.
