# Canva OAuth upstream lifecycle sınırı

Bu belge Hafize'nin Canva OAuth token exchange, refresh ve revoke çağrılarının ortak ağ güvenliği sözleşmesini tanımlar.

## Amaç

Canva OAuth çağrıları server-side çalışır. Client secret, access token ve refresh token browser veya ajan bağlamına taşınmaz. Bu katman OAuth scope politikasını genişletmez; yalnız mevcut PKCE/token lifecycle'ının upstream ağ davranışını bounded ve iptal edilebilir hale getirir.

## Ortak kurallar

- Yalnız `https://api.canva.com/` altındaki HTTPS endpoint'leri kabul edilir.
- İstekler `redirect: error` ile yapılır; redirect zinciri izlenmez.
- OAuth client credential yalnız `Authorization: Basic …` server-side header'ında kullanılır.
- Varsayılan upstream deadline 15 saniyedir; runtime override en fazla 60 saniye olabilir.
- Parent `AbortSignal` pre-abort ise network egress başlamaz.
- Çalışan exchange/refresh/revoke parent cancellation ile gerçek upstream `AbortSignal` üzerinden durdurulur.
- Timeout ve kullanıcı/runtime cancellation birbirinden ayrı hata sınıflarıdır.
- HTTP failure response body best-effort kapatılır.
- JSON beklemeyen başarılı revoke response body de açık bırakılmaz.

## JSON token response sınırı

Exchange ve refresh token yanıtları varsayılan en fazla 64 KiB kabul edilir. Runtime maksimum 256 KiB'ye kadar açıkça yapılandırılabilir.

Response `Content-Length` veriyorsa limit body okunmadan uygulanır. Stream reader varsa byte sayımı incremental yapılır. Limit aşılırsa reader cancel edilir ve lock bırakılır. Stream olmayan test/adapter response'larında parse edilen JSON tekrar encode edilerek aynı boyut sınırı uygulanır.

Canva `Content-Type` header'ı sağlıyorsa token response `application/json` olmalıdır. Malformed content type, malformed JSON veya geçersiz response şekli token persistence'a ulaşmadan reddedilir.

## Persistence ve yan etki sırası

### Authorization-code exchange

1. owner, code, PKCE verifier, redirect URI ve expected scope doğrulanır.
2. Bounded upstream token çağrısı yapılır.
3. Response token şekli ve exact scope eşitliği doğrulanır.
4. Ancak bundan sonra encrypted/server-side token store'a kayıt yapılır.

Scope mismatch veya cancellation durumunda credential kaydı yapılmaz.

### Refresh

1. Owner-scoped mevcut refresh token server-side store'dan okunur.
2. Bounded refresh çağrısı yapılır.
3. Dönen scope seti önceki scope setiyle exact eşleşmelidir.
4. Ancak doğrulama sonrası rotated token kaydedilir.

Scope escalation veya cancellation persistence'a ulaşamaz.

### Revoke

Revoke dış yan etkidir ve `explicitUserIntent: true` gereksinimi değişmez. Bu intent yoksa Canva'ya network isteği gönderilmez.

Yerel token yalnız Canva revoke isteği başarılı olduktan sonra silinir. HTTP failure veya cancellation durumunda yerel kayıt korunur; böylece Hafize sonucu kesinleşmemiş bir dış yan etkiden sonra credential durumunu sessizce kaybetmez.

## Değişmeyen güvenlik sınırları

- Canva write capability'leri mevcut OAuth policy'deki explicit user intent gereksinimini korur.
- Bu katman ajanlara yeni tool izni vermez.
- Backend default-deny tool permission enforcement provider'dan bağımsız kalır.
- Secret değerleri agent prompt/context/trace içine girmez.
- Dış yazma, paylaşma veya gönderme işlemleri için uygulama-level explicit approval gereksinimi kaldırılmaz.
- `.env`, credential dosyaları ve `.github/workflows/` bu sözleşmenin parçası değildir ve self-development tarafından değiştirilmez.
