# Conversation edit branch contract

Hafize'de geçmiş bir kullanıcı mesajındaki **Düzenle** eylemi artık mevcut sohbet geçmişini yerinde değiştirmez. Düzenleme, kaynak konuşmayı koruyan yeni bir conversation branch oluşturur.

## Davranış

- Yalnız aktif konuşmadaki canonical bir `user` mesajı hedeflenebilir.
- Yeni dal, hedef kullanıcı mesajından **önceki** canonical mesajları yeni message ID'leriyle kopyalar.
- Hedef mesajın eski metni yeni dalın geçmişine yazılmaz; en fazla 12.000 karakterlik düzenlenebilir taslak olarak composer'a aktarılır.
- Kaynak conversation değişmeden kalır.
- Agent ve tool-mode conversation metadata'sı korunur; mevcut güvenli model tercihi best-effort olarak yeni conversation ID'sine kopyalanır.
- Yeni konuşma mevcut `HafizeConversationStorageGuard` üzerinden yazılır; count/content/role allowlist ve concurrent-tab reconciliation sınırlarını atlayamaz.
- Mesaj otomatik gönderilmez. Kullanıcı metni değiştirdikten sonra normal **Gönder** eylemini ayrıca vermelidir.

## Taslak handoff sınırı

Reload sonrasında composer'a taşınması gereken metin yalnız `sessionStorage` içindeki `hafize.edit-branch-draft.v1` anahtarında geçici tutulur. Kayıt yalnız:

- bounded `conversationId`,
- en fazla 12.000 karakterlik düz metin,
- oluşturulma zamanı

alanlarını taşır. Handoff en fazla 90 saniye geçerlidir ve başarılı restore sonrası tek kullanımlık olarak silinir. Token, cookie, owner/trace, tool sonucu veya credential içermez.

Session storage kullanılamıyorsa dal kalıcı storage'a yazılmadan işlem fail-closed durur. Persist işlemi başarısız olursa staged handoff temizlenir.

## Veri kaybı ve yarış koruması

- Streaming sürerken düzenleme dalı oluşturulamaz.
- Composer'da gönderilmemiş bir taslak varsa mevcut taslak sessizce ezilmez; işlem reddedilir.
- DOM'daki hedef mesaj canonical aktif conversation ile eşleşmiyorsa işlem reddedilir.
- Aynı message ID birden fazla canonical conversation içinde bulunursa belirsizlik fail-closed reddedilir.
- Yeni conversation'ın storage'a gerçekten yazıldığı yeniden okunarak doğrulanmadan reload yapılmaz.

## Yetki sınırı

Bu özellik yeni backend endpoint'i, provider isteği, connector veya agent tool yetkisi açmaz. GitHub/Gmail/Canva gibi dış write/send/merge işlemlerinin mevcut explicit approval sınırları değişmez. `denyByDefault` agent tool policy ve dört profilli selector/specialist roster aynen korunur.

## Geri alma

Revert için `public/message-edit.js` eski composer-only davranışına döndürülür ve bu sözleşme ile ilgili testler kaldırılır. Conversation schema migrasyonu yoktur; oluşturulmuş branch'ler normal Hafize conversations olarak kalır.
