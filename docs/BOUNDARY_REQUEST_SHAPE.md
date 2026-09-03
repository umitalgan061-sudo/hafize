# Sınır isteği şekli sözleşmesi

Modelden, OAuth callback'inden veya bir tool çağrısından gelen istek nesnesi
güvenilmez girdidir. Her sınır fonksiyonu bozuk bir istek gövdesini kendi
`INVALID_*` sözleşme kodu ile reddeder; ham `TypeError` fırlatmaz.

## Neden

JavaScript'te `function f({ a, b } = {})` varsayılanı yalnız `undefined` için
uygular. `f(null)` çağrıldığında destructuring çöker:

```
TypeError: Cannot destructure property 'ownerId' of '(intermediate value)' as it is null.
```

Bu iki nedenle sorunludur:

1. Çağıran taraf sözleşme kodu bekler; `TypeError` yakalanmayan bir hata olarak
   yukarı sızar ve sınırın sanitize edilmiş hata yüzeyini atlar.
2. Mesaj iç değişken adlarını ve çağrı yapısını açığa çıkarır.

## Kural

İstek alan her dışa açık fonksiyon önce kabı doğrular:

```js
async function read(request) {
  if (request != null && (typeof request !== 'object' || Array.isArray(request))) fail('request');
  const { ownerId, operation, params } = request || {};
  ...
}
```

`null` ve `undefined` boş nesne gibi ele alınır ve alan doğrulaması normal
`INVALID_*:<alan>` hatasını üretir; dizi, metin, sayı ve boolean ise `request`
kodu ile reddedilir.

## Doğrulama

`scripts/test-boundary-request-shape.mjs` isteğe açık tüm yüzeyleri
`null`, `[]`, `'owner'`, `42` ve `true` ile yoklar ve her biri için şunu doğrular:

- bir hata fırlatılır,
- hata `TypeError` değildir,
- mesaj `KOD` veya `KOD:alan` biçimindedir,
- mesaj iç ayrıntı (`Cannot ...`, `undefined`, `intermediate value`) içermez.

Yeni bir connector client'ı, tool boundary'si veya normalize fonksiyonu
eklendiğinde bu testteki `surfaces` listesine kaydedilir.
