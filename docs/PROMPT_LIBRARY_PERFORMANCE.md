# Prompt Library Performans

## Hedef

Prompt Library sohbet akışını bloke etmemelidir.

Liste maksimum 120 kayıtla sınırlıdır.

Bir kayıt 8.000 karaktere kadar olabilir.

## Arama

Arama her input event'inde normalize edilmiş küçük collection üzerinde çalışır.

120 kayıt sınırı nedeniyle ilk sürümde ayrı indeks sistemi gerekli değildir.

Kullanıcı çok hızlı yazarken tarayıcı ana thread'inde küçük bir iş yükü oluşur.

## Render

UI yalnız görünür filtre sonucunu DOM'a çizer.

Liste scroll kabı içinde tutulur.

Kartın geri kalan sayfa scroll'unu devralması beklenmez.

## Import

1 MB dosya sınırı parse maliyetini sınırlar.

JSON tamamı parse edilmeden collection merge edilmez.

Import sonrası normalize yalnız 120 kayıt taşır.

## Export

Export JSON yerel olarak oluşturulur.

Blob URL işlem sonrası revoke edilir.

## Observer

Enhancement layer yalnız prompt card subtree'sini gözler.

Butonlar zaten mevcutsa ikinci kez eklenmez.

Observer sayfa kapatılırken disconnect edilir.

## Büyük içerik

Büyük prompt'lar textarea içinde gösterildiğinde scroll ve resize tarayıcıya bırakılır.

Preview metni 120 karaktere düşürülür.

## Gelecek ölçekleme

Kayıt sayısı 120'den anlamlı derecede büyütülürse:

- debounced search,
- normalized search index,
- virtualized list,
- IndexedDB

değerlendirilebilir.

Bu sürümde gereksiz bağımlılık eklenmez.
