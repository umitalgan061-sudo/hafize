# Persistence Sözleşmesi

Conversation storage mevcut localStorage anahtarını kullanır.

Yeni response alanları aynı JSON message object içinde tutulur.

Başarılı generation saveConversations ile kalıcı hale gelir.

Restore saveConversations ile kalıcı hale gelir.

Feedback saveConversations ile kalıcı hale gelir.

Kopyalama persistence yapmaz.

Başarısız regeneration eski content'i tekrar kaydeder.

Storage write başarısız olursa mevcut persistence warning mekanizması çalışır.

Yeni ayrı database veya IndexedDB katmanı yoktur.

Storage migration gerekmeden backward compatibility sağlanır.
