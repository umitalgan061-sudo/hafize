# Yerel Veri Merkezi — Kabul Kriterleri

## AC-01 — Envanter

Settings açıldığında registry'deki tüm yönetilen alanlar görünür. Eksik alan kullanıcıya hata olarak değil boş state olarak gösterilir.

## AC-02 — Boyut

Mevcut alanların UTF-8 byte değeri bounded şekilde hesaplanır ve toplam özetle birlikte gösterilir.

## AC-03 — Sayım

Array, object ve primitive store'lar için açıklanabilir bir sayım metni üretilir. JSON parse edilemeyen değer güvenli okunamadı state'ine düşer.

## AC-04 — Tekli temizleme

Bir satırın silinmesi yalnızca o registry key'ini hedefler.

## AC-05 — Toplu temizleme

Toplu temizleme yalnız allowlist key'lerini hedefler ve kullanıcı onayı olmadan çalışmaz.

## AC-06 — Unknown key

Registry dışında kalan `hafize.*` key'leri clear işleminden korunur.

## AC-07 — Manifest

Manifest metadata-only kalır ve kullanıcı içeriğini içermez.

## AC-08 — Cross-tab

Bilinen key değiştiğinde görünüm yenilenir.

## AC-09 — Lifecycle

Destroy sonrasında storage event'i UI mutasyonu yapmaz.

## AC-10 — Compatibility

Data center yokken veya mount başarısızken sohbet, composer, taslak ve diğer settings kontrolleri çalışmaya devam eder.

## AC-11 — Accessibility

Başlık ilişkisi, list semantics, labels, live status ve focus-visible korunur.

## AC-12 — PWA

Static asset'ler shell cache listesinde bulunur; API caching davranışı değişmez.
