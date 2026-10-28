# Sohbet kaydırması, atlama butonu ve düşünme göstergesi

## 1. Sağ üstteki "Çevrimiçi" yazısı kaldırıldı

`app-runtime.ts` topbar'a bir bağlantı durumu butonu (`.runtime-status`) ekliyordu; odaklı sohbet
arayüzünde yer alması istenmiyordu.

`public/clean-ui.css`:
```css
.runtime-status { display: none !important; }
```

Kod çalışmaya devam eder (sağlık kontrolü, `destroy()` temizliği); yalnızca görünmez.

## 2. Cevap akarken sayfa otomatik kayıyor

**Önceki sorun:** `renderMessages()` şunu çağırıyordu:
```js
requestAnimationFrame(() => window.scrollTo({ top: document.body.scrollHeight }));
```
Ama kaydırılabilir olan element `#messages`'dır (`overflow-y: auto`); pencere hiç kaydırmaz.
Yani otomatik kaydırma hiç çalışmıyordu.

**Şimdi:** yeni `public/typed/chat-scroll.ts` modülü:

- `updateMessage()` her delta'da `chatScroll.follow()` çağırır → her yeni satır görünür alana çeker.
- `renderMessages()` `chatScroll.refresh()` çağırır.
- **Kullanıcı kontrolü:** `#messages` üzerindeki `scroll` dinleyicisi `isAtBottom()` ile konumu
  ölçer. Kullanıcı yukarı çıkmışsa (`following = false`) liste **yerinde kalır**; tarihçe okurken
  cevap akışı onu aşağı zorlamaz.
- `follow({ force: true })` (atlama butonu) kullanıcıyı en alta döndürür ve takibi yeniden açar.

## 3. "En alta git" butonu

Kullanıcı yukarı kaydırdığında `#chatScrollToBottom` belirir:

- Mesaj listesinin sağ altında yüzer, temaya uygun kart rengi ve vurgu renginde aşağı ok ikonu.
- Tıklayınca en son mesaja gider ve takibi yeniden başlatır.
- Kullanıcı en altta iken gizlidir (`hidden`).
- `aria-label="Sohbetin en sonuna git"`, `focus-visible` halkası, `forced-colors` desteği var.

## 4. Düşünme göstergesi

**Önceki sorun:** `.message.assistant .message-content:empty::after` ile bir nokta animasyonu vardı,
ama `markdown-renderer.ts` içerik boş olduğunda şunu yapıyor:
```js
container.replaceChildren(doc.createTextNode(placeholder));  // '…'
```
Yani `.message-content` **boş değil**, içinde `…` metni var → `:empty` hiç eşleşmiyor → animasyon
asla çalışmıyordu.

**Şimdi:** `#chatThinking` baloncuğu (`public/chat-scroll.css`):

- Üç nabız atan nokta + etiket.
- Etiket 2,6 saniyede bir döner: `Düşünüyor → Yazıyor → Araştırıyor → Yanıt hazırlıyor`
  (`thinkingLabelFor()`), böylece uzun araç zincirleri donmuş gibi görünmüyor.
- Gönderim/üretim başında açılır (`setThinking(true)`), bitince kapanır (`setThinking(false)`).
- Tema değişkenlerini kullanır; `prefers-reduced-motion` ve `forced-colors` destekler.

## Neler değişti

| Dosya | Değişiklik |
| --- | --- |
| `public/typed/chat-scroll.ts` | **Yeni**: kaydırma takibi, atlama butonu, düşünme baloncuğu |
| `public/chat-scroll.css` | **Yeni**: buton ve baloncuk stilleri |
| `public/typed/app-shell.ts` | Modül kurulumu, `follow`/`refresh`/`setThinking` çağrıları, bozuk `window.scrollTo` kaldırıldı |
| `public/clean-ui.css` | `.runtime-status` gizlendi |
| `public/sw-policy.ts` | `/chat-scroll.css` önbelleğe eklendi |
| `public/index.html` | CSS sürümü `v11` |

## Bu turda duzeltilen uc hata

1. **Atlama butonu yanlis yere konumlaniyordu.** Buton `position: absolute` ama ust eleman
   (`.chat-stage`) `position: static`'ti; bu yuzden buton sayfanin sag alt kosesine, kompozisyonun
   ustune degil goruntui alanina sabitleniyordu. `mountChatScroll` artik ust elemanin konumunu
   `relative` yapiyor.
2. **Dusunme baloncuugu hic gorunmuyordu.** Baloncuk da ayni flex ust elemana ekleniyordu; ama
   `#messages` (`flex: 1`) kalan alani doldurdugu icin baloncuk gorunur bolgenin altina
   itiliyordu. Artik `attachTail()` baloncuugu `#messages` icinde, listedeki son satir olarak
   tutuyor — `renderMessages()` `replaceChildren()` ile listeyi sildigi icin her render'dan sonra
   yeniden baglaniyor.
3. **Kullanici mesajlarinda ham markdown gorunuyordu.** Ekler `[Ekli dosya: ad](url)` biciminde
   saklaniyor (sunucu bu metinden referansi cozuyor) ama kullanici mesajlari duz metin olarak
   cizildigi icin sohbette `[Ekli dosya: gitignore.txt](/api/documents/doc_...)` yazisi gorunuyordu.
   `public/typed/user-attachments.ts` bu referanslari dosya rozetchipine (gorseller icin kucuk
   onizlemeye) donusturuyor; sunucuya giden metin degismiyor.

## Test

`public/typed/chat-scroll.test.ts` — 8 test:
- `isAtBottom()`: altta takip, yukarı çıkınca durma, kısa liste, özel tolerans.
- `thinkingLabelFor()`: dönen etiket, sarmalama, negatif/NaN girdi, özel liste.
