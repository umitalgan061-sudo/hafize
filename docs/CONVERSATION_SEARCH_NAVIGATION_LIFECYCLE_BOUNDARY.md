# Conversation search navigation lifecycle boundary

`public/conversation-search-navigation.js`, arama sorgusu aktifken görünür sohbet satırları arasında klavye veya önceki/sonraki düğmeleriyle gezinmeyi sağlar. Bu yüzey canonical konuşma verisini değiştirmez; yalnız kullanıcı odağını görünür `.conversation-open` kontrollerine taşır.

## Ownership

- Aynı `#conversationList` üzerinde aynı anda yalnız bir navigation controller canlı olabilir.
- Ownership DOM marker'ına tek başına bağlı değildir; controller, liste nesnesini process-local `WeakSet` ile sahiplenir.
- Navigation DOM'u dışarıdan kaldırılmış olsa bile ikinci controller ilk controller teardown yapmadan aynı listeyi devralamaz.
- Önceden mevcut `#conversationSearchNavigation` yüzeyi foreign/host-owned kabul edilir ve fail-closed biçimde devralınmaz.
- Önceden mevcut style node'u korunabilir; controller yalnız kendi oluşturduğu style node'unu kaldırır.

## Atomic installation

Mount ancak input, search control ve conversation list birlikte mevcutsa başlar. Controller kendi navigation yüzeyini oluşturduktan sonra gereken previous/next/status elemanlarını doğrular. Click, input ve document keyboard listener'ları ile opsiyonel MutationObserver aynı installation transaction'ının parçalarıdır.

Listener target, observer constructor/observe veya DOM append aşamalarından biri başarısız olursa:

1. kurulmuş listener'lar ters sırada kaldırılır,
2. observer best-effort disconnect edilir,
3. controller-owned navigation kaldırılır,
4. controller-owned style kaldırılır,
5. conversation-list ownership serbest bırakılır,
6. controller mounted sayılmaz.

Böylece yarım installation sonraki clean mount'u engellemez.

## Teardown ve stale callback sınırı

`destroy()` idempotenttir ve controller'ı kalıcı olarak inert yapar. Teardown sonrası stale click, input, keydown veya MutationObserver callback'i:

- odağı değiştiremez,
- navigation index'ini ilerletemez,
- status metnini değiştiremez,
- DOM yüzeyi yeniden oluşturamaz.

Public `move`, `reset` ve `render` yöntemleri de canlı ownership'i yeniden doğrular. Eski controller'a doğrudan referans tutulması teardown sonrasında side effect üretmez.

## Klavye sınırı

Kısayol yalnız `Alt+ArrowDown` / `Alt+ArrowUp` için çalışır. Ctrl, Meta, Shift veya repeat event'leri kabul edilmez. Event hedefi arama input'u, navigation yüzeyi veya o anda görünür eşleşme düğmelerinden biri değilse kısayol işlenmez.

Bu davranış global klavye event'lerinin ilgisiz UI alanlarında odağı beklenmedik şekilde taşımasını önler.

## Görünür hedefler

Navigation yalnız `.conversation-row:not([hidden])` mantığına eşdeğer biçimde `hidden !== true` satırları ve bunların focus edilebilir `.conversation-open` kontrollerini kullanır. Arama controller'ı tarafından gizlenmiş veya host tarafından görünmez bırakılmış satırlar navigation hedefi olmaz.

Query boşsa navigation devre dışıdır. Görünür satır seti MutationObserver ile değiştiğinde current index sıfırlanır; böylece eski index yeni filtre sonucunda yanlış satıra bağlanmaz.

## Focus failure

Target `focus()` exception üretirse hata dışarı taşınmaz. Current index yeniden `-1` yapılır ve status güncel eşleşme sayısına geri döner. Başarısız focus başarılı navigation olarak raporlanmaz.

## Güvenlik ve veri sınırı

Bu controller:

- network isteği başlatmaz,
- local/session storage okumaz veya yazmaz,
- conversation message gövdesi işlemez,
- secret/credential erişmez,
- agent/tool yetkisi değiştirmez,
- dış servis write/send/merge işlemi yapmaz.

Canonical search corpus ve host-hidden visibility sınırları `docs/CONVERSATION_SEARCH_SECURITY.md` içinde tanımlıdır; bu belge yalnız navigation lifecycle ve ownership sözleşmesini tamamlar.

## DoD regresyonları

En az şu davranışlar testle korunmalıdır:

- normal next/previous wrap ve status sayacı,
- duplicate controller rejection ve clean remount,
- DOM dışarıdan silinse bile ownership'in korunması,
- destroy sonrası stale callback inertliği,
- document shortcut target/modifier sınırı,
- hidden-row mutation sonrası index reset,
- focus exception containment,
- partial listener rollback,
- observer failure rollback,
- foreign navigation preservation,
- host style preservation,
- malformed generated surface rollback.
