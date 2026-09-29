# Konuşma Dalları Olay Sözleşmesi

## hafize:open-conversation
Payload: { conversationId: string }

Amaç: app-shell aktif conversation seçimini tek bir kaynağa bırakmak.

Geçersiz veya bulunmayan id sessizce yok sayılır. Streaming sırasında state değişimi reddedilir.

## hafize:conversation-forks-changed
Payload: { conversationId: string, forkId: string }

Amaç: sidebar branch paneli ile mesaj actionlarının aynı local state'i yeniden okumasını sağlamak.

Bu olay network veya analytics anlamına gelmez.

## storage
Fork modülü hafize.conversations.v1 storage event'ini yalnız refresh tetikleyicisi olarak dinler.
