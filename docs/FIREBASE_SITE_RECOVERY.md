# Hafize — Firebase Hosting canlı site kurtarma planı

## Gerçek bulgu — 20 Kasım 2026

GitHub Actions read-only canlı tanılama: https://github.com/umitalgan061-sudo/hafize/actions/runs/44693123908

- / adresi HTTP 200 ve Hafize HTML içeriğiyle yanıt veriyor.
- CSS ve JavaScript adreslerinin birçoğu HTTP 200 döndürmesine rağmen uygun MIME türünde değil. Tarayıcı bu modülleri/biçimleri yükleyemeyebilir.
- /api/health HTTP 200 döndürüyor, fakat JSON değil. Bu, geçerli bir Hafize backend sağlığı yanıtı değildir.
- Depoda bu çalışmadan önce Firebase Hosting konfigürasyonu veya otomatik Firebase deploy workflow'u yoktu.
- Yerel Node.js backend'in statik Firebase Hosting'e kendiliğinden bağlanmadığı README'de de belgeleniyor.
- Claude Desktop'ın kesin neden olduğu kanıtlanmış değildir. Bu doküman önce yayını düzeltmeyi hedefler.

## Acil ve en güvenli yol

1. Firebase Console > Hosting'e girerek gerçek Firebase PROJE ID'sini, site ID'sini, mevcut release ID'sini ve önceki çalışan sürümün tarihini kontrol et.
2. **En son sağlıklı sürüm** belirlenebiliyorsa Firebase Hosting > Release history içinde, kullanıcı onayıyla **Rollback** yap. Git commit geçmişini değiştirme.
3. Rollback sonrasında canlı HTML, CSS, JS, /api/health ve uygulama login/chat özelliklerini yeniden doğrula.
4. Eğer önceki sağlıklı sürüm yoksa, bu PR'ın sunduğu **preview** yapılandırmasını önce Firebase test kanalında dene.

## Preview — üretim dağıtımı değildir

`firebase.recovery.json`, ayrı bir statik Hosting preview adayıdır; varsayılan firebase.json dosyasını ya da çalışan hosting ayarlarını kendiliğinden değiştirmez.

- Hosting `public` kökünü kullanır. Vite'ın derlediği JavaScript dosyaları `public/typed-build` altındadır.
- Bilinmeyen `** -> /index.html` yönlendirmesi yoktur: statik JS/CSS dosyaları eksikse HTML 200 yerine doğru hata görülebilir.
- Gizli dosyalar, geliştirme TypeScript'i ve sourcemap'ler yükleme dışı kalır.
- Backend Cloud Run/Functions hedefi bilinmediğinden **API rewrite eklenmedi**. Statik arayüzün onarılması, NVIDIA sohbet API'sinin de çalışacağını kanıtlamaz.

Gerçek proje ID doğrulanıp Firebase CLI ile yetkilendirildikten sonra, kullanıcı tarafından çalıştırılabilecek komutlar:

```bash
npm install --no-audit --no-fund
npm run build
node scripts/site-release-health.mjs --local
npx firebase-tools hosting:channel:deploy hafize-kurtarma --project GERCEK_PROJE_ID --config firebase.recovery.json
```

Preview URL'de görsel arayüz, mobil navigasyon ve dosya MIME türleri doğrulanmadan canlı sürüm değiştirilmemelidir. API altyapısı ayrıca kurulmalı veya mevcut backend için yetkili rewrite yapılandırılmalıdır.

## Tekrarlanmaması için koruma

- CI sonrasında `node scripts/site-release-health.mjs --local` tüm referans verilen yerel varlıkları kontrol eder.
- `node scripts/site-release-health.mjs --live https://hafize-ua.web.app/` erişilebilirlik, statik dosyalar ve JSON API'yi ayrı raporlar.
- Sadece başarılı GitHub Actions durumuna bakarak canlıya çıktı demeyin.
- Tarayıcı PWA service worker önbelleği eski sürümü gösterebilir. Yerel sohbet verilerini korumak için rastgele Site Data temizleme işlemi yapılmamalıdır.
- Firebase'in resmî rollback kılavuzu: https://firebase.google.com/docs/hosting/manage-hosting-resources
- Preview kılavuzu: https://firebase.google.com/docs/hosting/test-preview-deploy

Bu dosyalar yalnız GitHub'a gönderildi; Firebase üretim ortamına hiçbir değişiklik yapılmadı.
