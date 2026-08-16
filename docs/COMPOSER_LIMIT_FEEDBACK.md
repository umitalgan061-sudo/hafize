# Composer karakter sınırı geri bildirimi

## Amaç

Mesaj yazarı mevcut 12.000 karakter sınırına yaklaşırken kullanıcıya görünür ve erişilebilir geri bildirim verir. Bu katman yalnız browser UI davranışıdır; mesaj gönderme, model seçimi veya tool permission akışını değiştirmez.

## Davranış

- Sayaç `#messageInput` değerinin yalnız uzunluğunu okur.
- Normal durumda kalan kullanılabilir karakter sayısı gösterilir.
- %85 eşiğinde uyarı, %97 eşiğinde daha belirgin tehlike durumu kullanılır.
- Sayaç `progress` elementi ve `aria-live=polite` durum metniyle erişilebilir tutulur.
- Mevcut textarea `maxlength` değeri 12.000'i aşamaz; eksik/geçersiz değer güvenli varsayılan 12.000'e normalize edilir.
- Controller mount/destroy yaşam döngüsü idempotenttir.

## Veri ve güvenlik sınırı

- Metin içeriği ağ, storage, clipboard, cookie veya başka DOM yüzeyine kopyalanmaz.
- Yalnız `string.length` hesaplanır; mesaj metni loglanmaz veya event payload olarak yayınlanmaz.
- Otomatik submit, fetch, tool çağrısı veya dış yazma yoktur.
- Agent registry, backend default-deny tool authorization, approval ve secret sözleşmeleri değişmez.
- `.env`, credential ve `.github/workflows/` değiştirilmez.

## PWA

`/composer-limit-feedback.js` shell asset olarak cache'lenebilir. `/api/*` istekleri network-only kalır; kullanıcı mesajları service worker cache'ine girmez.
