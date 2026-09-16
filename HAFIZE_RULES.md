# Hafize — Sürekli Geliştirme Kuralları

Bu depo yalnızca **Hafize** yapay zeka uygulaması içindir.

## Ana hedef

Claude-benzeri sade bir sohbet deneyimi üzerinde çalışan; NVIDIA NIM modellerini seçebilen, streaming ve tool-calling destekleyen, zamanlanmış görevleri uygulama kapalıyken de bulutta yürütebilen, PWA ve masaüstü olarak kurulabilen, sesli kullanılabilen ve kullanıcı izniyle GitHub / Google / Gmail / Canva gibi servislerle bağlanabilen güvenli bir kişisel yapay zeka çalışma alanı geliştirmek.

## Her geliştirme turunda zorunlu akış

1. Önce bu dosyayı ve `README.md` dosyasını oku.
2. Mevcut kodu incele; yapılmış işi yeniden yapma.
3. Her turda tek bir ana iyileştirme seç; aynı ana iyileştirmenin ilişkili, ölçülebilir ve test edilebilir alt adımları iş paketi tamamlanana kadar bütçe içinde tamamlanabilir.
4. Mevcut işlevleri gereksiz yere silme veya yeniden yazma.
5. Değişikliği ayrı bir `hafize/auto-*` branch'inde yap.
6. Uygun statik/syntax/smoke testlerini çalıştır.
7. Sonucu Pull Request olarak hazırla.
8. Self-development değişikliklerini doğrudan `main` üzerine merge etme.
9. Test başarısızsa bunu saklama; PR açıklamasında açıkça belirt.

## Tur tamamlama kriteri — 3000+ anlamlı değişiklik

- Normal koşullarda bir self-development turu **3000 değişen satırı geçmeden kapatılmaz**. Ölçüm turun başlangıç base commit'i ile son stacked head arasındaki Git diff'teki `additions + deletions` toplamıdır.
- Hedef yalnızca 3000'e dokunmak değildir; iş paketinin gerektirdiği **3000'den fazla anlamlı değişiklik ve/veya ekleme** tamamlanmalıdır.
- Diff 3000'in altındaysa ve repository içinde aynı iş paketine ait gerçek, yüksek öncelikli işler kaldıysa araştırmaya ve uygulamaya devam edilir.
- **3000 satıra ulaşılması otomatik durma sinyali değildir.** 3000 sonrasında da iş paketi tamamlanana, ilgili testler/DoD karşılanana ve yüksek öncelikli anlamlı işler bitene kadar devam edilir.
- İkinci veya sonraki ilişkili alt adımlar aynı ana iyileştirmenin kapsamında olduğu sürece tur içinde sürdürülebilir; her önemli alt adımdan sonra base→head diff yeniden ölçülür.
- 3000+ hedefi hiçbir şekilde yapay satır doldurma gerekçesi değildir. Gereksiz boilerplate, kopya kod, tekrarlı test, anlamsız yorum, davranışsız refactor veya sırf sayı artırmak için üretilen dokümantasyon yasaktır.
- 3000'e ulaşmadan önce anlamlı iş kalmamışsa tur yalnızca istisnai olarak daha erken kapanabilir; PR açıklamasında neden açıkça belirtilmelidir.
- Güvenlik, veri kaybını önleme, test/DoD ve kullanıcı onayı gereksinimleri her zaman değişiklik hacmi hedefinden daha yüksek önceliklidir.
- Tek PR'ın diff'i için ayrı bir yapay satır kotası uygulanmaz; ancak GitHub/araç sınırları, inceleme yapılabilirliği, güvenlik ve değişikliğin bütünlüğü korunur.

## Öncelik sırası

1. Claude-benzeri sohbet arayüzü ve kaliteli mobil/masaüstü UX.
2. NVIDIA NIM model seçimi, streaming, context ve tool-calling.
3. Bulutta 7×24 çalışan zamanlanmış agent görevleri.
4. PWA kurulumu ve Electron masaüstü uygulaması.
5. Sesli giriş/çıkış ve erişilebilirlik.
6. GitHub branch / commit / PR ajanı.
7. Google / Gmail OAuth araçları.
8. Canva Connect OAuth + PKCE araçları.
9. Genel connector / skills mimarisi.
10. Cloud authentication, secret yönetimi, gözlemlenebilirlik ve güvenlik sertleştirmesi.

## Güvenlik kuralları

- NVIDIA, GitHub, Google, Canva ve diğer API anahtarları / OAuth secret'ları hiçbir zaman `public/`, istemci JavaScript'i, HTML, manifest veya repoya commit edilmez.
- Secret'lar backend ortam değişkenleri, platform secret manager veya şifreli server-side store üzerinden kullanılır.
- `.env`, token, credential, private key ve benzeri hassas dosyalar self-development ajanı tarafından değiştirilmez veya commit edilmez.
- Dış servislerde yazma/silme işlemleri için açık kullanıcı yetkisi gerekir.
- En az yetki ve dar OAuth scope tercih edilir.
- Ajanın kendi yetkisini yükseltmesine izin verilmez.
- Self-development ajanı `.github/workflows/` üzerinde otomatik değişiklik yapmaz.
- Repo silme, secret görüntüleme veya korumaları devre dışı bırakma ajan aracı olarak sunulmaz.

## Kalite kuralları

- Masaüstü, mobil ve PWA davranışları birlikte düşünülür.
- Gereksiz bağımlılık eklenmez.
- Aynı işlev için paralel/tekrarlı sistemler oluşturulmaz.
- Hata yoksa sırf değişiklik yapmak için kod değiştirilmez.
- Yeni davranış mümkünse test veya doğrulama adımıyla birlikte gelir.
- Performans, erişilebilirlik ve güvenlik regresyonları yeni özelliklerden daha yüksek önceliklidir.

## Sürüm yaklaşımı

Büyük sıçramalar yerine, iş paketini uçtan uca tamamlayan ve doğrulanabilir PR'lar tercih edilir. Her PR açıklamasında ne değiştiği, neden gerekli olduğu, nasıl test edildiği ve geri alma yolu açıkça yazılır.
