# Smart Fill Geliştirici Notları

Smart Fill, Prompt Library kartının üzerine oturan üç ayrı tarayıcı modülünden oluşur. Hiçbiri backend'e bağlanmaz; tamamı cihaz üzerindeki veriyle çalışır.

## Modüller

| Dosya | Global | Sorumluluk |
|---|---|---|
| `public/prompt-library-smart-fill.js` | `HafizePromptLibrarySmartFill` | Doldurma paneli, değişken setleri, önizleme, composer'a aktarım |
| `public/prompt-library-command-palette.js` | `PromptLibraryCommandPalette` | Composer içindeki `/prompt` seçicisi |
| `public/prompt-library-smart-fill-hints.js` | `HafizePromptSmartFillHints` | Panel içindeki karakter/alan sayaçları |

Yükleme sırası `index.html` içinde sabittir: önce `prompt-library.js`, sonra smart fill, sonra palette, en sonda hints. Palette ve hints çekirdeğe değil smart fill'e bağlıdır; bu yüzden sıra değiştirilmez.

## Çekirdekle sınır

Smart Fill kendi değişken sözdizimini tanımlamaz. `{{ad}}` çözümlemesi ve yerine koyma çekirdekten gelir:

- `HafizePromptLibrary.extractVariables(body)` → panelin alanları,
- `HafizePromptLibrary.replaceVariables(body, values)` → önizleme ve aktarılan metin,
- `HafizePromptLibrary.loadItems(store)` / `saveItems(store, items)` → kullanım sayacının okunup yazılması,
- `HafizePromptLibrary.normalizeItem(item)` → sayaç artırıldıktan sonra kaydın yeniden doğrulanması.

`hints` modülü yalnızca DOM'u okur: `loadItems` / `saveItems` çağıramaz. Palette istem yazamaz. Bu sınır `scripts/test-prompt-smart-fill-developer-contract.mjs` ile korunur.

## Kullanım sayacı

`Kullan` düğmesi değişkenli istemlerde capture fazında yakalanır (`interceptUse` → `stopImmediatePropagation`), yani çekirdeğin kendi tıklama işleyicisi çalışmaz. Sayacı bu yüzden panelin kendisi artırır: `insertIntoComposer` composer'ı doldurduktan sonra `recordUse` çağrılır, kayıt `normalizeItem` ile yeniden doğrulanıp saklanır ve aynı sekmedeki dinleyiciler için bir `StorageEvent` yayılır. Yerel yazma kendiliğinden `storage` event'i üretmediğinden bu adım atlanırsa kart ve istatistik paneli eski sayıyı gösterir.

## Depolama

| Anahtar | İçerik |
|---|---|
| `hafize.prompt-library.v1` | İstemler (çekirdek sahibi) |
| `hafize.prompt-library.smart-fill.v1.<istem-id>` | O isteme ait değişken setleri |

Setler istem başına ayrı anahtarda tutulur; böylece bir istem silindiğinde diğer setler etkilenmez ve tek bir kayıt bozulduğunda yalnız o istem etkilenir. Okuma `try/catch` ile sarılıdır: site verisi engellendiğinde `readPresets` boş liste döndürür ve panel yine açılır.

## Sınırlar

| Sabit | Değer | Anlamı |
|---|---|---|
| `MAX_VALUE` | 1000 | Tek değişken değeri |
| `MAX_VARIABLES` | 12 | İstem başına alan |
| `MAX_PRESETS` | 6 | İstem başına değişken seti |
| `MAX_NAME` | 60 | Set adı |
| `MAX_PREVIEW` | 8000 | Önizleme ve aktarılan metin |

Sınırlar tek bir `clamp(value, limit)` yardımcı fonksiyonundan geçer. `scripts/test-prompt-smart-fill-limits.mjs` bu sınırları modülü gerçekten yükleyip preset yazarak doğrular; sabitin yazımı değil davranışı korunur.

## Yerel çalıştırma

```bash
npm start
```

Panel yalnızca `#promptLibraryCard` DOM'da varsa mount olur; kart yoksa `mount()` `null` döner. Node içinde modülü test ederken `globalThis.localStorage` ve `globalThis.HafizePromptLibrary` sahte nesnelerle doldurulup dosya `require` edilebilir — `scripts/test-prompt-smart-fill-limits.mjs` bu deseni kullanır.

## Kontroller

```bash
node scripts/test-prompt-smart-fill-limits.mjs
node scripts/test-prompt-smart-fill-a11y.mjs
node scripts/test-prompt-smart-fill-intercept.mjs
node scripts/test-prompt-smart-fill-usage-boundary.mjs
node scripts/test-prompt-smart-fill-storage-errors.mjs
```

Sürüm öncesi tam liste için `docs/PROMPT_SMART_FILL_CHECKLIST.md` dosyasına bakın.
