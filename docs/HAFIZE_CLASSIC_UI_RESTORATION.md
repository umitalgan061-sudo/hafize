# Hafize — Klasik tam arayüzün geri kazanılması

## Amaç
Git commit geçmişini geri almadan, kodu ve yetenekleri koruyarak eski gelişmiş çalışma alanını geri getirmek.

## İncelemede bulunan neden
`public/clean-ui.css` Ekim 2026'dan bu yana sohbet dışındaki birçok kontrolü görsel olarak saklayabiliyordu. Gizlenen öğelerin çoğu gerçek `public/index.html` veya dinamik TypeScript bileşenlerinde mevcut: araç paneli (`.utility-rail`), model ve sağlayıcı seçiciler, mesaj araçları, sidebar yardımcı işlemleri.

Bu çalışma doğrudan geçmiş commitleri geri almaz ve mevcut Claude/ChatGPT/GitHub App katkılarını yeniden yazmaz. Yalnızca görünüm kurallarını iki seçenek altında toplar.

## Yapılan değişiklik
- **Gelişmiş görünüm (varsayılan):** `data-hafize-layout="classic"`. Mevcut sidebar, model seçimi, gönderici araçları, mesaj işlemleri, takvim ve sesli asistan kartları yeniden görünür.
- **Sade görünüm (isteğe bağlı):** `data-hafize-layout="focused"`. Daha önceki minimal sohbet stilini korur.
- Üst çubukta erişilebilir `#layoutToggle` düğmesi vardır. Sadece tarayıcı `localStorage` alanındaki `hafize.ui-layout.v1` anahtarı değişir; sohbet ve bellek kayıtlarına dokunulmaz.
- `public/clean-ui.css` içindeki görünüm gizleme kuralları yalnız `focused` durumunda etkin. Karanlık tema, sticky header, güvenli sidebar overlay, yükseklik ve erişilebilirlik düzeltmeleri her iki görünümde korunur.
- Küçük ekranda görünüm düğmesinin uzun yazısı gizlenir, erişilebilir etiket korunur.
- `public/typed/ui-layout.test.ts` varsayılan tam görünümü, seçimi hatırlamayı, gizlilik modu durumunu ve ana HTML bileşenlerinin korunmasını kontrol eder.

## Teknik doğrulama
`npm run typecheck`, `npm run test:modern`, `npm run check:modern`, `npm run build`. GitHub Actions sonuçları PR üzerinden izlenmelidir. Fiziksel mobil cihazların ekran testi ve son düzenin gözle kontrolü ayrıca gerekir.

## Firebase durumuna ilişkin önemli ayrım
Canlı `https://hafize-ua.web.app/` için önceki teşhiste JS/CSS yollarının HTML döndüğü doğrulandı (PR #915). Bu, yayın/hosting tarafındaki ayrı bir engeldir. **Bu PR'ın kodunun geçmesi, canlı ekranda değiştiğini göstermez.** Önce gerçek Firebase Hosting yapılandırması ve önceki sürüm doğrulanmalı; kurtarma preview kanalında denenmeli. Hiçbir Firebase dağıtımı bu PR kapsamında gerçekleştirilmedi.

## PWA ilk açılış tutarlılığı
`theme-init.js` kaydedilmiş `focused` tercihini CSS yüklenmeden önce uygular; yeni kullanıcılar `classic` ile başlar. PWA önbellek sürümü `hafize-shell-v169` olarak yükseltildi, böylece yayın sonrası eski `clean-ui.css` dosyasının kullanılması önlenir. Bu işlem canlı Firebase yayını yapılmadan kullanıcı cihazındaki önbelleği değiştirmez.
