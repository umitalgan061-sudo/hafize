# Hafize GitHub App kimliği

Bu entegrasyon, Hafize'nin mevcut GitHub çalışma alanındaki **okuma**, **branch oluşturma**, **tek dosya commit'i** ve **pull request açma** akışlarını kısa süreli GitHub App installation token'larıyla çalıştırır.

## Kimlikler

- Uygulama: `Hafize-UmitAlgan`
- App ID: `5833389`
- Installation ID: `183684460`
- Uygulama sahibi: `umitalgan061-sudo`

Bu kimlikler tek başına gizli değildir. **Özel anahtar (.pem) ve installation token kesinlikle gizlidir.**

## Kurulum

1. GitHub App'i ilgili hesaba kur ve **Permissions & events** ayarlarında `Contents: Read & write`, `Pull requests: Read & write`, `Issues: Read & write` ve `Actions: Read-only` izinlerini doğrula.
2. GitHub uygulamasının **Credentials → Key pairs** bölümünden oluşturulan özel anahtarı sadece güvenli backend ortamında sakla. Dosyayı `public/` veya Git çalışma ağacına koyma; hiçbir GitHub commit'ine ekleme.
3. Backend sunucusuna aşağıdaki ortam değişkenlerini tanımla:

```dotenv
HAFIZE_GITHUB_APP_ID=5833389
HAFIZE_GITHUB_APP_INSTALLATION_ID=183684460
HAFIZE_GITHUB_APP_SLUG=hafize-umitalgan
HAFIZE_GITHUB_APP_PRIVATE_KEY_PATH=/secure/absolute/path/to/hafize-app.pem
HAFIZE_GITHUB_READ_REPOS=umitalgan061-sudo/hafize
HAFIZE_GITHUB_WRITE_REPOS=umitalgan061-sudo/hafize
```

Windows örneği: `HAFIZE_GITHUB_APP_PRIVATE_KEY_PATH=C:\\secure\\hafize-app.pem` (dosyanın gerçekten bulunduğu mutlak yolu kullan).

`GITHUB_TOKEN` eski kişisel erişim belirteci yöntemidir; **GitHub App'in üç değişkeni de verilirse App kimliği önceliklidir**. Bu üç değişkenden biri eksikse sunucu güvenli biçimde başlamaz ve kişisel token'a sessiz geri dönüş yapılmaz.

### Önemli: Firebase Hosting

Özel anahtar yalnızca sunucu tarafında bulunmalıdır. Sırf statik Firebase Hosting üzerinde çalışan `public/` arayüzünden GitHub App JWT oluşturulamaz. Sırrı backend'e güvenli iletmek için Firebase Functions/Cloud Run veya korumalı ayrı bir sunucu ve platform secret manager kullan. Özellikle özel anahtarı `VITE_*` değişkenine, `public/` dosyalarına, istemci JSON'una veya GitHub Actions loglarına yerleştirme.

## Windows üzerinde özel anahtarı yerleştirme

Özel anahtarı yalnızca **kendi bilgisayarında**, projenin dışında tut. PowerShell'de indirdiğin `.pem` dosyasını güvenli klasöre taşımak için (kendi indirdiğin gerçek dosya adını değiştir):

```powershell
$secretFolder = Join-Path $HOME ".hafize-secrets"
New-Item -ItemType Directory -Force -Path $secretFolder | Out-Null
Move-Item -LiteralPath "$HOME\Downloads\INDIRDIGIN-GITHUB-APP.pem" -Destination (Join-Path $secretFolder "hafize-github-app.pem")
```

Ardından Hafize backend'inin bulunduğu `.env` içinde `HAFIZE_GITHUB_APP_PRIVATE_KEY_PATH` değerini `C:\Users\<WindowsUser>\.hafize-secrets\hafize-github-app.pem` gibi **mutlak** bir yola ayarla. `.env` özel dosyadır; GitHub'a ekleme. Dağıtım ortamında bunun yerine platformun sunucu tarafı secret manager'ını kullan.

**Ön kontrol:** Yalnız kendi cihazındaki Hafize proje klasöründe, Node.js 24 veya üzeri ile çalıştır:

```powershell
node --use-system-ca --use-env-proxy --env-file=.env scripts/check-github-app.mjs
```

Node'da Windows sertifika deposunu ve tanımlanmış HTTPS proxy ayarlarını etkinleştirmek için `--use-system-ca --use-env-proxy` kullanılır. Şirket ağlarında `fetch failed` hatası görülürse Node ve PowerShell'in farklı sertifika/proxy ayarları kullanıp kullanmadığını kontrol et. SSL doğrulamasını kapatma.

Bu komut kimlik doğrulaması yapar, bot hesabını ve GitHub'dan depo okumasını doğrular; **commit, push, merge veya deploy yapmaz**. API anahtarlarını ve installation token'ı terminale yazdırmaz. Başarılı görünmeden üretim ortamında write izni açma.

## İlk gerçek Hafize bot commit'i ve taslak PR

**Ön şart:** `scripts/check-github-app.mjs` çıktısında `GitHub App authentication: OK` ve doğru `[bot]` login'i görülmüş olmalıdır. Bu aşama yalnızca uygulama sahibinin açık onayıyla gerçekleştirilir.

Önce işlem yapmayan önizlemeyi çalıştır:

```powershell
node --use-system-ca --use-env-proxy scripts/prove-github-app-bot.mjs
```

Bu komut GitHub'dan yalnız okuma yapar, test dalını ve izin durumunu gösterir. **Write işlemi için ayrı bir açık onay parametresi gereklidir**:

```powershell
node --use-system-ca --use-env-proxy scripts/prove-github-app-bot.mjs --confirm-create-draft-pr
```

Onaylı komut şunları yapar:

1. Sadece `umitalgan061-sudo/hafize` deposunda `main`'in güncel SHA'sından **yeni rastgele adlandırılmış** `hafize/auto-github-bot-proof-*` dalını oluşturur.
2. Sadece yeni dalda `docs/GITHUB_APP_BOT_PROOF.md` dosyasını, GitHub'dan doğrulanan `hafize-umitalgan[bot]` yazarı/committer bilgisiyle ekler.
3. Commit'in GitHub API'den geri okunan yazar ve committer e-postalarını doğrular.
4. **Draft PR** açar; `main` dalına doğrudan yazmaz, merge veya deploy yapmaz.

Script, kurulum anahtarını veya installation token'ı çıktılamaz. İşlem sırasında ağ/izin hatası olursa dal veya commit oluşturulmuş fakat PR açılmamış olabilir. Bu durumda komutu tekrarlamak yeni test dalı oluşturabilir; GitHub'daki yeni dalı incelemeden tekrar çalıştırma. Test PR'ını sırf Contributors sayısını artırmak için merge etme; doğrulama sonrası kapatabilirsin.

GitHub'ın Contributors görünümü yalnızca GitHub'ın gerçekten kabul ettiği katkı koşullarına göre güncellenir. Bot kimliğiyle taslak PR açılması, Contributors görünümüne hemen girme garantisi değildir.

## Nasıl çalışır?

- Sunucu `RS256` imzalı, kısa süreli bir uygulama JWT'si üretir.
- JWT yalnızca `POST /app/installations/{installation_id}/access_tokens` çağrısında kullanılır.
- GitHub'ın döndürdüğü installation token yalnızca bellekte tutulur; sona ermeden önce yenilenir.
- Eşzamanlı istekler tek token yenilemesini paylaşır.
- Commit author ve committer için uygulama slug'ına karşılık gelen `[bot]` hesabının numeric GitHub kullanıcı ID'si herkese açık kullanıcı API'sinden doğrulanır; bu istekte installation token gönderilmez.
- Installation token yalnızca `https://api.github.com/repos/...` adreslerine yönlendirilir.
- Mevcut `HAFIZE_GITHUB_READ_REPOS` ve `HAFIZE_GITHUB_WRITE_REPOS` izin listeleri geçerliliğini korur. GitHub App tüm depolara kurulmuş olsa bile **Hafize'nin backend'i yalnızca izin listelerindeki depolarda işlem yapabilir**.
- Mevcut yazma işlemlerinde açık onay, tek kullanımlık bilet, hassas dosya engeli ve `main` üzerine doğrudan yazma yasağı devam eder.

## Bot kimliği ve Contributors

Installation token ile GitHub API üzerinden yapılan işlemler GitHub App botu olarak kaydedilebilir. Yeni dosya commit'lerinde bot yazarı/committer alanları doğrulanan GitHub `[bot]` hesabının noreply adresiyle eşlenir; uygun bot hesabı doğrulanamazsa commit güvenli biçimde durdurulur. GitHub'ın Contributors görünümü yalnızca gerçek, kabul edilen katkı kurallarını karşılayan commit'leri sayar: uygulama oluşturulması veya bir PR açılması tek başına Contributors görünümünü garanti etmez. Bu değişiklik mevcut Git geçmişini yeniden yazmaz.

## Doğrulama

```bash
npm run typecheck
npx vitest run lib/github-app-auth.test.ts lib/github-workspace-write.test.ts
```

Backend başlatıldıktan sonra özel anahtar/installation token göstermeden `/api/health` ile GitHub okuma/yazma yapılandırma bayraklarını kontrol et. Ardından yalnızca onaylı test dalında branch → commit → PR akışını dene. Kimlik doğrulaması çalışmadan canlı yayına alındığını veya botun Contributors'a eklendiğini iddia etme.

## Güvenlik ve geri alma

- GitHub OAuth **Client secret**, installation token akışı için gerekli değildir. Daha önce herhangi bir ekran görüntüsünde gösterilen client secret'ı GitHub'da döndür/iptal et.
- Özel anahtar açığa çıkarsa GitHub'da ilgili key pair'i iptal et ve yeni anahtarla sistemi yeniden kur.
- `HAFIZE_GITHUB_WRITE_REPOS` boş bırakılırsa yazma özellikleri kapalıdır.
- Tüm GitHub App ortam değişkenleri kaldırılırsa yalnızca açıkça tanımlanan `GITHUB_TOKEN` eski yöntemini kullanır.
- Gizli dosya ve tokenları loglama; ürün arayüzüne geçirme.
