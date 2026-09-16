# Platform Runtime Operations

## Günlük kontrol

1. `main` son commit'i doğrula.
2. Production build sonucunu kontrol et.
3. Platform dashboard'da network ve feature durumlarına bak.
4. Diagnostic export yalnızca kullanıcı talebiyle alınmalı.

## Degraded durumu

`Sınırlı` göstergesi tek başına application failure anlamına gelmez. Önce ağ durumunu, sonra failed feature'ı, sonra storage kapasitesini kontrol et.

## Storage problemi

Usage yüksekse kullanıcı verisinin niteliği incelenir. Runtime metadata silinebilir; conversation ve prompt storage ayrı operasyonlardır.

## Performance problemi

LCP, longtask ve event bütçeleri kontrol edilir. Önce yeni observer veya dashboard render loop'u olup olmadığı incelenir. Sonra büyük synchronous task'lar aranır.

## Queue problemi

Queue doluysa yeni düşük öncelikli görevler reddedilir. Tamamlanan task'lar `prune()` ile temizlenir. Timeout alan task tekrar çalıştırılmadan önce neden incelenmelidir.

## Error boundary

Diagnostic hata sayısı artıyorsa raw stack paylaşılmadan redacted diagnostic JSON alınır. Secret içeren log satırları ayrıca korunur.

## Offline

Offline durumda shell ve yerel UI çalışmaya devam etmelidir. API çağrıları yapılmamalı veya mevcut API client tarafından kontrollü biçimde reddedilmelidir.

## Rollback

Platform entry geri alınabilir. Rollback sırasında mevcut kullanıcı storage alanlarını silme. Service worker cache version'ı eski uygulama ile uyumlu hale getirilmeli.

## Browser compatibility

Bir capability eksikse policy fallback gösterilmeli. Runtime boot exception'ı yerine tek feature'ın disabled/degraded olması tercih edilir.

## İzleme sınırları

Bu runtime üçüncü parti analytics değildir. Event bus, metrics ve diagnostics yalnızca uygulamanın yerel çalışma durumunu gözlemlemek için kullanılır.
