# Hafize'yi **Free** planda çalıştırma (Render)

Bu seçenek **Google Cloud Run, Cloud Build, Cloud Billing ve Firebase Blaze** açmaz.
Var olan Firebase Hosting sitesi `https://hafize-ua.web.app/` korunur.
Render'da ise hem Hafize arayüzü hem de Node API aynı `onrender.com`
adresinden sunulur. İki farklı alan arasında güvenlik/CORS ve cookie
sorunlarına yol açmamak için mevcut Firebase sitenin `/api/**` rotalarını
otomatik olarak Render'a çevirmiyoruz.

## Adımlar

1. [Render Dashboard](https://dashboard.render.com/) üzerinden hesap aç/giriş yap.
2. **New → Blueprint** seç; GitHub'da
   `umitalgan061-sudo/hafize` deposunu bağla. Kök `render.yaml` otomatik
   algılanmalı.
3. Servisin `plan: free` olduğunu kontrol et. **Ücretli instance,
   persistent disk, Postgres veya plan yükseltmesi seçme.** Blueprint tek
   `web` servisi tanımlar; `region: frankfurt`.
4. `NVIDIA_API_KEY` için NVIDIA anahtarını **Render ortam değişkenleri**
   ekranına güvenli biçimde gir. Bu değeri GitHub kodlarına veya sohbete koyma.
   `HAFIZE_AUTH_TOKEN` ve `HAFIZE_MASTER_KEY` Render tarafından birbirinden
   bağımsız olarak birer kez oluşturulur (`generateValue: true`).
   GitHub Secrets'taki aynı isimli veya kısa adlarla tanımladığın anahtarlar
   **Render'a otomatik aktarılmaz**. Mevcut anahtarlarını kullanmak istiyorsan
   Render Dashboard → Environment bölümünde **bu Render değerlerini**
   ilgili anahtarlarla ayrı ayrı değiştir.
5. Oluşturulan servisin Render URL'sini (örn. `https://hafize-free.onrender.com`)
   aç. Kendi servisine verilen gerçek adresi kullan; örnek URL garanti değildir.
   `/api/health/live` HTTP 200 ve `{"status":"ok"}` ile yanıt vermelidir.
   `/api/models` gibi kullanıcı verisi içeren uç noktalar giriş yapılmadan
   HTTP 401 döndürmelidir. Render Dashboard'da
   `HAFIZE_AUTH_TOKEN` değerini görüntüleyip Hafize'nin giriş formunda kullan.
6. Artık tam Hafize deneyimi Render URL'si üzerinden çalışır; Firebase URL'si
   eski statik site olarak kalır. Hiçbir zaman test edilmemiş backend'e
   otomatik trafik yönlendirmeyiz. Başlangıçta otomatik Render redeploy
   `off` durumundadır; GitHub kod değişikliklerinde Render panelinden
   manuel deploy yapılır.

## Ücretsiz planın önemli sınırları

- Render Free hizmeti yaklaşık **15 dakika gelen trafik olmadan uyur**;
  yeniden açılması bir dakika civarında sürebilir. 7/24 çalışan ve her
  zaman hızlı cevap veren bir arka plan ajanı için uygun değildir.
- Yerel `/tmp/hafize-data` içindeki **SQLite veritabanı, hafıza,
  görseller ve görev geçmişi kalıcı değildir**. Uyuma, redeploy veya yeniden
  başlatma bunları silebilir. Bu seçenek **deneme/prototip** içindir.
- Render'ın Free kullanımında aylık saat, bant genişliği ve build
  kotaları geçerlidir; karta bağlı ücretlendirme olabilir. Render
  Billing'de **harcama limitini ayarla** ve ek ücretli kaynak açma.
- Free planın 512 MB RAM sınırı nedeniyle büyük konuşma/işlem
  yükünde servis belleğe sığmayabilir. Docker'ın CI'da açılması, bu
  planın her yükte yeterli olacağını garanti etmez.
- Sunucu kimlik doğrulaması zorunludur. `HAFIZE_AUTH_REQUIRED=false`
  yapma. Kodda GitHub yazma yeteneği bulunsa bile Render'da
  GitHub App private key ve izinleri **ayrı yapılandırılmadan**
  Hafize'nin kendi kendine GitHub'a yazması çalışmaz.
- GitHub üzerindeki `AUTH_TOKEN`/`MASTER_KEY` secrets'larının
  tek başına oluşturulması, ne Render deploy'unu başlatır ne de
  GitHub Secret değerlerini Render'a geçirir.

## Teknik doğrulama ve belgeler

- Render Blueprint: `render.yaml`, Docker başlangıcı: `Dockerfile`.
- [Render Free sınırlamaları](https://render.com/docs/free)
- [Render Blueprint söz dizimi](https://render.com/docs/blueprint-spec)
- [Render ortam değişkenleri](https://render.com/docs/configure-environment-variables)
- [Hafize Cloud Run alternatifi](HAFIZE_CLOUD_RUN_BACKEND.md): ücret ve
  Google Cloud kaynakları gerektirebileceği için **bu Free kurulumunda kullanılmaz**.
