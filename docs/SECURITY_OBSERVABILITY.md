# Security observability

Production guard artık authentication, CSRF ve rate-limit kararlarını secret içermeyen olay kayıtlarıyla görünür kılar.

## Olay sözleşmesi

Her olay `timestamp`, `event`, `requestId`, `route`, `method`, `outcome` ve redakte edilmiş `metadata` alanlarından oluşur. `X-Request-Id` istemcinin verdiği kimliği güvenilir kimlik olarak kabul etmez; yalnız iz korelasyonu için taşınır ve yoksa backend yeni bir UUID üretir.

Guard; `request.received`, `auth.allowed`, `auth.denied`, `csrf.denied` ve `rate.denied` olaylarını üretir. Rate-limit olayı yalnız `concurrent` gibi boolean karar bilgisini taşır; token, cookie, Authorization başlığı, IP veya kullanıcı sırrı log'a yazılmaz.

## Gizlilik sınırı

Event metadata anahtarları credential çağrışımlı alanları filtreler. Route değerleri ayrıca query ve fragment bölümünden arındırılır; böylece logger doğrudan çağrılsa bile `?token=...` veya `#...` gibi URL ekleri gözlemlenebilirlik kaydına taşınmaz. Gerekirse principal ilişkilendirmesi için yalnız tek yönlü kısa fingerprint kullanılabilir; ham subject veya credential loglanmaz. Gözlemlenebilirlik katmanı model çağrısı yapmaz ve uygulama yetkisi genişletmez.

## Geri alma

`lib/security-observability.mjs` çıkarılıp `production-guard` importları ve kayıt çağrıları geri alındığında eski davranışa dönülür. Rate limiter ve authentication sözleşmesi bundan bağımsızdır.
