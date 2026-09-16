# Smart Fill Geliştirici Notları

Akıllı doldurma, İstem Kütüphanesi'ndeki değişkenli istemleri composer'a aktarmadan önce değerlerini toplayan modal bir penceredir. Bu belge modülün iç yapısını, bağımlılıklarını ve değiştirirken korunması gereken sınırları anlatır.

## Dosyalar

| Dosya | Sorumluluk |
|---|---|
| `public/prompt-library-smart-fill.js` | Pencerenin kendisi: alanlar, önizleme, presetler, aktarım |
| `public/prompt-library-smart-fill.css` | Pencere görünümü, `forced-colors` ve `prefers-reduced-motion` desteği |
| `public/prompt-library-smart-fill-hints.js` | Liste satırlarına değişken sayısı rozetlerini basar |
| `public/prompt-library-command-palette.js` | `/prompt` komutuyla pencereyi composer'dan açar |

Yükleme sırası `index.html` içinde anlamlıdır: `prompt-library.js` → `prompt-library-smart-fill.js` → `prompt-library-command-palette.js` → `prompt-library-smart-fill-hints.js`. Pencere çekirdek API'ye, palette pencereye, hints ise ikisinin ürettiği DOM'a dayanır.

## Bağımlılık yönü

Modül çekirdek kütüphaneye `root.HafizePromptLibrary` üzerinden erişir ve şu işlevleri kullanır:

- `extractVariables(body)` — `{{degisken}}` adlarını çıkarır,
- `replaceVariables(body, values)` — önizleme ve aktarım metnini üretir,
- `loadItems(storage)` / `saveItems(storage, items)` / `normalizeItem(input)` — kullanım sayacını yazmak için.

Bağımlılık tek yönlüdür. Çekirdek kütüphane pencereyi tanımaz, pencere de kullanım içgörüleri modülünü (`HafizePromptLibraryUsage`) tanımaz. Bu sınır `scripts/test-prompt-smart-fill-usage-boundary.mjs` tarafından doğrulanır.

## Devreye girme

Pencere kendi düğmesini eklemez. `promptLibraryCard` üzerinde capture aşamasında bir tıklama dinleyicisi kurar ve `.prompt-item-actions` içindeki `Kullan` düğmesini yakalar:

```js
card.addEventListener('click', interceptUse, true);
```

`interceptUse` yalnız istemin değişkeni varsa devreye girer. Değişkensiz istemlerde olay dokunulmadan geçer ve kütüphanenin kendi doğrudan aktarımı çalışır. Değişkenli istemlerde olay `preventDefault` ve `stopImmediatePropagation` ile durdurulur.

Bunun bir sonucu var: olay durdurulduğu için kütüphanenin `Kullan` işleyicisi hiç çalışmaz, dolayısıyla **kullanım sayacını da artırmaz**. Sayacı bu yüzden pencere kendi `recordUse(promptId)` fonksiyonuyla yazar. Aktarım yolunu değiştirirken bu çağrının korunması gerekir; aksi halde değişkenli istemler kullanım özetinde hep sıfır görünür.

## Durum

Pencere tek bir örnek olarak `mount()` sırasında kurulur ve `card.dataset.smartFillReady` ile ikinci kez kurulmayı reddeder. Açık pencerenin durumu üç değişkende tutulur:

- `activePrompt` — açılan istem,
- `activeNames` — `MAX_VARIABLES` ile sınırlanmış değişken adları,
- `activeInputs` — ad → input eşlemesi.

`closeDialog()` üçünü de sıfırlar ve odağı `previousFocus` üzerinden çağırana geri verir.

## Sınırlar

| Sabit | Değer | Neden |
|---|---|---|
| `MAX_VALUE` | 1000 | Tek bir değişken değeri |
| `MAX_VARIABLES` | 12 | Bir istemdeki alan sayısı |
| `MAX_PRESETS` | 6 | İstem başına kayıtlı set |
| `MAX_NAME` | 60 | Set adı |
| `MAX_PREVIEW` | 8000 | Önizleme ve aktarılan metin |

Tüm kırpma `clamp(value, limit)` yardımcısından geçer. Yeni bir alan eklerken değeri doğrudan kullanmak yerine `clamp` üzerinden geçirin.

## Depolama

Presetler istem başına ayrı anahtarlarda tutulur:

```
hafize.prompt-library.smart-fill.v1.<istemId>
```

Okuma iki kez korunmalıdır: `getItem` çağrısının kendisi fırlatabilir (engellenmiş site verisi) ve dönen metin bozuk JSON olabilir. `readPresets` her ikisini de yakalar ve boş liste döner. Yazma `writePresets` içinde `try/catch` ile sarılıdır ve başarı durumunu `boolean` olarak döndürür; çağıran taraf başarısızlıkta kullanıcıya hata gösterir.

## Erişilebilirlik

Pencere `role="dialog"` ve `aria-modal="true"` taşır, başlığını `aria-labelledby`, açıklamasını `aria-describedby` ile bağlar. Önizleme `aria-live="polite"`, hata alanı `role="alert"`tir. `trapKeydown` `Escape` ile kapatır ve `Tab` / `Shift + Tab` odağını pencere içinde döndürür. Pencere bilinçli olarak hiçbir Cmd/Ctrl kısayolu sahiplenmez; açıkken uygulamanın kısayollarını gölgelememesi için bu kural korunmalıdır.

## Test

```bash
node scripts/test-prompt-smart-fill-final-contract.mjs
node scripts/test-prompt-smart-fill-a11y.mjs
node scripts/test-prompt-smart-fill-intercept.mjs
node scripts/test-prompt-smart-fill-limits.mjs
node scripts/test-prompt-smart-fill-storage-errors.mjs
node scripts/test-prompt-smart-fill-usage-boundary.mjs
node scripts/test-prompt-smart-fill-user-journey.mjs
```

Davranışsal testler `scripts/browser-module-harness.mjs` üzerinden gerçek dosyayı yükler: modül `globalThis`/`self` sahte bir köke bağlanarak çalıştırılır, `document` verilmediği için kendini mount etmez ve yalnız saf API'sini yayınlar. Yeni bir saf fonksiyonu test edilebilir yapmak için onu modülün `api` nesnesine eklemek yeterlidir.

Kaynak metnine bakan kontrollerde sabit bir yazım biçimini değil sözleşmeyi doğrulayın; isteğe bağlı zincirleme (`navigator?.clipboard`) veya bir yardımcıya taşınan kırpma, davranış aynı kaldığı halde katı bir `grep`'i kırar.
