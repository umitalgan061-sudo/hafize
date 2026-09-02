# Hafize kurulumu

Bu belge Hafize'yi sıfırdan çalışır hale getirmeyi anlatır. En kısa yol için yalnızca **Adım 1–3** yeterlidir; sohbet o noktada açılır. Diğer bölümler opsiyonel yeteneklerdir.

## Gereksinimler

- Node.js 22 veya üzeri (`node --version`)
- Bir NVIDIA NIM API anahtarı — <https://build.nvidia.com>

Bağımlılık kurulumu tek pakettir (`redis`) ve yalnızca çok örnekli çalıştırma için gerekir:

```bash
npm install
```

## Adım 1 — Depoyu al

```bash
git clone https://github.com/umitalgan061-sudo/hafize.git
cd hafize
```

## Adım 2 — NVIDIA anahtarını ortama koy

Anahtar **repoya yazılmaz**. Kabuk ortamına ver:

```bash
export NVIDIA_API_KEY="nvapi-..."
```

Kalıcı olsun istersen `~/.bashrc` veya `~/.zshrc` dosyana ekle. Bir barındırma platformunda çalıştırıyorsan platformun secret manager'ını kullan (Railway/Render/Fly.io "Environment Variables", Vercel "Environment Variables", Docker `--env-file`).

`.env.example` tüm değişkenlerin listesidir. Kopyalayıp `.env` yapabilirsin ama **`.env` dosyası commit edilmez** — `.gitignore` bunu engeller.

## Adım 3 — Çalıştır

```bash
npm start
```

Sunucu açılışta yapılandırma özetini yazar:

```
Hafize listening on http://127.0.0.1:4173
Hafize yapılandırma durumu:
  ✓ NVIDIA NIM sohbeti
  · Gmail / Canva connector kimliği
      kapalı — Gmail ve Canva bağlantıları kapalı kalır.
  ...
```

İşaretlerin anlamı:

| İşaret | Anlam |
| --- | --- |
| `✓` | Grup tam yapılandırılmış, özellik açık |
| `·` | Grup hiç yapılandırılmamış, özellik kapalı (sorun değil) |
| `!` | Grup **yarım** — bazı değişkenler var, bazıları yok |

`!` gördüğün her satır bir hatadır: ya grubu tamamla ya da grubun tamamını boş bırak.

Tarayıcıda <http://127.0.0.1:4173> adresini aç. Model listesi dolduysa sohbet hazırdır.

## Doğrulama

```bash
curl -s http://127.0.0.1:4173/api/health
```

`"nvidiaConfigured": true` görüyorsan sohbet çalışır durumdadır.

Testleri çalıştırmak için:

```bash
npm run check
```

## Opsiyonel — GitHub salt-okunur erişim

Ajanların bir depodan dosya okuyabilmesi için **iki değişken birden** gerekir:

```bash
export GITHUB_TOKEN="github_pat_..."
export HAFIZE_GITHUB_READ_REPOS="umitalgan061-sudo/hafize"
```

Token'a yalnızca dar, salt-okunur kapsam ver. İzin listesi boş bırakılırsa araç ajanlara hiç sunulmaz — bu bilinçli bir default-deny davranışıdır.

## Opsiyonel — Gmail / Canva connector'ları

Bu grup **hepsi ya da hiçbiri** kuralına tabidir. Kısmi bırakırsan sunucu açılışta durur ve hangi değişkenin eksik olduğunu söyler.

```bash
export HAFIZE_CONNECTOR_AUTH_TOKEN="$(openssl rand -hex 32)"
export HAFIZE_CONNECTOR_AUTH_SUBJECT="owner"
export HAFIZE_CONNECTOR_OWNER_KEY_B64="$(openssl rand -base64 32)"
export HAFIZE_OAUTH_TOKEN_STORAGE_DIR="$HOME/.hafize/tokens"
export HAFIZE_OAUTH_TOKEN_KEY_B64="$(openssl rand -base64 32)"
```

`HAFIZE_OAUTH_TOKEN_KEY_B64` şifreli token deposunun anahtarıdır. **Kaybedersen bağlı hesapların token'ları okunamaz hale gelir** ve yeniden yetkilendirme gerekir. Yedekle.

Gmail gönderimi ayrıca her çağrıda açık kullanıcı niyeti ve backend onayı ister; ayrıntı `docs/GMAIL_SEND_APPROVAL_CONTRACT.md` içinde.

## Opsiyonel — Zamanlanmış görevler

API'yi açmak için (hepsi ya da hiçbiri):

```bash
export HAFIZE_SCHEDULE_AUTH_TOKEN="$(openssl rand -hex 32)"
export HAFIZE_SCHEDULE_AUTH_SUBJECT="owner"
```

Görevlerin yeniden başlatmada hayatta kalması için kalıcı depo da gerekir (hepsi ya da hiçbiri):

```bash
export HAFIZE_SCHEDULE_STORAGE_FILE="$HOME/.hafize/schedules.enc"
export HAFIZE_SCHEDULE_STORAGE_KEY_BASE64="$(openssl rand -base64 32)"
```

Bunlar tanımlanmazsa görevler yalnızca bellekte tutulur.

Birden fazla sunucu örneği çalıştıracaksan aynı görevin iki kez yürütülmemesi için Redis kilidi gerekir:

```bash
export HAFIZE_SCHEDULE_LEASE_PROVIDER="redis"
export HAFIZE_SCHEDULE_REDIS_URL="redis://127.0.0.1:6379"
```

## Opsiyonel — Şifreli kişisel bellek

Hepsi ya da hiçbiri:

```bash
export HAFIZE_MEMORY_STORAGE_DIR="$HOME/.hafize/memory"
export HAFIZE_MEMORY_KEY_B64="$(openssl rand -base64 32)"
```

## Güvenlik notları

- Hiçbir anahtar `public/`, istemci JavaScript'i, HTML veya manifest içine yazılmaz. Bunların hepsi tarayıcıya gider.
- `.env`, token ve private key dosyaları commit edilmez; `.gitignore` bunu engeller.
- Üretimde `HOST=0.0.0.0` yapacaksan sunucunun önüne TLS sonlandıran bir reverse proxy koy. Hafize kendi başına TLS sunmaz.
- Anahtar üretiminde `openssl rand` kullan; tahmin edilebilir değer verme.
- `*_KEY_B64` değişkenleri tam 32 baytlık base64 değer bekler (`openssl rand -base64 32`).

## Sorun giderme

**Model listesi "NVIDIA NIM bağlantısı bekleniyor" diyor.**
`NVIDIA_API_KEY` tanımlı değil ya da sunucu onu görmüyor. `curl -s http://127.0.0.1:4173/api/health` çıktısında `nvidiaConfigured` alanına bak. `export` komutunu `npm start` ile aynı kabukta çalıştırdığından emin ol.

**Sunucu "Hafize başlatılamadı — yapılandırma eksik" diyip kapanıyor.**
Yarım bırakılmış bir değişken grubu var. Mesaj hangi değişkenlerin eksik olduğunu tam olarak söyler; ya tamamla ya da grubun tamamını kaldır.

**Açılış özetinde `!` işareti görüyorum ama sunucu çalışıyor.**
O grup yarım ve özelliği sessizce kapalı. En sık görülen hâli: `GITHUB_TOKEN` tanımlı ama `HAFIZE_GITHUB_READ_REPOS` boş.

**`npm run check` başarısız.**
Çıktıdaki ilk başarısız betiği tek başına çalıştır (`node scripts/<ad>.mjs`). Testler ağ erişimi gerektirmez; başarısızlık gerçek bir regresyondur.
