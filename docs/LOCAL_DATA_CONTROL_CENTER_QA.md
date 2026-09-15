# Yerel Veri Merkezi — QA Planı

## Fonksiyonel

Testler yönetilen alanların doğru sayılması, byte ölçümü, boş durum, tekli silme, toplu silme ve metadata manifest davranışını kapsar.

## Veri bütünlüğü

Malformed JSON olan bir alanın diğer alanları etkilememesi gerekir. Bilinmeyen storage key'leri temizleme işleminden korunmalıdır.

## Destructive UX

Tekli silmede reddedilmiş confirmation hiçbir `removeItem` çağrısı üretmemelidir. Toplu temizleme confirmation olmadan çalışmamalıdır.

## Accessibility

Başlık ilişkisi, status live region, role=list ve role=listitem, aria-label'lar, focus-visible görünürlüğü ve reduced-motion/forced-colors kuralları kontrol edilir.

## PWA

CSS ve JS shell listesinde olmalı, cache version artırılmalı ve `/api/*` network-only kalmalıdır.

## Cross-tab

Known key değişikliğinde özet yenilenmeli, key `null` geldiğinde tam snapshot alınmalı, bilinmeyen key değişikliği clear yüzeyini etkilememelidir.

## Failure injection

`getItem`, `removeItem`, `storage.length`, `storage.key`, Blob URL ve confirm erişimleri exception/failure üretebildiğinde UI güvenli şekilde devam etmelidir.

## Regression

Aynı ayar alanı açılıp kapanırken data center duplicate mount üretmemelidir. Destroy sonrası listener çalışmamalıdır.

## Release

Tam suite çalışmadığında bu durum PR açıklamasında açıkça belirtilir. Hosted test runner başlamıyorsa yeşil sonuç iddia edilmez.
