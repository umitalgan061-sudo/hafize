# Chat Markdown Rollback

## Amaç

Markdown renderer bağımsız bir presentation katmanıdır. Bir regresyon olduğunda konuşma state'i, Message Workspace ve Conversation Workspace korunarak yalnız bu katman geri alınabilmelidir.

## Öncelik

Önce yeni shell assetlerinin yüklenmesini durdurmak için `public/index.html` içindeki Markdown CSS/JS referansları geri alınır. Ardından service worker shell listesi eski haline döndürülür ve cache revision bir sonraki kontrollü sürümle yenilenir.

Renderer dosyaları kaldırıldığında `app.js` eski textContent davranışına geri döner. Bu nedenle mevcut konuşma mesajlarının içeriği kaybolmaz.

## PWA

Eski cache'i zorla elle silmek yerine yeni bir revision yayınlamak tercih edilir. Eski `hafize-shell-v24` cache'i browser lifecycle ile temizlenebilir. API cache davranışına dokunulmaz.

## Veri

Renderer hiçbir storage anahtarını değiştirmediği için rollback sırasında migration veya data repair gerekmez. Conversation ve message workspace verileri olduğu gibi kalır.

## Test

Rollback sonrası `test-pwa-cache-policy`, conversation workspace, message workspace ve chat history testleri yeniden çalıştırılır. Asistan yanıtının plain text gösterilebilmesi minimum işlevsel DoD'dir.

## İnsan kararı gereken durum

Renderer güvenlik sınırının ihlal edildiği bir bulgu varsa yalnız CSS/UX rollback yeterli değildir. Link allowlist, DOM sink ve network boundary review edilmelidir. Böyle bir durumda yeni feature açılmadan önce güvenlik regresyonu kapatılır.
