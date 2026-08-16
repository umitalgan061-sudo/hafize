# Sohbet listesi klavye gezinmesi

## Amaç

Sol menüde uzun sohbet geçmişinde fare kullanmadan hızlı ve öngörülebilir gezinme sağlamak.

## Tuşlar

- `ArrowUp` / `ArrowDown`: görünür önceki veya sonraki sohbet başlığına odaklanır.
- `Home`: ilk görünür sohbet başlığına gider.
- `End`: son görünür sohbet başlığına gider.
- Liste sınırında wrap yapılmaz.
- `Enter` ve `Space` doğal button davranışına bırakılır; controller sohbet açma click'i üretmez.

Conversation search tarafından gizlenen satırlar ve disabled/hidden düğmeler gezinme dizisine alınmaz. Modifier tuşlarıyla gelen kombinasyonlar ve düzenlenebilir alanlar ele geçirilmez.

## Güvenlik sınırı

Controller yalnız sohbet listesi DOM görünürlüğü ve focus konumuyla ilgilenir. Mesaj içeriği, conversation storage, agent/tool metadata, network, clipboard, cookie veya secret erişimi yoktur. Backend default-deny tool permission ve dış yazma/gönderme/merge onay sözleşmesi değişmez.
