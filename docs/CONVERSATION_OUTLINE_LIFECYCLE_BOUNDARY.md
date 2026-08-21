# Conversation outline lifecycle boundary

## Amaç

`conversation-outline` yalnız mevcut konuşmadaki kullanıcı turlarını özetleyen ve ilgili mesaja odaklanan read-only bir Claude-benzeri gezinme yüzeyidir. Bu katman conversation storage yazmaz, ağ isteği başlatmaz, tool çağırmaz ve ajan yetkisi genişletmez.

## Ownership

- Aynı `#messages` kökü üzerinde aynı anda yalnız bir outline controller aktif olabilir.
- Ownership process-local `WeakSet` ile tutulur; controller DOM marker'ı dışarıdan silinse bile ikinci controller sessizce sahipliği devralamaz.
- `destroy()` ownership'i bırakır ve clean remount'a izin verir.
- Pre-existing `#conversationOutlinePanel` veya `.conversation-outline-trigger` foreign/host-owned kabul edilir; controller bunları devralmaz veya silmez.
- Pre-existing outline stylesheet korunur. Controller yalnız kendi eklediği stylesheet'i teardown sırasında kaldırır.

## Installation transaction

Panel/trigger, stylesheet, event listener'ları ve MutationObserver tek installation transaction'ı olarak ele alınır. Listener veya observer kurulumu yarıda kalırsa:

- kurulmuş listener'lar kaldırılır,
- observer kapatılır,
- pending refresh iptal edilir,
- controller-owned panel/trigger/style kaldırılır,
- geçici hedef vurguları ve controller'ın eklediği `tabindex` geri alınır,
- `#messages` ownership serbest bırakılır.

Yarım kurulum başarılı mount gibi bırakılmaz.

## Deferred work ve teardown

MutationObserver güncellemeleri tek pending RAF/timer refresh'e coalesce edilir. Controller destroy edildiğinde pending handle iptal edilir. Daha önce yakalanmış stale observer/RAF/event callback'leri canlı ownership doğrulaması olmadan DOM veya focus side effect üretemez.

Public `refresh`, `scheduleRefresh`, `show`, `close` ve `activateItem` yolları da lifecycle sınırını uygular; destroy edilmiş controller doğrudan çağrılsa bile inert kalır.

## Mesaj hedefleme

- Yalnız `user` mesajları ve normalize edilmiş bounded `data-message-id` değerleri outline'a girer.
- En fazla 100 kullanıcı turu gösterilir.
- Preview en fazla 92 karakterdir; arama sorgusu en fazla 120 karakterdir.
- Mesaj bulunamazsa focus/scroll yapılmaz ve bounded refresh istenir.
- Controller focus için geçici `tabindex=-1` eklerse highlight bitiminde veya teardown'da kaldırır.
- Host tarafından önceden verilmiş `tabindex` değeri değiştirilmeden korunur ve exact restore edilir.
- Scroll yalnız mevcut DOM mesajına yapılır; reduced-motion tercihi korunur.

## Güvenlik ve non-goals

Bu controller:

- local/session storage okuyup yazmaz,
- network/fetch kullanmaz,
- clipboard kullanmaz,
- form submit etmez,
- persistent memory yazmaz,
- OAuth veya secret erişimi istemez,
- tool/agent permission değerlendirmez.

Backend default-deny tool authorization ve dış yazma approval sözleşmeleri bu UI katmanından bağımsız kalır.

## DoD

Değişiklik kabul edilirken en az şu regresyonlar korunmalıdır:

1. duplicate ownership fail-closed,
2. clean remount,
3. foreign panel/style preservation,
4. partial listener/observer rollback,
5. pending refresh cancellation ve stale callback inertliği,
6. controller-added `tabindex` restoration,
7. host `tabindex` preservation,
8. mevcut helper sınırları ve 100-item corpus limiti.
