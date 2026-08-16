# Taslak temizleme ve geri alma

## Amaç

Mesaj yazarındaki taslağı açık kullanıcı tıklamasıyla temizler ve yanlışlıkla temizleme durumunda kısa süreli geri alma sağlar.

## Davranış

- `Taslağı temizle` yalnız boş olmayan, 12.000 karakter sınırı içindeki taslakta etkinleşir.
- Temizleme otomatik submit yapmaz; textarea boşaltılır ve normal `input` olayı yayınlanır.
- Son temizlenen taslak yalnız JavaScript belleğinde en fazla 10 saniye tutulur.
- `Geri al` yalnız composer hâlâ boşsa metni geri yükler; kullanıcı yeni bir taslak yazdıysa üzerine yazmaz.
- Süre dolunca veya controller destroy edilince in-memory snapshot kesin biçimde bırakılır.
- Geri yüklenen metin mevcut composer sınırları ve normal submit yolu üzerinden ilerler.

## Veri ve güvenlik sınırı

- Taslak localStorage/sessionStorage/cookie/clipboard/network katmanına yazılmaz.
- Metin loglanmaz veya custom event payload olarak dışarı çıkarılmaz.
- Otomatik gönderme, tool çağrısı, external write veya permission değişikliği yoktur.
- Agent roster, backend default-deny policy, approval, trace ve secret sözleşmeleri değişmez.

## PWA

`/draft-clear-undo.js` same-origin shell asset olabilir. Kullanıcı taslağı veya undo snapshot'ı service worker cache'ine girmez; `/api/*` network-only kalır.
