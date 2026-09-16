# Smart Fill Sürüm Kontrol Listesi

Bu liste Smart Fill yüzeyine dokunan her değişiklikte, merge öncesinde elden geçirilir. Her madde ya karşılanır ya da PR açıklamasında gerekçesiyle birlikte açıkça atlanır.

## 1. Kod

- [ ] Değişken çözümleme yalnızca `HafizePromptLibrary.extractVariables` / `replaceVariables` üzerinden yapılıyor; ikinci bir regex davranışı eklenmedi.
- [ ] Kullanıcıdan gelen metin DOM'a yalnız `textContent` / `value` ile yazılıyor; `innerHTML`, `outerHTML`, `insertAdjacentHTML` yok.
- [ ] Modül ağ çağrısı yapmıyor: `fetch`, `XMLHttpRequest`, `WebSocket`, `navigator.sendBeacon` yok.
- [ ] Sınırlar tek yerden geliyor: `MAX_VALUE`, `MAX_VARIABLES`, `MAX_PRESETS`, `MAX_NAME`, `MAX_PREVIEW`.
- [ ] `localStorage` okuma ve yazma işlemleri `try/catch` içinde; site verisi engellendiğinde panel yine açılıyor.
- [ ] Panel submit etmiyor: `requestSubmit()` ve `form.submit()` çağrısı yok.

## 2. Davranış

- [ ] Değişkensiz istemde `Kullan` eski doğrudan aktarımı koruyor.
- [ ] Değişkenli istemde panel açılıyor ve ilk alan odaklanıyor.
- [ ] Önizleme her tuş vuruşunda güncelleniyor.
- [ ] Boş bırakılan alan aktarımı engelliyor ve hata metni görünür oluyor.
- [ ] Aktarım composer'ı dolduruyor, `input` event'i yayıyor ve paneli kapatıyor.
- [ ] Aktarım sonrası istemin `useCount` değeri bir artıyor ve kütüphane kartı güncelleniyor.

## 3. Değişken setleri

- [ ] Set kaydetme istem başına en fazla `MAX_PRESETS` kayıt tutuyor.
- [ ] Set seçimi alanları dolduruyor, eksik anahtarlar boş kalıyor.
- [ ] Set temizleme yalnızca o istemin setlerini siliyor.
- [ ] Setler Prompt Library export'una dahil edilmiyor.

## 4. Erişilebilirlik

- [ ] `role="dialog"`, `aria-modal`, `aria-labelledby`, `aria-describedby` tanımlı.
- [ ] Tab ve Shift+Tab odağı panel içinde tutuyor.
- [ ] `Escape` paneli kapatıyor ve odak paneli açan düğmeye dönüyor.
- [ ] Önizleme `aria-live="polite"`, hata alanı `role="alert"`.
- [ ] `prefers-reduced-motion` ve `forced-colors` senaryoları bozulmuyor.

## 5. PWA

- [ ] Yeni asset `public/index.html` ve `SHELL_ASSETS` listesinin ikisine birden eklendi.
- [ ] `CURRENT_CACHE` sürümü bir artırıldı.
- [ ] `node scripts/test-pwa-cache-policy.mjs` geçiyor (liste ile sayfa iki yönlü eşleşiyor).

## 6. Kontroller

- [ ] `npm run precheck`
- [ ] `npm run check`
- [ ] Başarısız kalan paket varsa PR açıklamasında adıyla ve nedeniyle belirtildi.

## 7. Geri alma

- [ ] Değişiklik tek commit ile geri alınabilir durumda.
- [ ] Geri alma sonrası eski shell cache sürümünün temizlendiği doğrulandı.
- [ ] Kullanıcı verisi (istemler, setler) geri alma sırasında silinmiyor.
