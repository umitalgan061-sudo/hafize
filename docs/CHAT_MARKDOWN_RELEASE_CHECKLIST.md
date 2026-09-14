# Chat Markdown Release Checklist

## Kaynak

- `public/chat-markdown.js` syntax ve source-contract testleri geçer.
- `public/chat-markdown.css` tema tokenlarıyla çalışır.
- `public/index.html` iki asset'i yükler.
- `public/sw-policy.js` iki asset'i shell cache'e alır.

## Davranış

- Heading, paragraph, list, quote, rule, code ve table çalışır.
- Inline code, strong, emphasis, strike ve link çalışır.
- Ordered list başlangıç numarası korunur.
- Task marker'lar yalnız görsel gösterge olarak kalır.
- Kapanmamış fence streaming ara durumunda çalışır.

## Güvenlik

- Raw HTML DOM'a çevrilmez.
- `javascript:`, `data:`, `vbscript:` ve non-allowlisted protocol linkleri tıklanamaz.
- Dış linklerde noopener/noreferrer/nofollow vardır.
- Dil sınıfı normalize edilmiştir.
- Input ve parser limitleri korunur.
- Yeni network veya storage erişimi yoktur.

## Erişilebilirlik

- Copy button aria-label taşır.
- Link ve button focus-visible durumları vardır.
- Küçük ekranlarda code/table overflow kendi kapsayıcısındadır.
- Reduced motion animasyonu kaldırır.
- Forced colors sınırları görünür tutar.

## Regression

- Eski düz text sohbet kayıtları parser olmadan da okunabilir.
- Kullanıcı mesajları biçimlendirilmez.
- Streaming/edit/retry state sahipliği `app.js`'de kalır.
- Conversation ve message workspace storage anahtarları değişmez.

## PWA

Cache revision güncellenir. API yollarına shell cache istisnası eklenmez. Eski shell cache'leri silinmeye devam eder.
