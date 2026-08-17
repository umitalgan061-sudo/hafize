# Cloud session login limiter contract

## Amaç

Hafize cloud-session login endpoint'i parola denemelerini bounded ve peer-scoped biçimde sınırlar. Bu sözleşme başarılı kullanıcı girişlerini yanlışlıkla rate-limit bütçesine yazmadan brute-force ve eşzamanlı deneme baskısını fail-closed tutar.

## Temel davranış

- Limit yalnız `POST /api/session/login` yoluna uygulanır.
- Same-origin kontrolü limiter'dan önce yapılır; yanlış Origin değerleri parola doğrulamasına veya limiter ticket'ına ulaşmaz.
- Limiter anahtarı yalnız server-side socket `remoteAddress` değerinden türetilir. Forwarded/X-Forwarded-For gibi istemci tarafından etkilenebilir header'lar güven kaynağı değildir.
- Geçersiz veya bulunamayan socket adresleri tek bounded `unknown-peer` bucket'ında toplanır.
- Varsayılan bütçe 60 saniyede 5 denemedir. Runtime constructor sınırları bu değerleri dar test konfigürasyonlarıyla değiştirebilir; production environment üzerinden key-space veya auth semantics genişletilmez.
- Bucket haritası bounded kalır; varsayılan en fazla 4096 peer anahtarıdır. Kapasite dolu ve prune edilebilir expired bucket yoksa yeni peer fail-closed 429 alır.

## Reservation modeli

Her izin verilen login denemesi parola doğrulamasından önce bir reservation alır. Böylece aynı peer'den aynı anda açılan çok sayıda login isteği `auth.login()` tamamlanmadan önce de bütçeyi aşamaz.

Ticket tamamlanması exactly-once'dur:

- `authenticated: false`: reservation kaldırılır ve bir failure kalıcı olarak mevcut pencere bütçesine eklenir.
- `authenticated: true`: peer bucket'ı tamamen temizlenir. Başarılı giriş eski failure'ları ve o ana ait limiter state'ini sıfırlar.
- Aynı ticket ikinci kez tamamlanırsa state değişmez.

Başarı sonrasında bucket temizliği kasıtlıdır: geçerli kullanıcı tekrar login olduğunda önceki başarılı login'ler yüzünden rate-limit edilmemelidir. Buna karşılık failure bütçesi tamamen tükenmişse sonraki istekte parola doğru olsa bile pencere dolana kadar `auth.login()` çağrılmaz; limiter bypass edilmez.

## Hatalı istekler

Login route'una doğru origin ile ulaşmış fakat body contract'ını ihlal eden trafik abuse bütçesine dahildir. Örnekler:

- bozuk JSON,
- exact `{ password }` şemasına uymayan body,
- unsupported login media type,
- body-size veya body-timeout ihlali.

Bu istekler parola doğrulamasına ulaşmasa da server kaynaklarını ve login endpoint'ini tükettiği için failure olarak ticket'ı tamamlar. Cross-origin istek ise ticket almadan 403 ile reddedilir.

## Güvenlik sınırları

Bu değişiklik aşağıdaki sınırları değiştirmez:

- Parola hash'i, signing key ve session subject yalnız server environment'tadır.
- Login cevabı secret veya password hash içermez.
- Session cookie'nin HttpOnly/Secure/SameSite sözleşmesi auth katmanında korunur.
- `Origin` exact HTTPS origin olarak doğrulanır.
- Login body `application/json` ve bounded byte/time limitleri altında okunur.
- Agent context'ine session secret, cookie veya credential eklenmez.
- Model provider seçimi authentication veya tool permission vermez.
- GitHub/Gmail/Canva dış write/send/merge işlemleri ayrı explicit approval sınırlarını korur.
- `.env`, credential dosyaları ve `.github/workflows/` self-development kapsamı dışındadır.
- `shell=True`, child-process terminal yürütme veya deny-list tabanlı komut güvenliği eklenmez.

## DoD / regresyon kapsamı

Regresyonlar en az şu davranışları kilitler:

1. Çok sayıda ardışık başarılı login failure bütçesi tüketmez.
2. Failure sonrası başarılı login aynı peer bucket'ını sıfırlar.
3. Bütçe tüketilmişse doğru parola bile auth katmanına ulaşmadan 429 alır.
4. Failure penceresi süresi dolunca peer yeniden deneyebilir.
5. Farklı socket peer'leri bağımsız bucket kullanır.
6. Pending concurrent login'ler reservation olarak sayılır ve concurrency bypass'ı yapamaz.
7. Ticket completion exactly-once'dur.
8. Malformed/unsupported same-origin login istekleri abuse bütçesine yazılır.
9. Wrong-origin login ticket almadan 403 olur.
10. Key map capacity bounded kalır; expired bucket prune edilir.
11. Invalid/missing peer adresleri bounded `unknown-peer` bucket'ına düşer.

## Geri alma

Geri almak için login-gate ticket completion davranışı eski pre-auth counter modeline döndürülebilir ve ilgili test/sözleşme kaldırılabilir. Persistent veri veya schema migration yoktur; session cookie formatı değişmez.
