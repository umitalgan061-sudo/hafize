# Mesaj klavye gezinimi sözleşmesi

`public/message-keyboard-nav.js`, sohbet mesajlarını roving-tabindex modeliyle klavyeden erişilebilir hale getirir.

## Davranış

- Sohbet alanına Tab ile girildiğinde yalnız bir mesaj normal tab sırasına alınır.
- Mesajın kendisi odaktayken `ArrowUp`, `ArrowDown`, `Home` ve `End` ile önceki/sonraki/ilk/son mesaja geçilir.
- Düğme, bağlantı, input, textarea, select, summary veya contenteditable hedeflerinde tuşlar ele geçirilmez.
- Odaklanan mesaj görünür alana `nearest` davranışıyla getirilir.
- Yeni mesaj render edildiğinde MutationObserver roving tabindex sözleşmesini tekrar uygular.

## Güvenlik

Bu controller sohbet içeriğini değiştirmez; network, storage, clipboard, submit veya tool çağrısı yapmaz. Backend tool permission ve approval sınırlarına dokunmaz.

## PWA

`/message-keyboard-nav.js` same-origin shell asset olarak cache v45 kapsamındadır. `/api/*` network-only kalır.

## Geri alma

Controller, loader/PWA kaydı, testler ve bu belge kaldırılırsa mesajların mevcut görsel/içerik davranışı korunur; yalnız klavye odak/gezinim desteği kaybolur.
