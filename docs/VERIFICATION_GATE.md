# Doğrulama kapısı (`scripts/run-checks.mjs`)

## Sorun

Kapı, `package.json` içinde elle bakımı yapılan tek satırlık uzun bir komut
dizisiydi. Yeni bir `lib/` modülü veya `scripts/test-*.mjs` dosyası eklendiğinde
bu dizinin de güncellenmesi gerekiyordu ve bu adım zamanla atlandı.

Ölçülen sonuç (2026-08-26):

- 84 test dosyasının **32'si** hiç çalışmıyordu (%38). Aralarında `oauth-pkce`,
  `oauth-token-encryption`, `oauth-token-file-store`, `google-token-exchange`,
  `canva-token-refresh` ve `personal-memory-encryption` gibi güvenlik sınırı
  testleri vardı.
- 68 `lib/` modülünün **27'si** `node --check` ile syntax kontrolünden bile
  geçmiyordu.
- Dizinin ortasındaki tek bir başarısız assertion (`test-tool-runtime.mjs`)
  `&&` zincirini kırdığı için ondan sonraki **hiçbir** test çalışmıyordu.

Yani kapı yeşil görünmüyordu ama kırmızı olduğu da fark edilmiyordu; kırıldığı
noktadan sonrası sessizce atlanıyordu.

## Çözüm

Komut dizisi, dosyaları diskten keşfeden bir runner ile değiştirildi. Kapsam
artık elle tutulan bir listeye değil, dosya sisteminin kendisine dayanır:

- **syntax**: `server.mjs`, tüm `lib/*.mjs`, `public/*.js`, `scripts/*.mjs`.
- **doğrulama**: `scripts/validate-agent-registry.mjs` ve tüm
  `scripts/test-*.mjs`.

Kapsam 75 → 160 dosya syntax kontrolü ve 54 → 87 doğrulama çalıştırmasına
çıktı.

## Davranış

- Testler **sıralı** çalışır: geçici dosya ve ortam değişkeni kullanan testler
  birbirini etkilemesin diye. Yan etkisiz olan `node --check` adımı sınırlı
  paralellikle çalışır (syntax fazı 7,0 sn → 2,0 sn).
- Bir test başarısız olsa bile kalan testler çalışır; eski `&&` zincirinde
  olduğu gibi kapının geri kalanı atlanmaz. Tüm başarısızlıklar sonda toplu
  raporlanır ve çıkış kodu 1 olur.
- Syntax fazı başarısızsa testler çalıştırılmaz; parse edilemeyen bir modül
  varken test sonuçları anlamlı değildir.
- Her test için 120 sn zaman aşımı vardır; asılı kalan bir test kapıyı
  süresiz bloklayamaz.
- Hiçbir testle eşleşmeyen bir `--filter` çıkış kodu 1 üretir. Yanlış yazılmış
  bir filtrenin "her şey yeşil" gibi görünmesi engellenir.

## Kullanım

```
npm run check        # tüm kapı
npm run precheck     # yalnız frontend/PWA altkümesi
npm test             # check ile aynı
node scripts/run-checks.mjs --filter=gmail,canva
node scripts/run-checks.mjs --list
```

## Regresyon koruması

`scripts/test-run-checks.mjs`, keşfin eksiksiz olduğunu doğrular: diskteki her
`scripts/test-*.mjs` dosyası ve her çalıştırılabilir modül `--list` çıktısında
görünmek zorundadır. Bu test kapının kendi içinde çalıştığı için, kapsamı
daraltan bir değişiklik kapıyı kırar.

`run-checks.mjs` adı `test-` ile başlamadığından test olarak keşfedilmez; bu da
kapının kendini özyinelemeli çağırmasını önler ve ayrıca test edilir.

## Geri alma

`package.json` içindeki `check`/`precheck` betikleri eski komut dizisine geri
alınabilir; `scripts/run-checks.mjs` ve `scripts/test-run-checks.mjs`
silindiğinde başka hiçbir modül etkilenmez. Runner uygulama kodunu import
etmez, yalnız alt süreç çalıştırır.
