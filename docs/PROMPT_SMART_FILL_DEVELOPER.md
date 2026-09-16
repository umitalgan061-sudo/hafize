# Smart Fill Geliştirici Rehberi

Bu dosya Smart Fill yüzeyine dokunacak geliştiriciler içindir: modüllerin sorumlulukları, birbirlerine hangi API üzerinden bağlandıkları ve hangi sınırların aşılmaması gerektiği.

## Modüller

| Dosya | Global | Sorumluluk |
|---|---|---|
| `public/prompt-library.js` | `HafizePromptLibrary` | İstem CRUD'u, normalizasyon, storage, değişken çıkarma/yerleştirme |
| `public/prompt-library-smart-fill.js` | `HafizePromptLibrarySmartFill` | Değişken doldurma diyaloğu, preset yönetimi, composer'a aktarım |
| `public/prompt-library-command-palette.js` | `PromptLibraryCommandPalette` | Composer içinden `/prompt` ile istem arama ve seçme |
| `public/prompt-library-smart-fill-hints.js` | `HafizePromptSmartFillHints` | Panel içindeki karakter sayaçları; salt görsel katman |

Yükleme sırası `index.html` içinde bu tablodaki sırayla sabittir: çekirdek her zaman kendisine bağlı katmanlardan önce gelir.

## Bağımlılık yönü

```
prompt-library.js  ←  prompt-library-smart-fill.js  ←  prompt-library-command-palette.js
                              ↑
                   prompt-library-smart-fill-hints.js (yalnızca DOM okur)
```

Kurallar:

- Smart Fill ve palette, istem verisine yalnızca `HafizePromptLibrary` üzerinden erişir (`loadItems`, `saveItems`, `normalizeItem`, `extractVariables`, `replaceVariables`). Storage anahtarını kendi başına parse eden ikinci bir yol açılmaz.
- Palette istem yazmaz: içinde `saveItems` çağrısı bulunmamalıdır. Değişkenli bir istem seçildiğinde işi `HafizePromptLibrarySmartFill.open(item)` ile devreder.
- Hints katmanı veri katmanını hiç tanımaz: `loadItems`/`saveItems` geçmez, yalnızca panelin DOM'unu gözlemler.
- Çekirdek, üst katmanları tanımaz. `prompt-library.js` içinde `HafizePromptLibrarySmartFill` referansı olmamalıdır.

Bu yönler `scripts/test-prompt-smart-fill-developer-contract.mjs` tarafından doğrulanır.

## Kullanım sayacı

Değişkenli bir istemde `Kullan` tıklaması capture fazında yakalanır ve `stopImmediatePropagation()` ile çekirdeğin kendi handler'ı devre dışı bırakılır. Bu yüzden `useCount` artışını Smart Fill üstlenir: `insertIntoComposer()` composer'ı doldurduktan sonra `recordUse(promptId)` çağırır, kaydı `normalizeItem` ile yeniden üretip `saveItems` ile yazar ve aynı sekmedeki kartın yenilenmesi için sentetik bir `storage` olayı gönderir. Bu akış bozulursa değişkenli istemler kullanım istatistiklerinde hiç görünmez.

## Sınırlar

| Sabit | Değer | Anlamı |
|---|---|---|
| `MAX_VALUE` | 1000 | Tek bir değişken değeri |
| `MAX_VARIABLES` | 12 | İstem başına değişken sayısı |
| `MAX_PRESETS` | 6 | İstem başına kaydedilmiş değer seti |
| `MAX_NAME` | 60 | Set adı |
| `MAX_PREVIEW` | 8000 | Önizleme ve composer'a yazılan metin |

Tüm kırpma işlemleri `clamp(value, limit)` yardımcısından geçer; yeni bir alan eklenirken de aynı yardımcı kullanılır.

## Storage

- İstemler: `hafize.prompt-library.v1`
- Panel durumu: `hafize.prompt-library.v1.state`
- Değer setleri: `hafize.prompt-library.smart-fill.v1.<istemId>`

Setler istem başına ayrı anahtarda tutulur; böylece bir istem silindiğinde diğer setler etkilenmez ve setler Prompt Library export'una dahil olmaz. `localStorage` erişimi site verisi engellenmiş tarayıcılarda doğrudan exception atabildiği için her okuma ve yazma `try`/`catch` içindedir; hata durumunda panel boş set listesiyle çalışmaya devam eder.

## Keyboard

- Panel: `Esc` kapatır, `Tab` / `Shift + Tab` odağı panel içinde döndürür, alan içinde `Enter` ve `↑ / ↓` bir sonraki alana geçer.
- Seçici: `/prompt` veya `Ctrl / ⌘ + Shift + O` açar, `↑ / ↓` gezinir, `Enter` seçer, `Esc` kapatır.
- Odak paneli açan öğeye geri döner (`lastFocus`).

## Yeni asset eklerken

1. Dosyayı `public/` altına ekle.
2. `public/index.html` içine doğru sırada `<script defer>` veya `<link rel="stylesheet">` satırını ekle.
3. `public/sw-policy.js` içindeki `SHELL_ASSETS` listesine ekle ve `CURRENT_CACHE` sürümünü artır.
4. `node scripts/test-pwa-cache-policy.mjs` çalıştır: bu suite hem `index.html` ↔ shell listesi eşleşmesini hem de her yolun diskte var olduğunu doğrular. Shell listesinde diskte olmayan tek bir yol bile `cache.addAll` çağrısını reddeder ve service worker hiç kurulmaz.

Cache sürümü test dosyalarına asla sabit olarak yazılmaz; sürümden bağımsız doğrulama için `scripts/shell-cache-contract.mjs` yardımcıları kullanılır.

## Test

Hızlı döngü:

```bash
node scripts/test-prompt-smart-fill-developer-contract.mjs
node scripts/test-prompt-smart-fill-user-journey.mjs
node scripts/test-prompt-smart-fill-final-contract.mjs
```

Merge öncesi tam liste için `docs/PROMPT_SMART_FILL_CHECKLIST.md` dosyasına bakın.

## Güvenlik

Bu üç modül ağ erişimi kurmaz: `fetch(`, `XMLHttpRequest`, `WebSocket` ve `navigator.sendBeacon` kullanımı testlerle engellenir. DOM yalnızca `createElement` ve `textContent` ile kurulur; `innerHTML`/`outerHTML` kullanılmaz. Kullanıcı değerleri panoya yalnızca kullanıcının açık isteğiyle (`Önizlemeyi kopyala`) yazılır.
