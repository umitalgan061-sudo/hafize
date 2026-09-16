# Sohbet Markdown Render — Güvenlik Sınırı

Asistan yanıtı güvenilmeyen metindir. İçeriği yalnızca model belirlemez:
kullanıcının yapıştırdığı metin, bir araç çağrısının döndürdüğü GitHub sayfası,
bir e-posta gövdesi veya bir takvim kaydı da yanıtın içine girebilir. Render
katmanı bu metni **veri** olarak işler, hiçbir koşulda yürütülebilir içerik
olarak değil.

## Tehdit modeli

| Tehdit | Örnek | Karşılık |
| --- | --- | --- |
| Depolanmış XSS | Yanıt `<script>fetch('/api/...')</script>` içerir | Hiçbir dize HTML ayrıştırıcısına verilmez; etiket harfi harfine metindir |
| Bağlantı üzerinden script | `[tıkla](javascript:alert(1))` | `safeUrl()` yalnızca `http:`, `https:`, `mailto:` şemalarına izin verir |
| Şema gizleme | `java\tscript:alert(1)`, `JaVaScRiPt:` | Kontrol karakteri içeren adres reddedilir; şema karşılaştırması küçük harfe indirgenir |
| Veri URL'si | `data:text/html;base64,…` | Şema izin listesinde değildir |
| Uzak iz sürme | `![piksel](https://tracker/pixel.gif)` | Resim referansı `<img>` değil bağlantı olarak çizilir; yanıt kendiliğinden ağ isteği doğuramaz |
| Sekme ele geçirme | `[a](https://kötü)` yeni sekmede `window.opener` | Her bağlantı `rel="noopener noreferrer nofollow ugc"` taşır |
| Uygulama içi yönlendirme | `[ayarlar](/api/schedules)` | Göreli adresler tümüyle reddedilir; model uygulamanın kendi uçlarına bağlantı üretemez |
| Olay işleyici enjeksiyonu | `<b onclick="…">` | Nitelikler sabit bir listeden gelir; `on*` hiçbir yolda üretilmez |
| Kaynak tüketimi | 3 000 karakterlik ayraç çorbası, 60 kat iç içe alıntı | Her ayrıştırma adımı sınırlıdır ve sınıra takılan yanıt düz metne döner |

## Değişmezler

1. **Tek yazma yolu.** Metin DOM'a yalnızca `createTextNode()` ve `textContent`
   ile girer. `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write`,
   `createContextualFragment`, `eval` ve `new Function` iki kaynak dosyada da
   yasaktır; `scripts/test-chat-markdown-security.mjs` bunu dosya üzerinde
   doğrular.
2. **Şema izin listesi.** `SAFE_SCHEMES` dondurulmuştur ve yalnızca `http:`,
   `https:`, `mailto:` içerir. Şemasız (göreli) adresler de reddedilir.
3. **Nitelik izin listesi.** Render edilen ağaçta yalnızca `class`, `href`,
   `target`, `rel`, `title`, `scope`, `type`, `start`, `role`, `tabindex`,
   `data-align`, `data-language`, `data-md`, `data-md-copy`, `data-state`,
   `data-streaming`, `aria-hidden`, `aria-label` bulunabilir.
4. **Sessiz düşürme yok.** Reddedilen bir bağlantı kaybolmaz; kaynak metni
   olduğu gibi görünür kalır. Kullanıcı neyin geldiğini görebilir.
5. **Sınırlı iş.** Her ayrıştırma adımı `LIMITS` ile sınırlıdır. Sınırlar
   `Object.freeze` ile korunur, çalışma anında gevşetilemez.
6. **Pano yazma yok.** Kod bloğu kopyalama yalnızca kullanıcı tıklamasıyla
   çalışır; render sırasında panoya hiçbir şey yazılmaz.

## Kapsam dışı

- Render katmanı bir içerik politikası (CSP) yerine geçmez. Sunucu tarafındaki
  başlıklar ve `lib/production-guard.mjs` sınırları bu değişiklikten
  etkilenmez.
- Kullanıcı mesajları render edilmez; onlar zaten düz metindir ve `pre-wrap` ile
  gösterilir.
- Ham markdown kaynağı tarayıcıda bir `WeakMap` içinde tutulur; `localStorage`'a
  ek bir kopya yazılmaz, sunucuya hiçbir şey gönderilmez.

## Doğrulama

```bash
node scripts/test-chat-markdown-security.mjs
node scripts/test-chat-markdown-limits.mjs
```

İlk paket düşman girdileri üzerinde üretilen düğüm ağacını denetler; ikincisi
her sınırın zaman bütçesi içinde düz metne düştüğünü ölçer.
