# TypeScript rollback

## Boundary rollback

Typed bir modül sorun çıkarırsa yalnız ilgili server importu legacy .mjs karşılığına döndürülebilir.

Örnek:

~~~text
tool-runtime.ts
      ↓
tool-runtime.mjs
~~~

Diğer migrated boundaries korunur.

## Configuration rollback

package.json start ve dev:server komutları eski production guard'a döndürülebilir. Typed runtime kapsamı ayrı tsconfig.runtime.json üzerinden bağımsız tutulur.

## Data safety

Bu tur yeni storage formatı oluşturmaz. Session, schedule ve prompt verileri mevcut sözleşmeleri kullanır. Rollback veri silme işlemi değildir.

## Testleri silme

Geri alma sırasında testler kaldırılmaz. Failing boundary legacy compatibility mode ile çalıştırılır ve testler migration davranışını belgelemeye devam eder.

## Release sequence

1. PR diff sınırını kontrol et.
2. TypeScript testlerini çalıştır.
3. Staging smoke test yap.
4. Hata varsa ilgili boundary'yi geri al.
5. Root cause düzeldikten sonra typed importu tekrar etkinleştir.
