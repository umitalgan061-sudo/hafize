# Personal Memory HTTP API

## Güvenlik modeli

Kişisel bellek varsayılan olarak kapalıdır. Sunucuda hem HAFIZE_MEMORY_KEY_B64 (32 baytlık AES-256-GCM anahtarının Base64 biçimi) hem de HAFIZE_MEMORY_STORAGE_DIR (şifreli dosyanın tutulacağı dizin) tanımlanmalıdır. Anahtar istemciye, loglara veya ajan bağlamına aktarılmaz. Depolama yapılandırması eksik veya açılamaz durumdaysa bellek API'si 503 döndürür ve uygulamanın geri kalanı çalışmaya devam eder.

Üretim/public kurulumda bütün bellek yolları oturum kimlik doğrulamasına tabidir. Değişiklik istekleri mevcut CSRF başlığını da gerektirir. Connector Bearer kimliği kişisel belleğe erişim sağlamaz. Kimlik sahibi, istem gövdesinden veya query parametresinden alınmaz; güvenilir oturum principal'ından türetilir. Loopback geliştirme modu yalnız 127.0.0.1 bağlamasında yerel bir principal kullanır; public hostta kimlik doğrulaması devre dışı bırakılmışsa bellek yolları reddedilir.

## Uç noktalar

- GET /api/memory?query=...&kind=preference&limit=5: yalnız geçerli oturum sahibinin eşleşen kayıtlarını döndürür. query zorunludur; en fazla dört kind filtresi ve 1–20 arası limit kabul edilir.
- POST /api/memory/review: eylem ve payload için normalize edilmiş, tam içerik önizlemesi üretir. Bu aşama kalıcı değişiklik yapmaz ve yalnız kısa ömürlü review kimliği döndürür.
- POST /api/memory/approval: yalnız review kimliği ve approved=true kabul eder. Açık onay olmadan mutation bileti üretilmez.
- POST /api/memory/mutation: onay uç noktasından alınan ticket, action ve aynı payload ile çağrılır. Doğrudan POST/DELETE yazımı yoktur.

## Onay sözleşmesi

Akış üç adımdır: sunucu review/önizleme üretir, kullanıcı önizlemeyi inceleyip ayrı bir onay eylemi verir, sonra aynı payload tek kullanımlık mutation biletiyle uygulanır. Review ve onay biletleri kriptografik rastgele, iki dakika geçerli ve yalnız sunucu belleğinde tutulan değerlerdir. Yalnız SHA-256 özetleri saklanır; bilet sahibi, eylem ve normalize edilmiş payload parmak izi birlikte doğrulanır. İçerik veya hedef değişirse bilet iptal edilir. Bilet, kalıcı depolamaya yazılmadan önce tüketilir; eşzamanlı replay yalnızca bir kez başarılı olabilir. Sunucu yeniden başladığında bekleyen review ve biletler geçersizleşir ve yeniden onay gerekir.

Review yanıtı kullanıcıya inceleyebileceği tam içerik önizlemesini verir (kişisel bellek içerik sınırı 4000 karakterdir). Silme önizlemesi hedef kaydın kimliğini, türünü ve içeriğini gösterir. Kayıt içeriği yalnız text olarak render edilmelidir; HTML olarak yorumlanmamalıdır. Review kimliği, onay bileti ve tam içerik loglanmamalıdır.

Bellek sözleşmesi açık kullanıcı niyeti, kesin eşleşmeli silme, sahip kapsamı ve plaintext credential engellerini korur. NVIDIA NIM veya başka bir sağlayıcıya bağımlı değildir; bu API bir model aracı açmaz ve ajan izinlerini genişletmez.

## Kontroller

- node scripts/test-personal-memory-http-api.mjs
- node scripts/test-personal-memory-http-api-boundary.mjs
- npm run check

Bellek anahtarını secret manager veya güvenli sunucu ortam değişkeni üzerinden verin. Depolama dizinini kaynak kod deposunun dışında tutun; anahtar ya da gerçek bellek verisini repoya commit etmeyin.
