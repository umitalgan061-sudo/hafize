# Yerel Veri Merkezi — Veri Modeli

## Store descriptor

Her yönetilen alanın sabit `id`, storage `key`, kullanıcı etiketi, açıklaması ve clear grubu vardır.

## Snapshot

Snapshot alanları: `present`, `unavailable`, `truncated`, `chars`, `bytes`, `count` ve güvenli preview metadata'sıdır. Preview ham kullanıcı içeriği değildir; yalnız kısa yapı özetidir.

## Count semantics

Array değerleri kayıt sayısı ile; object değerleri anahtar/alan sayısı ile; primitive değerler güvenli genel ifade ile raporlanır. Parse başarısızsa `okunamadı` gösterilir.

## Size semantics

Byte hesabı UTF-8 kodlamaya dayanır. Browser `TextEncoder` yoksa kontrollü fallback kullanılır. Boyut uygulama belleğini sınırsız okumak anlamına gelmez.

## Unknown state

Allowlist dışında kalan `hafize.*` anahtarları `unmanagedHafizeKeys` olarak sınırlı sayıda manifest metadata'sına dahil edilebilir; hiçbir zaman clear hedefi olmaz.

## Versioning

Storage key sürümleri doğrudan feature'a aittir. Data center kendi başına `v2` migration başlatmaz. Migration gerekiyorsa ilgili feature açıkça yapmalıdır.

## Empty state

Kayıt bulunmaması normaldir. UI bunu hata gibi göstermez.

## Failure state

Storage erişimi exception üretirse snapshot `unavailable:true` olabilir. Bu durumda silme veya manifest iddiası başarısızlıkla sonuçlanır; başka UI akışı devam eder.

## Manifest

Manifest şeması version 1'dir ve metadata-only olarak tasarlanmıştır. İçerik backup'ı ile karıştırılmamalıdır.
