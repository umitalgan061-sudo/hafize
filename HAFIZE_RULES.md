# Hafize — Sürekli Geliştirme Kuralları

Bu depo yalnızca **Hafize** yapay zeka uygulaması içindir.

## Ana hedef

Claude-benzeri sade bir sohbet deneyimi üzerinde çalışan; NVIDIA NIM modellerini seçebilen, streaming ve tool-calling destekleyen, zamanlanmış görevleri uygulama kapalıyken de bulutta yürütebilen, PWA ve masaüstü olarak kurulabilen, sesli kullanılabilen ve kullanıcı izniyle GitHub / Google / Gmail / Canva gibi servislerle bağlanabilen güvenli bir kişisel yapay zeka çalışma alanı geliştirmek.

## Her geliştirme turunda zorunlu akış

1. Önce bu dosyayı ve `README.md` dosyasını oku.
2. Mevcut kodu incele; yapılmış işi yeniden yapma.
2b. **Açık PR listesini kontrol et.** Aynı konuyu ele alan açık bir PR varsa yeni bir kopya PR açma; ya o PR'ı ilerlet ya da başka bir ana iyileştirme seç. Zamanlanmış turlar birbirinden habersiz çalıştığı için bu adım atlanırsa aynı özellik defalarca yeniden yazılır.
2c. **`npm run check` kapısını turun başında çalıştır.** `main` kırmızıysa yeni özellik eklemeden önce kapıyı onarmak önceliklidir; kırık kapı sonraki tüm turların doğrulamasını geçersiz kılar.
3. Her turda küçük, ölçülebilir, geri alınabilir ve test edilebilir tek bir ana iyileştirme seç; aynı ana iyileştirme içindeki ilişkili alt adımlarla tur bütçesi elverdiği sürece ilerlemeye devam et.
4. Mevcut işlevleri gereksiz yere silme veya yeniden yazma.
5. Değişikliği ayrı bir `hafize/auto-*` branch'inde yap.
6. Uygun statik/syntax/smoke testlerini çalıştır.
7. Sonucu Pull Request olarak hazırla.
8. Self-development değişikliklerini doğrudan `main` üzerine merge etme.
9. Test başarısızsa bunu saklama; PR açıklamasında açıkça belirt.

## Tur değişiklik bütçesi — 500 satır

- Her self-development turunun **toplam Git diff bütçesi en fazla 500 satırdır**. Ölçüm, turun başladığı base commit/branch ile turun ulaştığı en son stacked head arasındaki `additions + deletions` toplamıdır; bir API aracının tam dosyayı yeniden göndermesi tek başına kota tüketimi sayılmaz.
- Güvenli ve anlamlı iş kaldığı sürece tur erken bitirilmez. Amaç, gereksiz değişiklik üretmeden 500 satırlık bütçeye mümkün olduğunca yaklaşmaktır; pratik hedef yaklaşık **400–500 değişen satır** aralığıdır.
- Bir ana iyileştirme tamamlanıp kendi tek-amaçlı PR'ı hazırlandığında toplam tur bütçesi hâlâ uygunsa kullanıcıdan yeni `devam et` komutu beklenmez; o PR'ın head'i üzerine yeni stacked branch açılarak sıradaki güvenli ve anlamlı ana iyileştirmeye geçilir.
- Yeni bir alt adım veya yeni stacked PR 500 satır toplam tur sınırını aşacaksa mevcut tura alınmaz; sonraki tura bırakılır.
- Her anlamlı alt adımdan ve her yeni stacked PR'dan sonra ilk tur base'i→güncel head diff'i yeniden ölçülür ve kalan satır bütçesi dikkate alınır.
- Sırf kotayı doldurmak için yapay refactor, yorum şişirme, tekrarlı test, gereksiz dosya üretme veya davranışsız kod değişikliği yapılmaz.
- Güvenlik sınırları, test/DoD gereksinimleri, tek-amaçlı PR kapsamı, kullanıcı onayı gerektiren işlemler ve veri kaybı riski satır kotasından daha yüksek önceliklidir. Güvenli ve anlamlı iş kalmazsa tur 400 satıra ulaşmadan da durabilir; neden son PR açıklamasında açıkça belirtilir.
- Kota yaklaşımı commit sayısını zorlamaz; küçük ve geri alınabilir commitler tercih edilir. Tek bir PR'ın kendi diff'i de 500 satırı geçemez.

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
- En az yetki (least privilege) ve dar OAuth scope tercih edilir.
- Ajanın kendi yetkisini yükseltmesine izin verilmez.
- Self-development ajanı `.github/workflows/` üzerinde otomatik değişiklik yapmaz; workflow değişikliği ayrı ve açık inceleme gerektirir.
- Repo silme, secret görüntüleme veya korumaları devre dışı bırakma ajan aracı olarak sunulmaz.

## Kalite kuralları

- Masaüstü, mobil ve PWA davranışları birlikte düşünülür.
- Gereksiz bağımlılık eklenmez.
- Aynı işlev için paralel/tekrarlı sistemler oluşturulmaz.
- Hata yoksa sırf değişiklik yapmak için kod değiştirilmez.
- Yeni davranış mümkünse test veya doğrulama adımıyla birlikte gelir.
- Performans, erişilebilirlik ve güvenlik regresyonları yeni özelliklerden daha yüksek önceliklidir.

## Sürüm yaklaşımı

Büyük sıçramalar yerine küçük PR'lar tercih edilir. Her PR açıklamasında şu dört bilgi bulunur:

- Ne değişti?
- Neden gerekliydi?
- Nasıl test edildi?
- Geri alma yolu nedir?
