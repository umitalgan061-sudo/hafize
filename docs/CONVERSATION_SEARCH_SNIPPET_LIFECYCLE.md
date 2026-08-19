# Conversation search snippet lifecycle

Snippet controller teardown sonrasında tamamen inert kalır. Queued animation-frame callback destroy'dan sonra canonical storage okumaz veya DOM'a snippet yazmaz. Double mount fail-closed reddedilir; temiz destroy sonrasında aynı controller yeniden mount edilebilir.

`input`, `storage` ve `hafize:conversation-storage-merged` listener'ları exact handler referanslarıyla kaldırılır; MutationObserver kapatılır ve oluşturulmuş snippet node'ları temizlenir. Controller input/list referanslarını bırakır.

Veri sınırı değişmez: snippet yalnız canonical storage guard çıktısındaki `user` / `assistant` mesajlarından, en fazla 30 sohbet × 200 mesaj ve yaklaşık 180 karakterlik görünür bağlam üretir. Yeni network isteği, persistent storage alanı, secret erişimi veya agent tool permission eklenmez.
