# Doğrulama kapısı (`npm run check`)

## Amaç

Hafize'nin tüm statik/syntax/smoke doğrulamasını tek ve **kendi kendine keşfeden** bir kapıda toplamak.

Önceki kurulum `package.json` içinde elle bakımı yapılan tek satırlık uzun bir komut zinciriydi. Yeni bir modül veya test dosyası eklendiğinde bu zincire elle eklenmesi gerekiyordu ve bu adım pratikte sık atlanıyordu: 85 test dosyasından **33'ü** hiçbir zaman çalıştırılmıyordu. Atlanan grup arasında OAuth PKCE, token store şifrelemesi, Canva read client, personal memory runtime, device bridge, hands-free ve screen-share testleri gibi güvenlik açısından kritik alanlar vardı.

## Nasıl çalışır

`scripts/run-checks.mjs`:

1. **Syntax**: `server.mjs`, `lib/*.mjs`, `public/*.js` ve `scripts/*.mjs` dosyalarının tümünü diskten bulur ve her biri için `node --check` çalıştırır. Bu adım paralel yürütülür.
2. **Doğrulayıcılar**: `scripts/validate-*.mjs` dosyalarını çalıştırır.
3. **Testler**: `scripts/test-*.mjs` dosyalarını alfabetik sırada, ayrı süreçlerde ve sırayla çalıştırır. Sıralı yürütme, geçici dosya ve port kullanan testlerin birbirini etkilemesini önler ve çıktı sırasını belirlenebilir tutar.

Her başarısız adımın tam çıktısı özet satırından sonra yeniden yazdırılır; kapı en az bir hata varsa `1` ile çıkar.

Dosya keşfi diskten yapıldığı için **yeni bir `lib/` modülü veya `scripts/test-*` dosyası eklendiğinde kapıya elle kayıt gerekmez**; dosya eklendiği anda kapsama girer.

## Kullanım

```bash
npm run check                  # tüm kapı
node scripts/run-checks.mjs gmail    # yalnız adı 'gmail' içeren dosyalar
node scripts/run-checks.mjs oauth token   # birden çok filtre (VEYA mantığı)
```

Filtre argümanları hem syntax hem test seçimine uygulanır; geliştirme sırasında dar bir alanı hızlı doğrulamak içindir. PR öncesi doğrulama her zaman filtresiz `npm run check` ile yapılır.

## Test dışlama kuralı

Bir testin kapıdan çıkarılması istisnadır. Dışlama yalnızca `scripts/run-checks.mjs` içindeki `SKIPPED_TESTS` haritasına **açık gerekçesiyle** yazılarak yapılır ve çıktıda `skip` satırı olarak görünür. Şu an bu liste boştur: tüm testler ağ, canlı Redis veya elle kurulum gerektirmeden çalışır.

Sessizce kapı dışında kalan test kabul edilmez; kapıya girmeyen test, olmayan testtir.

## Kapının kendi testi

`scripts/test-check-gate.mjs` kapının kapsamını doğrular ve kapının kendisi tarafından çalıştırılır:

- diskteki her `lib/*.mjs`, `public/*.js`, `scripts/*.mjs` ve `server.mjs` syntax kapsamındadır;
- her `scripts/test-*.mjs` ve `scripts/validate-*.mjs` çalıştırılabilir kontrol listesindedir;
- doğrulayıcılar testlerden önce çalışır (bozuk registry ile geçen ajan testi yanıltıcıdır);
- `SKIPPED_TESTS` içindeki her kayıt gerçek bir test dosyasına işaret eder ve anlamlı bir gerekçe taşır;
- `package.json` yalnız tek bir `check` betiği tanımlar, tekrarlı `precheck` zinciri yoktur.

Böylece kapsam kaybı, ilk fark edildiğinde değil, oluştuğu commit'te yakalanır.

## Geri alma

Kapı tek dosyadır. `scripts/run-checks.mjs` silinip `package.json` içindeki `check` betiği önceki komut zincirine döndürülerek geri alınabilir; kaynak dosyalarda başka bağımlılık bırakmaz.
