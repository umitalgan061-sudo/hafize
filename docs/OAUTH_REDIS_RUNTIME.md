# OAuth Redis runtime sınırı

Bu katman, OAuth `state + PKCE verifier` geçici kayıtlarının çok instance'lı Hafize dağıtımında ortak Redis store üzerinden kullanılabilmesi için production bootstrap sözleşmesini tanımlar.

## Yapılandırma

- Runtime yalnız `HAFIZE_OAUTH_REDIS_URL` tanımlıysa etkinleşir.
- Schedule lease Redis ayarıyla otomatik fallback yapılmaz; OAuth koordinasyonu ayrı secret/ACL ve yaşam döngüsü sınırında tutulabilir.
- Yalnız `redis:` ve `rediss:` URL'leri kabul edilir.
- URL hash, CR/LF/NUL veya aşırı uzun değer içeremez.
- Redis URL runtime çıktısında enumerable değildir ve hata mesajlarına taşınmaz.
- Secret veya credential değeri ajan/model bağlamına verilmez.

## Startup

`createRedisOAuthFlowStoreRuntime()` Redis modülünü yalnız özellik etkinse yükler. Client oluşturma, bağlantı ve store bileşimi tamamlanmadan `configured: true` dönmez.

Redis connect işlemi varsayılan 5 saniyelik deadline ile bounded'dır. Module yükleme, client şekli, bağlantı, timer veya store oluşturma belirsizliğinde runtime `OAUTH_REDIS_RUNTIME_STARTUP_FAILED` ile fail-closed durur ve oluşturulmuş client `destroy()` ile emekliye ayrılır. Provider/socket ayrıntısı dış hata sözleşmesine taşınmaz.

## Store davranışı

Başarılı runtime, `createRedisOAuthFlowStore()` tarafından sağlanan ortak store'u döndürür. Store şu garantileri korur:

- raw OAuth state Redis key veya payload'a yazılmaz;
- issue shared capacity ve collision kontrolünü atomik yapar;
- consume tek kullanımlıdır ve instance'lar arasında atomiktir;
- TTL Redis saatine bağlıdır;
- Redis command deadline sonrası client sticky-unavailable olur;
- bozuk payload tüketildikten sonra fail-closed reddedilir.

## Shutdown

Runtime `close()` çağrısını idempotent biçimde store'un bounded close sözleşmesine delege eder. Close başarısızlığında provider ayrıntısı dışarı verilmez; yalnız `OAUTH_REDIS_RUNTIME_CLOSE_FAILED` döner.

## Bilinçli kapsam dışı

Bu katman OAuth HTTP endpoint'i, token exchange route'u veya kullanıcı kimlik doğrulaması açmaz. Bunlar ayrı bir HTTP/auth sınırı ve ayrı testlerle bağlanmalıdır. `server.mjs` bu PR kapsamında OAuth route yayınlamaz.

Bu katman ayrıca tokenların kalıcı saklandığı yer değildir. Authorization code exchange sonrasında access/refresh tokenlar mevcut server-side token store güvenlik sözleşmesine göre saklanmalıdır.
