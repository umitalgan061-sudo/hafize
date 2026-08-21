# Conversation keyboard navigation lifecycle boundary

`public/conversation-keyboard-nav.js` yalnız sohbet listesindeki görünür `.conversation-open` düğmeleri arasında ArrowUp, ArrowDown, Home ve End ile odak taşır. Bu yardımcı hiçbir ağ, storage, clipboard, submit veya dış sistem yetkisine sahip değildir.

## Ownership

Bir `document` üzerinde aynı anda yalnız bir keyboard-navigation controller aktif olabilir. İkinci mount fail-closed döner ve ikinci `keydown` listener kurmaz. Controller destroy edildiğinde ownership bırakılır; yeni controller temiz biçimde mount olabilir.

Ownership yalnız DOM marker'ına dayanmaz. Host DOM'u değişse veya eski listener referansı başka bir kodda tutulsa bile generation guard eski lifecycle callback'lerini inert tutar.

## Root identity

Controller mount sırasında exact `#conversationList` root'unu sahiplenir. Her key eventinde document'in hâlâ aynı root'u döndürdüğü yeniden doğrulanır. Liste root'u değiştirilmişse eski controller yeni veya eski DOM üzerinde odak hareketi üretmez. Yeni root için eski controller destroy edilmeli ve temiz mount yapılmalıdır.

Bu kural, stale event closure'larının yeni sohbet listesine beklenmedik şekilde etki etmesini önler.

## Atomic installation and teardown

Mount için hedef listenin hem `addEventListener` hem `removeEventListener` sağlaması gerekir. Listener kurulumu hata verirse document ownership hemen geri bırakılır ve sonraki temiz mount engellenmez.

Destroy listener kaldırmayı best-effort dener; host `removeEventListener` sırasında hata verse bile controller önce generation'ı kapatır ve ownership'i bırakır. Böylece fiziksel olarak hostta kalmış eski callback yan etki üretemez.

## Keyboard behavior

- Modifier tuşlarıyla gelen hareketler işlenmez.
- Input, textarea, select ve contenteditable hedeflerde liste navigasyonu devreye girmez.
- Hidden, row-hidden ve disabled sohbetler hedef listeden çıkarılır.
- Sınırda veya tek görünür sohbet varken browser default davranışı gereksiz yere engellenmez.
- Hedef focus başarısızsa event prevent edilmez.
- Focus başarılı fakat `scrollIntoView` hata verirse focus hareketi geçerli kalır; scroll best-effort'tür.
- Focus `preventScroll: true`, ardından scroll `block: nearest` ve `inline: nearest` ile yapılır.

## Fail-closed host faults

Document query, liste query veya tekil row incelemesi hata verdiğinde controller yanlış bir hedef tahmin etmez. Document/root doğrulaması başarısızsa event tamamen işlenmeden bırakılır; malformed tek bir row ise görünür hedeflerden çıkarılır.

## Non-goals

- Controller sohbet açmaz, silmez, yeniden sıralamaz veya seçili sohbet state'ini yazmaz.
- DOM root değişimini kendiliğinden sahiplenmez; yeni root açık bir lifecycle remount gerektirir.
- Global keyboard shortcut katmanı değildir ve editable composer girdilerini ele geçirmez.
- Focus hedefi üretmek için gizli ya da disabled satırları geçici olarak etkinleştirmez.
- Browser/OS seviyesinde key mapping değiştirmez ve yeni tool permission istemez.

Bu sınır erişilebilirlik davranışını korurken controller lifecycle'ının duplicate mount, stale callback ve DOM replacement yarışlarında deterministik kalmasını amaçlar.
