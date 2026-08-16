# Canva OAuth Owner & Scope Integrity

## Amaç

Bu sözleşme Hafize'nin Canva OAuth/PKCE akışında iki sınırı kalıcılaştırır: OAuth flow'un authenticated connector owner'a bağlanması ve token scope kümesinin authorization/refresh yaşam döngüsü boyunca sessizce değişememesi.

## Owner binding

`createCanvaOAuthRuntime.start(input, { ownerId })` owner kimliğini genel `oauth-flow-runtime` store'una geçirir. PKCE state tek kullanımlıktır; callback sonucu aynı flow kaydından `ownerId`, verifier, redirect URI ve izin verilen scope kümesini geri alır.

Owner kimliği Canva authorization URL'sine query parametresi olarak eklenmez ve istemciye dönen start payload'ına konmaz. Böylece owner eşlemesi server-side flow state içinde kalır.

Flow store bir expiry bilgisi sağlıyorsa Canva wrapper bu değeri döndürür; bilinmiyorsa `null` kullanılır. Bu değer credential değildir.

## İlk token exchange scope sınırı

Token exchange çağrısı flow'dan gelen `expectedScopes` ile yapılabilir. Bu durumda provider token cevabındaki scope kümesi:

- en fazla 32 scope içerir,
- yalnız sınırlı karakter setindeki scope adlarını kabul eder,
- duplicate scope kabul etmez,
- sıra bağımsız exact set olarak beklenen scope kümesiyle aynı olmalıdır.

Eksik scope, ek scope veya bozuk scope `tokenStore.save()` çalışmadan önce reddedilir. Böylece provider cevabındaki beklenmeyen yetki genişlemesi veya daralması encrypted token kaydının yeni yetki gerçeği haline gelemez.

Eski explicit low-level çağrılar `expectedScopes` vermiyorsa geriye dönük uyumluluk korunur. Production HTTP wiring yapılırken flow callback'teki scope kümesinin token exchange'e `expectedScopes` olarak geçirilmesi zorunlu kabul edilmelidir.

## Refresh scope sınırı

Refresh öncesinde mevcut token kaydının scope listesi de aynı bounded/duplicate-free şemayla doğrulanır. Geçersiz persistent scope kaydı varsa Canva token endpoint'ine ağ çağrısı yapılmaz.

Provider refresh cevabında `scope` alanı yoksa OAuth semantiği gereği önceki doğrulanmış scope kümesi korunur. `scope` alanı varsa sıra bağımsız olarak önceki scope kümesiyle exact aynı olmak zorundadır. Ek, eksik, farklı veya duplicate scope cevabı yeni token kaydı yazılmadan fail-closed reddedilir.

Bu sayede refresh token rotasyonu mevcut izinleri sessizce genişletemez veya Hafize'nin izin modelinden farklı bir scope gerçeği üretemez.

## Secret ve ağ sınırı

- Canva client secret yalnız server-side token endpoint Basic Authorization üretiminde kullanılır.
- Access/refresh token, PKCE verifier ve connector owner kimliği public OAuth start payload'ına girmez.
- Token endpoint redirect takibi `redirect: 'error'` olarak kapalıdır.
- Token endpoint body `application/x-www-form-urlencoded` olarak gönderilir.
- localStorage/sessionStorage/cookie/istemci credential saklama eklenmez.
- `shell=True`, child-process veya genel terminal yürütme yoktur.

## Tool ve ajan sınırı

Bu değişiklik Canva tool yetkisi açmaz. Mevcut Canva agent yüzeyi read-only ve backend default-deny kalır. External write/send/merge approval, secret isolation, ortak trace/task ledger ve dört profilli selector/specialist roster değişmez.

Yeni specialist ajan gerekmez; bu bir connector OAuth güvenlik sözleşmesidir ve mevcut Minimal Engineer kapsamındadır.

## Test sözleşmesi

Regresyon testleri şu kanıtları korur:

- ownerId start → flow store → callback roundtrip,
- owner/verifier/secret değerlerinin authorization URL/public payload'a sızmaması,
- exact ve sıra-değişmiş scope eşleşmesinin kabulü,
- missing/extra/different/duplicate/invalid scope reddi,
- scope doğrulamasının token store write'tan önce gerçekleşmesi,
- refresh cevabında scope yoksa doğrulanmış önceki scope'un korunması,
- geçersiz persistent scope kaydında ağ çağrısı yapılmaması,
- redirect ve forbidden source yüzeylerinin kapalı kalması.

## Geri alma

Revert owner binding ve token/refresh scope doğrulamalarını, ilgili testleri ve bu belgeyi kaldırır. Token store şeması, credential dosyası, `.env` veya server migration değişikliği yoktur.
