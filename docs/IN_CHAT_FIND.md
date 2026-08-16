# In-chat find sözleşmesi

`in-chat-find.js`, yalnız aktif konuşmanın zaten render edilmiş mesajlarında kullanıcı tarafından başlatılan yerel arama sağlar.

## Davranış

- `Ctrl+F` / `Cmd+F` Hafize içi aramayı açar.
- Arama en fazla 120 karakterdir ve Türkçe case normalization uygular.
- Eşleşmeler mesaj kartı düzeyinde işaretlenir; Enter sonraki, Shift+Enter önceki eşleşmeye gider.
- Escape paneli kapatır ve önceki odağı geri verir.
- Streaming sırasında görünür mesaj metni değişirse açık arama yeniden uygulanır.

## Veri ve güvenlik sınırı

- Yalnız `#messages .message .content` düz metni okunur.
- Sorgu veya sonuçlar storage/cookie/network/clipboard'a yazılmaz.
- Tool activity, trace, message id veya agent metadata aranmaz.
- Controller submit, click sentezi, tool çağrısı veya dış yazma yapmaz.
- Eksik DOM durumunda mount fail-closed olur.

## PWA

Controller same-origin shell asset olarak cache'lenir; `/api/*` network-only kalır.
