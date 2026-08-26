# Doğrulama kapısı (check gate)

## Sorun

`npm run check` uzun süre elle bakımı yapılan tek satırlık bir komut zinciriydi.
İki yapısal sorun üretti:

1. **Sessiz kapsam kaybı.** Depoda 85 test dosyası vardı ama zincir yalnız 53
   tanesini çağırıyordu. Canva OAuth, Google token exchange, PKCE, encrypted
   token store, personal memory runtime, screen-share ve hands-free testleri
   hiçbir zaman kapıda çalışmıyordu.
2. **Kırık kapı fark edilmiyordu.** Zincir `&&` ile bağlı olduğu için ilk
   başarısızlık kalan tüm kontrolleri atlıyordu. Kapı `scripts/test-tool-runtime.mjs`
   adımında kırıldığında arkasındaki onlarca kontrol de çalışmaz hâle geldi.

## Çözüm

`scripts/run-checks.mjs` kapıyı elle yazılmış listeden değil repo içeriğinden
keşfeder:

- **Syntax kapsamı:** `server.mjs`, `lib/*.mjs`, `public/*.js`, `scripts/*.mjs`
  için `node --check`.
- **Test kapsamı:** `scripts/test-*.mjs` dosyalarının tamamı, artı
  `scripts/validate-agent-registry.mjs`.
- Kontroller en fazla 4 eşzamanlı alt süreçle çalışır; her hedef izole bir
  `node` sürecidir.
- Bir kontrol başarısız olsa bile kalan kontroller çalışmaya devam eder; tüm
  başarısızlıklar sonunda tek raporda listelenir ve çıkış kodu `1` olur.
- Her hedefin kendi zaman aşımı vardır (varsayılan 120 s,
  `HAFIZE_CHECK_TIMEOUT_MS` ile 1000–600000 ms aralığında ayarlanır). Asılı
  kalan bir kontrol `SIGKILL` ile sonlandırılır ve `TIMEOUT` olarak raporlanır;
  kapı süresiz bloklanmaz. Aralık dışı bir değer sessizce yok sayılmaz, kapı
  hata verir.

### Komutlar

| Komut | Kapsam |
| --- | --- |
| `npm run check` | Tam kapı (önce npm `precheck` hook'u çalışır). |
| `npm run precheck` | Yalnız UI/ses alt kümesi (`voice`, `ui-shell`, `sidebar`, `hands-free`). |
| `npm run check:list` | Keşfedilen hedefleri çalıştırmadan listeler. |

Filtre yalnız daraltır: `node scripts/run-checks.mjs --filter=gmail,canva`.
Hiçbir hedefle eşleşmeyen filtre sessizce geçmez, hata verir.

## Regresyon koruması

`scripts/test-check-coverage.mjs` kapının kendisini doğrular:

- keşfedilen test listesi `scripts/` içindeki gerçek test dosyalarıyla birebir
  aynıdır;
- her test dosyası ve her `lib/` modülü syntax kapsamındadır;
- filtre hedef uydurmaz, yalnız daraltır;
- `package.json` içindeki `check` komutu runner'a devreder ve elle
  `node scripts/test-*` / `node --check lib/*` listesi içermez.

Böylece elle bakımlı listeye geri dönüş bir sonraki turda test hatası olarak
görünür.

`scripts/test-tool-input-hardening.mjs` ise bu turda bulunan hata sınıfını
kilitler: model argümanlarıyla ulaşılabilen her connector giriş noktası
(`gmail_read`, `canva_read`, `gmail_send`) ve NVIDIA tool dispatch katmanı
düşmanca girdide ham `TypeError` değil doğrulanmış hata kodu üretmelidir.

## Bu turda düzeltilen gerçek hatalar

- `lib/gmail-read-client.mjs` ve `lib/canva-read-client.mjs`: `read(null)`
  çağrısı doğrulanmış `INVALID_*_READ:request` hatası yerine ham `TypeError`
  fırlatıyordu. Girdi artık destructuring öncesi strict object olarak
  doğrulanır; bilinmeyen alanlar da reddedilir.
- `scripts/test-tool-runtime.mjs`: tool katalog beklentisi eskiydi (3 araç),
  gerçek katalog `canva_read` ve `gmail_read` ile 5 araç içeriyordu. Test
  güncellendi ve katalog invariant'larıyla (tekil isim/izin, yazma izni
  içermeyen okuma yüzeyi) güçlendirildi.

## Geri alma

`package.json` içindeki `check` / `precheck` komutlarını eski zincire döndürmek
ve `scripts/run-checks.mjs` ile `scripts/test-check-coverage.mjs` dosyalarını
silmek yeterlidir; runtime davranışı etkilenmez.
