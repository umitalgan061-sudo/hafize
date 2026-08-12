# NVIDIA NIM Gateway

Hafize, NVIDIA NIM ile tarayıcıdan doğrudan konuşmaz. API anahtarı yalnızca Node.js backend ortamında tutulur ve istemciye gönderilmez.

## Çalıştırma

Gerekli ortam değişkeni:

```bash
NVIDIA_API_KEY="nvapi-..." npm start
```

Windows PowerShell:

```powershell
$env:NVIDIA_API_KEY="nvapi-..."
npm start
```

Varsayılan backend adresi:

```text
https://integrate.api.nvidia.com/v1
```

İstenirse `NIM_BASE_URL` ile OpenAI-uyumlu başka bir NIM deployment adresi kullanılabilir.

## Hafize backend uçları

- `GET /api/health`: Backend durumunu ve NVIDIA anahtarının yapılandırılmış olup olmadığını yalnızca boolean olarak döndürür.
- `GET /api/models`: NVIDIA `GET /v1/models` sonucundaki model kimliklerini güvenli biçimde arayüze aktarır.
- `POST /api/chat`: Mesajları doğrular, NVIDIA `POST /v1/chat/completions` isteğini `stream: true` ile server-side gönderir ve SSE akışını istemciye geçirir.

## Güvenlik sınırı

- İstemci hiçbir endpoint'e API anahtarı göndermez.
- Backend istemciden gelen NVIDIA Authorization header'ını kullanmaz; kendi `NVIDIA_API_KEY` değerini ekler.
- İstemci yalnızca model, mesajlar ve sınırlı üretim parametrelerini gönderebilir.
- Bu sürüm tool tanımlarını istemciden NVIDIA'ya forward etmez. Tool-calling, `agents/registry.json` izinleri backend tarafından uygulanmaya başladıktan sonra ayrı bir geliştirme olarak eklenecektir.
- Secret değerleri loglanmaz ve `/api/health` yalnızca yapılandırma durumunu döndürür.
- Harici yazma/gönderme/merge işlemleri bu gateway'in kapsamı değildir.

## Test yaklaşımı

Gateway gerçek API anahtarı olmadan da yerel mock NVIDIA upstream ile test edilebilir. Model listeleme ve SSE proxy davranışı bu şekilde doğrulanır; gerçek NVIDIA çağrısı kullanıcı anahtarıyla çalışma ortamında yapılır.
