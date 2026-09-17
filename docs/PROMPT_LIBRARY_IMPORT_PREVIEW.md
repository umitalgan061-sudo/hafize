# İstem Kütüphanesi — İçe Aktarma Önizlemesi

`public/prompt-library-import-preview.js`, bir istem yedeğini içe aktarmadan önce
dosyanın kütüphaneye ne yapacağını gösteren yerel bir onay katmanıdır.

## Neden

İçe aktarma daha önce tek adımdı: dosya seçilir, okunur ve doğrudan
`hafize.prompt-library.v1` anahtarına yazılırdı. Yanlış dosya ancak yazıldıktan
sonra fark edilirdi. Bu katman, dosya seçimi ile yazma arasına giren ve yalnızca
açık onayla devam eden bir adımdır.

## Akış

1. Kullanıcı `İçe aktar` düğmesine basar; kütüphane gizli dosya girdisini açar.
2. Önizleme katmanı kart üzerinde **capture** fazında `change` olayını yakalar ve
   `stopImmediatePropagation()` ile kütüphanenin doğrudan içe aktarımını durdurur.
3. Dosya `FileReader` ile okunur. 1 MB (`MAX_FILE = 1000000`) sınırını aşan dosya
   okunmaz; panel sınırı söyleyip kapanır.
4. İçerik `HafizePromptLibrary.normalizeImportedPayload` ile ayrıştırılır ve
   `analyze()` her kaydı sınıflandırır.
5. Onay verilirse `mergeImportedItems` + `saveItems` çağrılır ve `StorageEvent`
   yayımlanır; kütüphane kendi storage dinleyicisiyle listeyi yeniden çizer.

## Sınıflandırma

| Sınıf | Anlamı |
| --- | --- |
| `new` | Kimliği kütüphanede bulunmayan istem; olduğu gibi eklenir |
| `copy` | Kimliği çakışan istem; mevcut kayıt korunur, dosyadaki kayıt yeni kimlikle eklenir |
| `skipped` | Kütüphane üst sınırı (`LIMITS.maxItems`) dolduğu için eklenmeyecek kayıt |
| `invalid` | `normalizeItem` tarafından reddedilen kayıt (örneğin gövdesi olmayan) |

`analyze()` yalnızca hesaplar; hiçbir şey yazmaz. `importable = new + copy`
sayısı, onaydan sonra `mergeImportedItems`'ın döndürdüğü `imported` sayısıyla
birebir aynıdır ve bu eşitlik testle sabitlenmiştir.

## Erişilebilirlik

- Panel `role="dialog"`, `aria-modal="true"`, `aria-labelledby` ve
  `aria-describedby` ile açılır.
- `Escape` kapatır, `Tab` odağı panel içinde tutar, kapanışta odak paneli açan
  öğeye döner.
- Geri bildirim satırı `role="status"` taşır.
- İçe aktarılabilir kayıt yoksa onay düğmesi `disabled` kalır.

## Sınırlar ve gizlilik

- Dosya boyutu 1 MB, listede gösterilen satır sayısı `MAX_ROWS = 40`, kayıt adı
  90 karakterle sınırlıdır.
- Modül ağa çıkmaz: `fetch`, `XMLHttpRequest` ve `WebSocket` kullanılmaz.
- Tüm veri cihazda kalır; yazma yalnızca kütüphanenin kendi `saveItems`
  fonksiyonu üzerinden yapılır, böylece kütüphanenin normalizasyonu ve sınırları
  geçerliliğini korur.

## Testler

```bash
node scripts/test-prompt-library-import-preview.mjs
node scripts/test-prompt-library-import-preview-behavior.mjs
```

İlki kaynak sözleşmesini (dialog yapısı, sınırlar, ağ yasağı), ikincisi
`analyze()` davranışını ve önizlemenin gerçek birleştirme sonucuyla tutarlılığını
doğrular.

## Geri alma

`public/index.html` içindeki `prompt-library-import-preview.js` etiketi ve
`public/sw-policy.js` içindeki iki varlık kaydı çıkarılır; shell cache sürümü
artırılır. Kütüphanenin kendi `change` dinleyicisi tekrar devreye girer ve içe
aktarma eski tek adımlı davranışına döner. Depolanan istem verisi etkilenmez.
