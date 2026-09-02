# Hafize

Hafize, NVIDIA NIM modelleri üzerinde çalışan kişisel bir yapay zekâ çalışma alanıdır: Claude-benzeri sade bir sohbet arayüzü, streaming ve tool-calling, bulutta yürüyen zamanlanmış ajan görevleri, PWA kurulumu, sesli giriş/çıkış ve kullanıcı izniyle açılan GitHub / Gmail / Canva bağlantıları.

## Hızlı başlangıç

```bash
git clone https://github.com/umitalgan061-sudo/hafize.git
cd hafize
export NVIDIA_API_KEY="nvapi-..."   # https://build.nvidia.com
npm start
```

Ardından <http://127.0.0.1:4173> adresini aç.

Sunucu her açılışta hangi özelliğin açık, hangisinin kapalı ve hangisinin yarım yapılandırıldığını yazar. Ayrıntılı kurulum ve tüm ortam değişkenleri için **[docs/KURULUM.md](docs/KURULUM.md)**, değişken listesi için `.env.example`.

> `NVIDIA_API_KEY` olmadan arayüz açılır ama sohbet çalışmaz. Anahtar hiçbir zaman repoya yazılmaz.

## Durum

| Alan | Durum |
| --- | --- |
| NIM sohbeti, streaming, context sıkıştırma, tool-calling | çalışıyor |
| Ajan kaydı, delegasyon, task ledger | çalışıyor |
| Zamanlanmış görevler (API, şifreli depo, Redis lease) | çalışıyor, yapılandırma gerektirir |
| PWA / service worker / çevrimdışı kabuk | çalışıyor |
| Gmail okuma + onaylı gönderme, Canva okuma | çalışıyor, yapılandırma gerektirir |
| GitHub salt-okunur dosya erişimi | çalışıyor, yapılandırma gerektirir |
| Sesli giriş/çıkış modülleri | modüller hazır, ana arayüze bağlanmadı |
| GitHub yazma (branch / commit / PR) ajanı | yalnızca sözleşme; yürütme yolu yok |
| Skills registry | henüz yok |
| Electron masaüstü uygulaması | henüz yok |

## Geliştirme

```bash
npm run check      # tüm statik ve smoke testler
npm run precheck   # yalnızca istemci modülleri
```

Depo, testsiz davranış değişikliği kabul etmez. Geliştirme kuralları ve tur bütçesi `HAFIZE_RULES.md` içindedir; mimari kararlar `docs/` altındadır.

## Güvenlik

API anahtarları ve OAuth secret'ları yalnızca backend ortam değişkenlerinde veya platform secret manager'ında tutulur; `public/`, istemci JavaScript'i, HTML veya manifest içine hiçbir zaman yazılmaz. Araç yetkilendirmesi backend tarafında default-deny modeliyle çalışır ve dış servislerde yazma işlemleri açık kullanıcı onayı gerektirir.

Ayrıntılar: `docs/OAUTH_SECURITY_BOUNDARY.md`, `docs/GMAIL_SEND_APPROVAL_CONTRACT.md`, `docs/NULL_ARGUMENT_BOUNDARY.md`.
