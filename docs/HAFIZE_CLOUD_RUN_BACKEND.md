# Hafize canlı backend — Cloud Run kurulum rehberi

Bu çalışma alanında Hafize arayüzü Firebase Hosting (`hafize-ua.web.app`)
üzerinden, sunucu ise `projelerim-8fecd` projesinde Cloud Run
`hafize-backend` (`europe-west1`) üzerinden yayınlanır.

## Gerçek denetim (23 Kasım 2026)

GitHub Actions ile yapılan **salt-okunur** denetimde mevcut Firebase
servis hesabı Google Cloud'a giriş yapabildi. Ancak Cloud Run, Cloud Build ve
Artifact Registry API'leri etkin değildi; kontrol edilen bölgelerdeki
`hafize-backend` servisi de görüntülenemedi (yok veya `run.services.get`
yetkisi bulunmuyor). Aşağıdaki üç yeni backend secret'ı eksikti.

[Google Cloud denetim kaydı](https://github.com/umitalgan061-sudo/hafize/actions/runs/45131318409)

## Bir kez yapılacaklar

1. Google Cloud Console'da `projelerim-8fecd` projesini seç. Cloud Run için
   **faturalandırma bağlantısı** gerekiyorsa etkinleştir; kullanım ücretli
   olabilir. API'ler: `run.googleapis.com`, `cloudbuild.googleapis.com`,
   `artifactregistry.googleapis.com`. Yayın iş akışı izin varsa bunları
   etkinleştirmeyi dener.
2. GitHub → **Settings → Secrets and variables → Actions** ekranında
   **Repository secrets** olarak aşağıdaki değerleri oluştur. Değerleri
   bu sohbete gönderme ve kod deposuna commit etme.
   - `HAFIZE_CLOUD_RUN_AUTH_TOKEN`: Hafize giriş şifresi olacak rastgele,
     en az 32 karakterlik gizli token (örn. `node -e
     "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`).
   - `HAFIZE_CLOUD_RUN_MASTER_KEY`: **ayrı** üretilmiş 32 baytlık
     anahtarın 64 basamaklı hex veya base64 biçimi. Kimlik doğrulama
     token'ını bu anahtar yerine kullanma.
   - `HAFIZE_CLOUD_RUN_NVIDIA_API_KEY`: Hafize'nin kullandığı NVIDIA
     NIM API anahtarı.
   - İsteğe bağlı ama önerilen `HAFIZE_CLOUD_RUN_DEPLOYER`:
     yalnızca `projelerim-8fecd` projesine Cloud Run kaynak dağıtımı
     yapabilen ayrı servis hesabının JSON anahtarı. Yoksa iş akışı
     **mevcut** `FIREBASE_SERVICE_ACCOUNT_HAFIZE_UA` hesabını dener;
     bu hesabın Firebase Hosting yetkisi Cloud Run için yeterli olmayabilir.
3. Cloud Run source deployment için deploy hesabına
   `roles/run.sourceDeveloper`, `roles/serviceusage.serviceUsageConsumer`,
   hedef çalışma kimliği üzerinde `roles/iam.serviceAccountUser` gerekir.
   API'leri etkinleştirecek hesap ayrıca
   `serviceusage.services.enable` yetkisine sahip olmalıdır. Google Cloud
   Build çalışma hesabının `roles/run.builder` izni de gerekebilir.
   İzinleri mümkün olan en dar kaynaklara ve yetkilere sınırla.
4. GitHub → **Actions → Hafize Cloud Run backend — deploy and connect →
   Run workflow** ekranında **main** dalını seçerek başlat. İş akışı:
   gizli ayarları doğrular, Cloud Run'a maksimum **1 örnek**
   (minimum 0) ile yayınlar, gerçek backend sağlık ve yetki denetimi
   yapar; ancak ondan sonra Firebase Hosting'deki `/api/**`
   yolunu yeni servise yönlendirip tekrar test eder.
5. Backend gerçekten çalıştığında
   `config/hafize-cloud-backend-live.json` etkinleştirme işareti
   GitHub'a kaydedilir. Ana dala doğrudan yazma koruması varsa
   iş akışı bunun için PR açar. **PR birleştirilmeden** sonraki
   otomatik Hosting yayınlarında API yönlendirmesi korunmayabilir.

## Güvenlik ve sınırlamalar

- Docker imajına `.env`, PEM anahtarları, GitHub Actions geçici
  Google kimlik bilgileri ve yerel Hafize veritabanı girmez.
- Cloud Run HTTP portunu `0.0.0.0:8080` üzerinden dinler.
  API işlemleri Hafize'nin oturum / CSRF korumasına tabidir.
  Cloud Run dışarıya sağlık testi için ulaşılabilirdir; kullanıcı verisi
  içeren uç noktalar oturum gerektirir.
- Cloud Run'un ölçeği `min-instances=0`, `max-instances=1`
  ile sınırlandırılır; ücretsiz olacağı garanti değildir.
- **Çok önemli:** İlk Cloud Run aşamasında Hafize'nin SQLite
  `/tmp/hafize-data` verileri **kalıcı değildir**. Sunucu yeniden
  başlatılırsa hafıza/kayıtlar kaybolabilir. Kalıcı kullanıcı verisi
  taşınmadan bu dağıtım üretim verisi için güvenli bir depolama
  çözümü değildir. Cloud SQL/PostgreSQL veya uygun kalıcı veri
  katmanı ayrıca planlanmalıdır.
- Firebase Hosting, Cloud Run üzerinden iletilen isteklerde yaklaşık
  60 saniyelik timeout uygular. Uzun görevler için ayrı kuyruk ve
  arka plan işlemcisi gerekir.
- **Hafize GitHub App otomasyonu:** Cloud Run'a bağlanmak,
  GitHub App'in private key'ini veya Actions yazma iznini kendiliğinden
  kurmaz. Bunlar ayrıca sunucu tarafında ayarlanmalıdır. Tarayıcıya
  GitHub token/PEM anahtarı verilmemelidir.

## Doğrulama

- Konteynerin açılması ve üretim auth kontrolü:
  [Cloud Run Docker smoke test](https://github.com/umitalgan061-sudo/hafize/actions/runs/45131525196)
- Firebase Hosting backend testi:
  `https://hafize-ua.web.app/api/health/live` → JSON
  `{"status":"ok",...}` dönmelidir. HTML veya statik SPA yanıtı
  bir backend sağlığı kanıtı değildir.
- GitHub'da Firebase Hosting yayınından sonra
  `/api/health/live` testinin de geçmesi gerekir; yalnız
  `release.json` kontrolü backend kanıtı değildir.

Google resmi kaynaklar: Cloud Run kaynak dağıtımı
https://docs.cloud.google.com/run/docs/deploying-source-code
Firebase Hosting / Cloud Run entegrasyonu
https://firebase.google.com/docs/hosting/cloud-run
