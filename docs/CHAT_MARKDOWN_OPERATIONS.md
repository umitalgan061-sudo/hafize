# Chat Markdown Operasyon Karar Kaydı

Bu özellik yalnız chat presentation katmanını genişletir. Server API, session auth, connector auth, agent registry ve tool policy değişmez.

## Veri sınırı

Renderer'ın tuttuğu tek geçici state DOM `data-*` metadata'sıdır. Bu state kullanıcı sohbet verisinin yeni bir kalıcı kopyası değildir. Source, DOM ağacından bağımsız olarak gerektiğinde yeniden üretilebilir.

## Hata sınırı

Parser beklenmedik input için exception yerine mümkün olan en küçük düz text davranışına düşer. Link parser geçersiz URL'yi link node'una dönüştürmez. Clipboard hatası yalnız copy UI'sini etkiler.

## Resource sınırı

Input, block, list, table, inline ve code limitleri farklı saldırı şekillerini sınırlar. Limit artırımı ürün kararıdır ve performance/security review gerektirir.

## PWA sınırı

Shell cache yalnız statik asset içerir. API response, user data ve token cache'e alınmaz. Markdown asset'lerinin shell'e eklenmesi bu politikayı genişletmez.

## Review sınırı

Bu modül üzerinde yapılan gelecekteki değişikliklerde özellikle `createElement`, `textContent`, `safeLinkHref`, `MutationObserver` ve `copyCode` davranışları review edilmelidir. Yeni HTML elementi eklemek veya raw URL şeması açmak yalnız syntax değişikliği sayılmaz; security boundary değişikliğidir.

## Kullanıcı görünürlüğü

Başlık, liste, tablo ve code block sunumu Claude-benzeri sohbet okunabilirliğini artırır. Uzun teknik yanıtların mobil cihazda yatay overflow oluşturmaması ürün kalite kriteridir.

## Geriye dönüş

Feature tamamen geri alınabilir. Conversation verisine migration yazılmadığı için rollback sonrası data repair gerekmez.
