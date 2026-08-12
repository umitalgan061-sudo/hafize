# Şifreli schedule dosya adapteri

Bu adapter, `task-schedule-persistence` katmanının `load()` / `save(envelope)` sözleşmesine uyan küçük bir server-side durable storage seçeneğidir.

## Güvenlik modeli

- İçerik AES-256-GCM ile şifrelenir ve doğrulanır.
- Her `save()` için yeni 12-byte IV üretilir.
- Authentication tag 16 byte'tır; yanlış anahtar veya değiştirilmiş ciphertext load sırasında reddedilir.
- Diskte yalnızca `version`, `algorithm`, `iv`, `tag`, `ciphertext` alanları bulunur. Schedule task, owner, trace veya ID düz metin olarak yazılmaz.
- Hedef dosya `0600`, oluşturulan dizin `0700` izniyle hazırlanır.
- Yazım aynı dizindeki geçici dosyaya yapılır, `fsync` sonrası `rename` ile hedefe taşınır; başarısızlıkta geçici dosya temizlenmeye çalışılır.
- Maksimum encrypted dosya boyutu varsayılan 4 MiB'dir ve 64 MiB üzerinde yapılandırılamaz.

## Anahtar sözleşmesi

`createEncryptedFileScheduleAdapter({ filePath, key })` tam 32-byte `Buffer` veya `Uint8Array` anahtar ister. Anahtar repo içine, istemci JavaScript'ine veya schedule payload'ına yazılmamalıdır. İleride server wiring yapılırken anahtar yalnızca secret manager / environment üzerinden decode edilip Buffer olarak verilmelidir.

## Kullanım sınırı

Bu PR adapter'ı `server.mjs` içine bağlamaz. Böylece secret adı, persistence dosya yolu, cloud disk modeli ve async worker/HTTP geçişi ayrı incelemelerde tutulur.

Dosya yolu public/PWA static dizini dışında olmalıdır. Şifreleme erişim kontrolünün yerine geçmez; deployment ortamında dosya sistemi ve secret erişimi ayrıca sınırlandırılmalıdır.

Bu adapter tek process için durable storage sağlar; distributed lease, multi-instance conflict çözümü ve idempotent crash recovery sağlamaz. Bunlar ayrı katmanlardır.
