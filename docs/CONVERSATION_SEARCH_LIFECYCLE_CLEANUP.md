# Conversation search lifecycle cleanup

Sohbet arama controller'ı mount/destroy döngüsünde listener ve DOM sahipliğini açıkça takip eder.

- `input`, `keydown` ve clear-button handler'ları named function olarak bağlanır ve aynı referanslarla kaldırılır.
- Root `storage` ve `hafize:conversation-storage-merged` listener'ları destroy sırasında kaldırılır.
- MutationObserver kapatılır.
- Destroy sonrasında sırada bekleyen animation-frame refresh'i canonical storage veya DOM'a yeniden dokunmaz.
- Controller detached `input`, `button`, `status` ve `list` referanslarını bırakır.
- Controller kendi oluşturmadığı mevcut search control DOM'unu destroy sırasında kaldırmaz.
- Aynı controller ikinci kez eşzamanlı mount edilmeyi fail-closed reddeder; temiz destroy sonrasında yeniden mount edilebilir.

Bu değişiklik veri sözleşmesini genişletmez. Canonical storage guard, yalnız user/assistant içerik indeksleme sınırı ve 30 sohbet / 1.2M karakter bütçesi değişmez. Yeni network isteği, backend endpoint, provider/connector çağrısı, persistent key, secret erişimi veya agent tool permission eklenmez.
