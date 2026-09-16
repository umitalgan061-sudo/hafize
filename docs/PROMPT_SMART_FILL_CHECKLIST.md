# Smart Fill Sürüm Kontrol Listesi

Bu liste, Smart Fill / İstem seçici yüzeylerine dokunan her turda merge öncesi işaretlenir. Her madde ya bir komutla ya da tarayıcıda tek bir gözle doğrulanabilir olmalıdır.

## 1. Kod sınırları

- [ ] `public/prompt-library-smart-fill.js`, `public/prompt-library-command-palette.js` ve `public/prompt-library-smart-fill-hints.js` içinde `fetch(`, `XMLHttpRequest`, `WebSocket`, `navigator.sendBeacon` yok.
- [ ] Aynı dosyalarda `innerHTML =`, `outerHTML`, `document.write` yok; tüm metin `textContent` ile yazılıyor.
- [ ] Değişken değerleri `clamp(value, MAX_VALUE)` üzerinden sınırlanıyor; `MAX_VALUE = 1000`, `MAX_VARIABLES = 12`, `MAX_PRESETS = 6`, `MAX_NAME = 60`, `MAX_PREVIEW = 8000` sabitleri değişmediyse dokümanlar da güncel.
- [ ] `localStorage` okuma ve yazma çağrılarının tamamı `try`/`catch` içinde; site verisi engellenmiş bir tarayıcıda panel yine açılıyor.
- [ ] Smart Fill, Prompt Library çekirdeğinin değişken çıkarma/yerleştirme mantığını kopyalamıyor; `extractVariables` ve `replaceVariables` çekirdekten çağrılıyor.

## 2. Davranış

- [ ] Değişkensiz bir istemde `Kullan` eski doğrudan aktarım yolunda kalıyor; panel açılmıyor.
- [ ] Değişkenli bir istemde `Kullan` paneli açıyor ve çekirdek handler'ı `stopImmediatePropagation()` ile devre dışı bırakıyor.
- [ ] Boş bırakılan bir alan varken `Mesaja aktar` engelleniyor ve hata metni görünüyor.
- [ ] `Mesaja aktar` composer'ı dolduruyor, `input` olayını tetikliyor ve formu göndermiyor (`requestSubmit`/`submit` çağrısı yok).
- [ ] Aktarım sonrası ilgili istemin `useCount` değeri bir artıyor ve kütüphane kartı yeniden çiziliyor.
- [ ] Değişken seti kaydetme, seçme ve temizleme yalnızca açık olan istemin anahtarını etkiliyor.
- [ ] Composer'a `/prompt` yazmak ve `Ctrl / ⌘ + Shift + O` seçiciyi açıyor; `↑ / ↓`, `Enter`, `Esc` beklendiği gibi çalışıyor.

## 3. Erişilebilirlik ve keyboard

- [ ] Panel `role="dialog"`, `aria-modal`, `aria-labelledby` ve `aria-describedby` taşıyor.
- [ ] `Esc` paneli kapatıyor, `Tab` odağı panel içinde döndürüyor, kapanışta odak paneli açan öğeye dönüyor.
- [ ] Her değişken alanının erişilebilir adı var; karakter sayacı `aria-label` ile okunuyor.
- [ ] Seçici listesi `role="listbox"`, satırlar `role="option"` ve `aria-selected` durumunu güncelliyor.

## 4. PWA

- [ ] Yeni bir CSS/JS dosyası eklendiyse `public/index.html` ve `public/sw-policy.js` içindeki shell listesi birlikte güncellendi.
- [ ] `CURRENT_CACHE` sürümü artırıldı; shell listesindeki her yolun diskte karşılığı var.
- [ ] `node scripts/test-pwa-cache-policy.mjs` geçiyor (shell listesi ↔ `index.html` eşleşmesini bu suite doğrular).

## 5. Storage ve gizlilik

- [ ] Preset verisi Prompt Library export'una sızmıyor.
- [ ] Panel ve seçici hiçbir değeri sunucuya göndermiyor; tüm veri cihazda kalıyor.
- [ ] Kota dolduğunda kullanıcı hata metnini görüyor, panel çökmüyor.

## 6. Test

- [ ] `npm run precheck`
- [ ] `npm run check`
- [ ] `node scripts/test-prompt-smart-fill-final-contract.mjs`
- [ ] `node scripts/test-prompt-smart-fill-user-journey.mjs`
- [ ] `node scripts/test-prompt-smart-fill-regression.mjs`

## 7. Rollback

- [ ] `docs/PROMPT_SMART_FILL_ROLLBACK.md` adımları hâlâ geçerli.
- [ ] Modüller `index.html` ve shell listesinden çıkarıldığında Prompt Library tek başına çalışmaya devam ediyor.

## 8. Güvenlik

- [ ] Diff içinde token, anahtar veya kimlik bilgisi benzeri sabit yok.
- [ ] `node scripts/test-prompt-smart-fill-security-review.mjs` benzeri güvenlik suite'leri geçiyor.
