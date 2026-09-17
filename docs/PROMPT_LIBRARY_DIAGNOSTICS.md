# İstem Kütüphanesi — Sağlık Kontrolü

`public/prompt-library-diagnostics.js`, istem kütüphanesinin üç yerel deposunu
okuyup tutarsızlıkları raporlayan ve yalnızca açık onayla onaran paneldir.

## Neden

İstemler, koleksiyonlar ve sürüm geçmişi ayrı `localStorage` anahtarlarında
tutulur:

- `hafize.prompt-library.v1`
- `hafize.prompt-library.collections.v1`
- `hafize.prompt-library.revisions.v1`

Bu depolar birbirinden ayrı yazıldığı için ayrışabilir: tarayıcı bir yazmayı
yarıda kesebilir, elle düzenlenmiş bir yedek bozuk kayıt taşıyabilir, silinen bir
istemin kimliği koleksiyonda kalabilir. Bugüne kadar bunun tek belirtisi istemin
listede görünmemesiydi. Panel bu durumu adlandırır.

## Bulgular

| Bulgu | Önem | Anlamı |
| --- | --- | --- |
| `prompts-unreadable` | error | İstem deposu JSON olarak ayrıştırılamıyor |
| `collections-unreadable` | error | Koleksiyon deposu ayrıştırılamıyor |
| `revisions-unreadable` | warning | Sürüm geçmişi deposu ayrıştırılamıyor |
| `invalid-prompts` | error | `normalizeItem` tarafından reddedilen kayıtlar |
| `duplicate-prompts` | warning | Aynı kimliği paylaşan istemler |
| `orphan-members` | warning | Silinmiş isteme işaret eden koleksiyon üyelikleri |
| `storage-pressure` | warning | Üç deponun toplamı 1.5 MB'ı aşıyor |

`scan()` hiçbir şey yazmaz; bozuk bir depoda da çalışması gerekir ve bu testle
sabitlenmiştir.

## Onarım

`Sorunları onar` düğmesi yalnızca onarılabilir bulgu varken etkinleşir ve
`confirm()` onayı olmadan hiçbir şey yapmaz. Onarım:

1. `normalizeCollection` ile okunabilir istemleri korur, okunamayanları düşürür
   ve aynı kimliği taşıyan kayıtları ilk kayıtta birleştirir,
2. sonucu kütüphanenin kendi `saveItems` yazıcısıyla kaydeder,
3. `pruneMembers` + `saveCollections` ile silinmiş istemlere işaret eden üyelikleri
   temizler,
4. `StorageEvent` yayımlayarak açık panellerin yeniden çizilmesini sağlar.

Sürüm geçmişi deposu onarım sırasında yeniden yazılmaz; yalnızca okunabilirliği
raporlanır.

## Sınırlar

- En fazla `MAX_ORPHANS = 60` yetim üyelik sayılır.
- Her bulgu en fazla 12 örnek ayrıntı listeler; kayıt adları 90 karakterle
  sınırlıdır.
- Modül ağa çıkmaz: `fetch`, `XMLHttpRequest` ve `navigator.sendBeacon`
  kullanılmaz; veri cihazdan ayrılmaz.

## Erişilebilirlik

- Panel `aria-labelledby` ile adlandırılır; rapor alanı `aria-live="polite"`
  taşır, böylece yeniden tarama sonucu ekran okuyucuya bildirilir.
- Gizle/Göster düğmesi `aria-expanded` ve `aria-controls` kullanır.
- Önem derecesi renk yerine `data-severity` ile taşınır; `forced-colors: active`
  altında yapı sistem renkleriyle korunur.

## Testler

```bash
node scripts/test-prompt-library-diagnostics.mjs
node scripts/test-prompt-library-diagnostics-behavior.mjs
```

İlki kaynak sözleşmesini, ikincisi gerçek depolar üzerinde tarama, sınır ve
onarım davranışını doğrular.

## Geri alma

`public/index.html` içindeki `prompt-library-diagnostics.js` ve
`prompt-library-diagnostics.css` etiketleri ile `public/sw-policy.js` içindeki
iki varlık kaydı çıkarılır ve shell cache sürümü artırılır. Panel kaybolur;
depolar olduğu gibi kalır, çünkü modül yalnızca açık onayla yazar.
