# Hafize UI enhancement loader sözleşmesi

`public/enhancements-loader.js`, daha önce bağımsız ve testli olarak geliştirilmiş sohbet UX modüllerini canlı web/PWA shell içine bağlayan dar bir bootstrap katmanıdır.

## Neden var?

Hafize'nin birçok küçük UI geliştirmesi (`message-copy`, `response-fold`, `message-timeline`, klavye gezinimi vb.) service-worker shell listesinde bulunmasına rağmen ana HTML tarafından doğrudan çalıştırılmıyordu. Bu durum özellik kodunun repoda bulunup kullanıcı oturumunda hiç aktive olmamasına yol açıyordu.

Loader bu boşluğu tek bir allowlist üzerinden kapatır. Yeni ürün davranışı icat etmez; mevcut modüllerin normal browser self-mount akışını sırayla başlatır.

## Güvenlik sınırı

- Yüklenebilecek yollar kod içindeki immutable `ENHANCEMENTS` allowlist'iyle sınırlıdır.
- Kullanıcı girdisi, model çıktısı, tool sonucu, query string veya connector verisi script yolu üretemez.
- Allowlist yalnız aynı uygulamanın kök-relative JavaScript yollarını içerir.
- `http://`, `https://`, protocol-relative URL, query string ve hash girdileri kabul edilmez.
- `/api/*`, OAuth callback, credential veya secret endpoint'i loader kapsamına girmez.
- Core runtime scriptleri (`voice-output`, `hands-free`, `screen-share`, `memory-ui`, `cloud-session-ui`) tekrar yüklenmez.
- Loader herhangi bir tool permission, agent permission, external write/send veya repository yetkisi üretmez.

## Yükleme modeli

Modüller sabit sıra ile tek tek yüklenir. Bunun iki nedeni vardır:

1. Bir UI modülünün DOM dekorasyonu tamamlanmadan sonraki modülün aynı DOM'u gözlemlemeye başlamasını sağlamak.
2. İlk yükleme hatasında zinciri durdurarak kısmi durumun nerede oluştuğunu açıkça belirlemek.

Durum makinesi yalnız sayfa belleğindedir:

- `idle`: yükleme başlamadı.
- `loading`: allowlist sırayla yükleniyor.
- `ready`: plan tamamen yüklendi.
- `failed`: ilk başarısız modülde yükleme durdu.

State, analytics veya backend'e gönderilmez; localStorage/cookie/bellek yazımı yoktur.

## İdempotency

Her yüklenen `<script>` elementi kendi `data-hafize-enhancement-loader` işaretini taşır. Aynı path zaten DOM'daysa ikinci kez eklenmez. Loader entry script'i de `ui-shell.js` tarafından `data-hafize-enhancements-entry="1"` işaretiyle yalnız bir kez başlatılır.

Başarısız script elementi DOM'dan kaldırılır. Böylece sonraki açık sayfa yüklemesi veya kontrollü retry, bozuk bir placeholder nedeniyle kalıcı olarak engellenmez.

## PWA

`/enhancements-loader.js` ve yüklediği tüm modüller service-worker shell cache listesinde bulunur. Cache sürümü loader entegrasyonuyla `v49` olur. API istekleri önceki sözleşmede olduğu gibi network-only kalır.

## Değişiklik disiplini

Yeni bir UI enhancement ancak şu koşullarla allowlist'e eklenebilir:

1. Ayrı modül olarak kendi davranış/test sözleşmesine sahip olmalı.
2. Core runtime scriptini duplicate etmemeli.
3. Dış origin veya dinamik URL yüklememeli.
4. Side-effect gerekiyorsa ilgili modülün kendi açık kullanıcı kontrolü ve backend permission sınırları korunmalı.
5. PWA shell asset listesi ve integration testi birlikte güncellenmeli.

Bu loader üçüncü taraf plugin sistemi değildir ve gelecekte modelin keyfi script seçmesine açılmamalıdır.
