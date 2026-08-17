# Conversation Organization Contract

## Amaç

Hafize'nin yerel sohbet geçmişinde kullanıcı iki açık organizasyon eylemine sahiptir:

- bir sohbeti önemli olarak sabitlemek,
- otomatik üretilen sohbet başlığını görünümde özel bir başlıkla değiştirmek.

Bu özellik sohbet mesajlarının, ajan ayarlarının veya backend verisinin yeni bir kopyasını üretmez.

## Veri modeli

Kaynak sohbet geçmişi değişmeden `hafize.conversations.v1` anahtarında kalır. Organizasyon katmanı bu anahtarı salt-okunur kullanır.

Kullanıcı tercihleri ayrı `hafize.conversation-organize.v1` anahtarında tutulur. Her kayıt yalnız şunları içerir:

- `id`: doğrulanmış conversation kimliği,
- `title`: isteğe bağlı özel görünüm başlığı,
- `pinned`: boolean sabitleme durumu.

En fazla 30 kayıt tutulur. Conversation ID en fazla 160 karakter ve dar alfanümerik `._:-` allowlist'ine uyar. Özel başlık whitespace normalize edildikten sonra 1–80 karakterdir.

Mesaj gövdesi, model adı, agent kimliği, tool activity, trace, memory, connector sonucu, token veya credential organizasyon storage'ına yazılmaz.

## Başlık davranışı

Başlık düzenleme yalnız kullanıcı `✎` düğmesine bastığında açılır. Kullanıcı `Kaydet` ile geçerli özel başlığı açıkça yazar. `Otomatik` eylemi özel başlığı kaldırıp uygulamanın kendi başlığına döner. `Vazgeç` ve `Escape` değişiklik yapmaz.

Render yalnız `textContent` kullanır. Kullanıcı başlığı HTML olarak parse edilmez.

Bu katman çekirdek conversation nesnesinin `title` alanını değiştirmez; yalnız sidebar görünüm tercihini tutar. Böylece rollback ve mevcut conversation şeması geriye uyumlu kalır.

## Sabitleme davranışı

`☆` düğmesi açık kullanıcı eylemiyle `★` durumuna geçer. Sabitlenen sohbetler sidebar'da önce gösterilir. Sabitlenenler kendi aralarında ve sabitlenmeyenler kendi aralarında çekirdek uygulamanın mevcut sırasını korur.

Pin sırası yalnız DOM görünümüdür. Mesaj zamanı, `updatedAt`, aktif sohbet veya backend state'i değiştirilmez.

## Rerender ve sekmeler arası senkronizasyon

Çekirdek uygulama sidebar listesini yeniden oluşturduğunda MutationObserver yeni satırları mevcut `hafize.conversations.v1` sırasıyla güvenli conversation ID'lerine bağlar, kullanıcı metadata'sını tekrar uygular ve pin görünüm sırasını yeniden kurar.

Başka sekmede aynı organizasyon anahtarı değişirse `storage` eventi görünümü yeniler. Artık kaynak conversation listesinde bulunmayan metadata kayıtları bounded cleanup ile kaldırılır.

## Güvenlik sınırı

Bu özellik:

- backend endpoint çağırmaz,
- `fetch`, XHR, WebSocket, EventSource veya sendBeacon kullanmaz,
- clipboard veya cookie okumaz,
- IndexedDB kullanmaz,
- GitHub/Gmail/Canva/NVIDIA/tool permission üretmez,
- external write/send/merge işlemi yapmaz,
- `.env`, credential veya workflow dosyasına dokunmaz.

Tek kalıcı yazma yüzeyi açık kullanıcı organizasyon tercihi olan `hafize.conversation-organize.v1` anahtarıdır. Kaynak `hafize.conversations.v1` bu enhancement tarafından hiçbir zaman yazılmaz.

## Erişilebilirlik

Pin native `button` ve `aria-pressed` kullanır. Rename editor native form/input/button öğelerinden oluşur. Mobilde pin/rename ve edit formu hedefleri en az 44px'tir. Focus-visible, reduced-motion ve forced-colors davranışları korunur.

## Fail-safe davranışı

Bozuk veya beklenmeyen organization JSON boş metadata olarak değerlendirilir. Geçersiz conversation ID veya başlık reddedilir. Storage yazımı başarısız olsa bile çekirdek sohbet geçmişi değiştirilmez; geçici UI davranışı sayfa belleğiyle devam edebilir.

## Geri alma

Revert için `conversation-organize.js`, `conversation-organize.css`, ilgili testler, bu sözleşme ve chat-run/PWA wiring kaldırılır. Kaynak conversation schema veya server state için migration yoktur.
