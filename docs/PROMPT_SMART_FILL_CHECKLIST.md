# Smart Fill Sürüm Kontrol Listesi

Bu liste, akıllı doldurma penceresine dokunan bir değişikliğin birleştirilmeden önce geçmesi gereken adımları toplar. Her madde kanıt üretir: bir komut çıktısı, bir ekran denemesi veya bir dosya referansı. Kanıt üretilemeyen madde "geçti" sayılmaz.

## 1. Kod sınırları

- [ ] `public/prompt-library-smart-fill.js` içinde ağ çağrısı yok: `fetch`, `XMLHttpRequest`, `WebSocket`, `navigator.sendBeacon`.
- [ ] HTML sink yok: `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write`.
- [ ] Değer sınırları sabit kalır: `MAX_VALUE = 1000`, `MAX_VARIABLES = 12`, `MAX_PRESETS = 6`, `MAX_NAME = 60`, `MAX_PREVIEW = 8000`.
- [ ] Depolama anahtarı `hafize.prompt-library.smart-fill.v1` önekini korur ve istem id'si ile bölümlenir.
- [ ] Pencere `metaKey` / `ctrlKey` kısayolu sahiplenmez; Cmd/Ctrl kısayolları palette ve keyboard modüllerinindir.
- [ ] Kullanım sayacı yalnız `HafizePromptLibrary` API'si üzerinden yazılır; storage'a doğrudan yazılmaz.

## 2. Depolama dayanıklılığı

- [ ] `getItem` fırlattığında (gizli sekme, engellenmiş site verisi) pencere boş preset listesiyle açılır.
- [ ] `setItem` kota hatası verdiğinde kullanıcıya hata gösterilir, istisna dışarı sızmaz.
- [ ] Bozuk preset JSON'u sessizce yok sayılır, panel yine açılır.
- [ ] Bir istemin setleri temizlendiğinde yalnız o istemin anahtarı silinir.

## 3. Erişilebilirlik

- [ ] `role="dialog"`, `aria-modal`, `aria-labelledby` ve `aria-describedby` ayarlıdır.
- [ ] Önizleme `aria-live="polite"`, hata alanı `role="alert"` taşır.
- [ ] `Escape` pencereyi kapatır.
- [ ] `Tab` odağı pencere içinde döndürür, `Shift + Tab` geriye sarar.
- [ ] Kapanışta odak pencereyi açan düğmeye döner (`previousFocus`).
- [ ] Her değişken alanının erişilebilir adı vardır.

## 4. Kullanım akışı

- [ ] Değişkensiz istemde `Kullan` eski doğrudan aktarımı korur; pencere açılmaz.
- [ ] Değişkenli istemde `Kullan` yakalanır (`stopImmediatePropagation`) ve pencere açılır.
- [ ] Boş bırakılan bir değişken aktarımı engeller ve hatayı gösterir.
- [ ] `Mesaja aktar` yalnız `#messageInput` değerini değiştirir; form submit etmez (`requestSubmit` / `form.submit` yok).
- [ ] `Mesaja aktar` istemin `useCount` değerini tam olarak bir artırır; diğer istemler değişmez.
- [ ] Kullanım artışı İstem Kütüphanesi kullanım özetine yansır.

## 5. PWA ve kabuk

- [ ] `public/index.html` beş varlığı da yükler: smart-fill css/js, command palette css/js, smart-fill hints js.
- [ ] Aynı varlıklar `SHELL_ASSETS` içinde yer alır ve diskte gerçekten mevcuttur.
- [ ] `CURRENT_CACHE` sürümü kabuk değiştiğinde artırılmıştır.
- [ ] Hiçbir `/api/` yolu kabuk cache'ine girmez.

`SHELL_ASSETS` atomik olarak `cache.addAll` ile önbelleğe alınır; listede diskte olmayan tek bir yol tüm service worker kurulumunu düşürür. Bu yüzden varlık listesi değişikliği bu listedeki en riskli adımdır.

## 6. Doğrulama komutları

```bash
node scripts/test-prompt-smart-fill-final-contract.mjs
node scripts/test-prompt-smart-fill-a11y.mjs
node scripts/test-prompt-smart-fill-limits.mjs
node scripts/test-prompt-smart-fill-storage-errors.mjs
node scripts/test-prompt-smart-fill-usage-boundary.mjs
node scripts/test-prompt-smart-fill-user-journey.mjs
node scripts/test-prompt-smart-fill-regression-docs.mjs
node scripts/test-pwa-cache-policy.mjs
npm run check
```

## 7. Geri alma

Pencere yalnız `public/prompt-library-smart-fill.*` dosyalarında yaşar ve `Kullan` düğmesini yakalayarak devreye girer. `public/index.html` içindeki script satırı ve `SHELL_ASSETS` girdisi geri alındığında kütüphane eski doğrudan aktarım davranışına döner; kayıtlı setler kullanıcının cihazında kalır ve veri kaybı olmaz. Ayrıntı için `PROMPT_SMART_FILL_ROLLBACK.md`.
