# Collections QA plan

## Functional

1. Koleksiyon oluşturma başarılı olmalı.
2. Boş isim reddedilmeli.
3. Duplicate isim case-insensitive reddedilmeli.
4. Açıklama normalize edilmeli.
5. Prompt selection yalnız mevcut id'leri içermeli.
6. Aynı prompt birden fazla koleksiyonda bulunabilmeli.
7. Duplicate membership tekilleştirilmeli.
8. 120 üyeden sonrası kesilmeli.
9. Koleksiyon silmek prompt'u silmemeli.
10. Prompt silindikten sonra orphan üyelik temizlenmeli.

## Search

Arama ad ve açıklamada çalışmalı. Türkçe locale büyük/küçük harf varyantlarında eşleşme korunmalı. Query length bounded olmalı.

## Import/export

Geçerli export tekrar import edildiğinde yeni id üretilmeli. Duplicate isimler atlanmalı. Geçersiz JSON kullanıcıya sınırlı hata göstermeli. 500 KB üzeri dosya reddedilmeli.

## Security

HTML payload, script tag, event attribute veya URL değeri koleksiyon alanlarından çalıştırılmamalı. Module source `innerHTML`, `outerHTML`, `document.write`, fetch, XHR, WebSocket ve sendBeacon kullanmamalı.

## Lifecycle

Panel ikinci kez mount edildiğinde duplicate panel oluşmamalı. Destroy observer ve event listener temizlemeli. Hidden state aria-expanded ile eşleşmeli.

## PWA

CSS/JS entry'leri shell cache listesinde bulunmalı. API yolları network-only kalmalı. Cache version increment edilmelidir.

## Regression

Mevcut Prompt Library, Smart Fill, Command Palette, Usage Insights ve Scheduled Tasks entry'leri değişmeden kalmalıdır.

## Release evidence

PR açıklamasında base/head SHA, changed-line toplamı, test komutları ve çalıştırılamayan komutlar açıkça yazılmalıdır.
