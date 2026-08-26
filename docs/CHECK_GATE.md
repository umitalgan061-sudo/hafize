# Doğrulama Kapısı (`npm run check`)

## Amaç

Hafize deposunun tek doğrulama kapısı `scripts/run-checks.mjs` betiğidir. Kapı
iki aşamadan oluşur:

1. **Sözdizimi taraması** — `server.mjs`, `lib/*.mjs`, `public/*.js` ve
   `scripts/*.mjs` dosyalarının tamamı `node --check` ile paralel taranır.
2. **Test paketi** — `scripts/validate-agent-registry.mjs` doğrulayıcısı ve
   keşfedilen tüm `scripts/test-*.mjs` dosyaları sırayla çalıştırılır.

Herhangi bir aşama başarısız olursa betik sıfırdan farklı çıkış kodu döndürür
ve yalnızca başarısız dosyaların çıktısını yazdırır.

## Neden keşif tabanlı?

Kapı daha önce `package.json` içinde elle bakımı yapılan tek satırlık ~6 KB'lik
bir komut zinciriydi. Yeni bir test dosyası eklendiğinde zincire eklenmesi
kolayca unutuluyordu: kapı devreye alındığında **85 test dosyasının 32'si hiç
çalışmıyordu** — bunların arasında tüm OAuth, token şifreleme ve kişisel bellek
kalıcılık testleri vardı. Ayrıca zincirdeki eskimiş bir beklenti `main`
üzerinde kapıyı kırmıştı.

Dosyalar artık diskten keşfedildiği için kapsam listesi kod ile birlikte
kendiliğinden güncel kalır; yeni bir `scripts/test-*.mjs` dosyası eklemek onu
kapıya dahil etmek için yeterlidir.

## Kullanım

```bash
npm run check                              # tam kapı (~10 sn)
npm run precheck                           # yalnızca tarayıcı/UI testleri
node scripts/run-checks.mjs --filter=gmail # ada göre daraltılmış test seçimi
```

`--filter` virgülle ayrılmış terimler alır ve test dosyası adına göre eşleşir.
Filtre yalnızca test seçimini daraltır; sözdizimi taraması hızlı olduğu için her
zaman tam çalışır. Hiçbir teste uymayan bir filtre sessizce geçmek yerine hata
verir.

## Yeni test eklerken

Dosyayı `scripts/test-<konu>.mjs` olarak adlandırın ve başarısızlıkta sıfırdan
farklı kodla çıkın (`node:assert/strict` bunu kendiliğinden yapar). Başka bir
kayıt adımı gerekmez.

Ortam gerektiren testler kapıyı kırmak yerine zarifçe atlanmalıdır — örnek:
`scripts/test-redis-schedule-lease-live.mjs`, `HAFIZE_TEST_REDIS_URL`
tanımlı değilse bilgi mesajı yazıp sıfır koduyla çıkar.

## Geri alma

`package.json` içindeki `check` / `precheck` betikleri eski komut zincirine
döndürülebilir; `scripts/run-checks.mjs` başka hiçbir modül tarafından import
edilmez, bu yüzden silinmesi çalışma zamanı davranışını etkilemez.
