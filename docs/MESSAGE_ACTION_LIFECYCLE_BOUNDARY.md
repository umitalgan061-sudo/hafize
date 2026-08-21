# Message action lifecycle boundary

`public/message-copy.js` Claude-benzeri sohbet yüzeyindeki mesaj eylemlerini yönetir: kopyalama, alıntılama ve kullanıcının kendi mesajını canonical composer üzerinden tekrar gönderme.

Bu controller yeni bir network/tool yetkisi değildir. Clipboard yazımı yalnız tarayıcının `navigator.clipboard.writeText` sınırında yapılır; resend ise mevcut `#composer.requestSubmit()` yolunu kullanır. Kaynak mesaj içeriği dışında storage, cookie, credential veya secret okunmaz.

## Ownership

- Aynı `#messages` kökü aynı anda yalnız bir aktif message-action controller tarafından sahiplenilebilir.
- Duplicate controller mount fail-closed döner; ikinci controller mevcut action shell'lerini devralmaz.
- Controller yalnız `data-hafize-owned-message-actions="1"` ile kendi oluşturduğu action shell'lerini kaldırır.
- Host veya başka bir özellik tarafından önceden eklenmiş `.message-copy-actions` yüzeyi korunur ve decorate edilmez.
- Style zaten host tarafından sağlanmışsa controller onu sahiplenmez veya teardown sırasında silmez.

## Atomik installation

Mount sırası ownership claim, style kurulumu, mevcut mesaj decoration ve optional MutationObserver kurulumudur.

Bu adımlardan biri hata verirse:

- observer kapatılır,
- kurulmuş button listener'ları kaldırılır,
- transient reset timer'ları temizlenir,
- controller-owned action shell'leri kaldırılır,
- controller-owned style kaldırılır,
- `#messages` ownership'i serbest bırakılır.

Yarım kurulum sonraki temiz remount'u engellememelidir.

## Teardown ve stale callback sınırı

Destroy sonrasında controller inert kabul edilir.

- Eski click closure'ları composer değerini değiştiremez veya submit başlatamaz.
- Eski MutationObserver callback'i yeni mesajları decorate edemez.
- Geç reset timer callback'i teardown sonrası button state'ini değiştiremez.
- Clipboard Promise'i destroy sonrasında resolve/reject olursa eski controller UI durumunu yeniden canlandıramaz.
- Public `copyMessage`, `quoteMessage` ve `resendMessage` çağrıları destroy sonrası side effect üretmez.

Clipboard yazımı Promise tamamlanmadan önce tarayıcıya teslim edilmiş olabilir; bu yüzden teardown tamamlanmış bir clipboard operasyonunu geri almaya çalışmaz. Sınır, yalnız geç completion'ın UI/controller state'ini yeniden canlandırmasını engeller.

## Composer veri koruması

Resend ve quote mevcut veri koruma davranışlarını korur:

- 12.000 karakter composer sınırı aşılmaz.
- Aktif streaming sırasında resend yapılmaz.
- Farklı bir gönderilmemiş taslak varsa resend draft'ı ezmez.
- Quote mevcut taslağı korur ve yalnız bounded alıntıyı ekler.
- Resend ayrı fetch/network yolu oluşturmaz; canonical form submit kullanılır.

## Clipboard sınırı

- Clipboard yalnız secure context + `writeText` mevcutsa kullanılır.
- Clipboard read yetkisi kullanılmaz.
- Provider/clipboard exception metni kullanıcıya veya modele taşınmaz.
- Kopyalanacak metin 256 KiB karakter sınırı ile bounded kalır.

## DoD / regresyon kanıtı

Aşağıdaki senaryolar testle sabitlenmelidir:

1. duplicate ownership fail-closed ve clean remount,
2. controller-owned action/style teardown ile kaldırılırken host-owned yüzeylerin korunması,
3. observer/listener/style installation failure sonrası exact rollback,
4. stale click ve observer callback'lerinin teardown sonrası inertliği,
5. geç clipboard success/failure completion karantinası,
6. transient timer cleanup ve stale timer inertliği,
7. destroy sonrası direct public side-effect çağrılarının reddi,
8. streaming/draft/composer-size veri korumalarının korunması,
9. PWA shell cache'in değişen client modülüyle birlikte bump edilmesi.
