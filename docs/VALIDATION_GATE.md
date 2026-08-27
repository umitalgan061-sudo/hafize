# Doğrulama kapısı (keşif tabanlı)

`npm run check` artık `package.json` içinde elle bakımı yapılan uzun bir `&&`
zinciri değil, `scripts/run-checks.mjs` çalıştırıcısıdır.

## Neden değişti

Elle bakımı yapılan zincir sürüklendi:

- Diskteki 84 test dosyasının 32'si kapıya hiç girmemişti.
- 60'tan fazla `lib/` ve `public/` dosyası syntax kontrolünden geçmiyordu.
- Zincir ilk `&&` hatasında durduğu için tek çalıştırmada yalnız bir başarısızlık
  görülüyordu; arkadaki hatalar gizli kalıyordu.

Bu nedenle `main` üzerinde iki gerçek hata fark edilmeden kaldı:

1. `lib/gmail-read-client.mjs` — `read(null)` sözleşme hatası yerine
   denetlenmemiş `TypeError` üretiyordu.
2. `scripts/test-tool-runtime.mjs` — araç izin listesi beklentisi, Canva ve Gmail
   read araçları eklendikten sonra güncellenmemişti.

## Nasıl çalışır

- Hedefler dosya sisteminden keşfedilir: `server.mjs`, `lib/*.mjs`,
  `public/*.js` ve `scripts/*.mjs` syntax kontrolünden geçer;
  `scripts/test-*.mjs` ile `scripts/validate-*.mjs` çalıştırılır.
- Yeni bir test dosyası eklemek onu kapıya sokmak için yeterlidir; ayrıca
  `package.json` düzenlemek gerekmez, dolayısıyla kapı yeniden sürüklenemez.
- İlk hatada durulmaz; tüm başarısızlıklar toplanır ve çalıştırma sonunda tam
  çıktılarıyla birlikte raporlanır. En az bir başarısızlıkta çıkış kodu 1'dir.
- Her hedefin 180 saniyelik kendi zaman aşımı vardır; asılı kalan bir test
  kapıyı süresiz bloklamak yerine başarısız sayılır.
- `--pattern=a,b` yalnız yolu eşleşen hedefleri çalıştırır. `npm run precheck`
  bunu kullanarak hızlı UI alt kümesini (voice, ui-shell, sidebar) sürer; böylece
  ikinci bir elle bakımlı liste oluşmaz.

## Doğrulama

- `npm run check` → 159 syntax hedefi, 86 script, tümü yeşil.
- `npm run precheck` → 7 syntax hedefi, 4 script, tümü yeşil.
- Negatif kontrol: `lib/` içine kasıtlı syntax hatası eklendiğinde çalıştırıcı
  hem syntax hem de ilgili test hedefini FAIL raporlar ve 1 ile çıkar.

## Geri alma

`package.json` içindeki `check` / `precheck` komutlarını önceki `&&` zincirine
döndürmek ve `scripts/run-checks.mjs` dosyasını silmek yeterlidir. Kütüphane
düzeltmeleri bundan bağımsızdır ve ayrı olarak geri alınabilir.
