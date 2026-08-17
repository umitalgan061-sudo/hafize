# Screen Analysis Explicit Consent Contract

## Amaç

Hafize ekran analizi, kullanıcı tarafından açıkça seçilmiş bir ekran görüntüsünü NVIDIA vision-capable chat completion yoluna gönderir. Bu sözleşme görüntü ve analiz talimatının yalnız açık, iki aşamalı kullanıcı niyetiyle gönderilmesini ve normal sohbet taslağının bu veri akışına yanlışlıkla karışmamasını garanti eder.

## Neden değişiklik gerekliydi?

Önceki `screen-analysis-ui.js`, `#messageInput` içindeki mevcut sohbet taslağını otomatik olarak analiz prompt'u olarak kullanabiliyordu. Kullanıcı ekran görüntüsünü seçmiş olsa bile composer taslağını ayrıca ekran analizi için paylaşmayı seçmemiş olabilirdi. Bu davranış ürün beklentisini ve veri-minimizasyonu sınırını gereksiz yere birbirine bağlıyordu.

Yeni sözleşmede ekran analizi normal composer'ı hiç okumaz.

## Kullanıcı akışı

1. Kullanıcı `getDisplayMedia` seçim ekranında paylaşılacak pencere/ekranı açıkça seçer.
2. Hafize tek karelik, bounded JPEG önizlemesini yalnız sekme belleğinde hazırlar.
3. Kullanıcı ayrı `Analiz talimatı` alanına isteğini yazabilir; alan boşsa görünür varsayılan analiz talimatı kullanılır.
4. İlk `Hafize ile analiz et` tıklaması ağ isteği yapmaz; görüntü boyutu, NVIDIA model kimliği ve bounded prompt önizlemesiyle `Gönderim özeti` gösterir.
5. Yalnız ikinci `Onayla ve gönder` tıklaması `/api/screen-analysis` POST isteğini başlatabilir.
6. Görüntü, model veya prompt review sonrasında değişirse hazırlanmış onay geçersizleşir ve yeni review gerekir.
7. Escape hazırlanmış gönderim onayını iptal eder.

## Composer izolasyonu

- `screen-analysis-ui.js` `#messageInput` seçmez veya okumaz.
- Sohbet composer taslağı görüntü analiz prompt'una otomatik taşınmaz.
- Ekran analizi sonucu composer'a otomatik yazılmaz ve sohbet mesajı otomatik gönderilmez.
- Ekran analizi için yalnız dedicated `#screenAnalysisPrompt` alanı kullanılır.

## Provider sınırı

Ekran analizi backend'de doğrudan NVIDIA completion runtime'ına bağlıdır. Bu nedenle `local:` model kimliği ekran analizi için geçerli değildir.

Bu sınır üç yerde fail-closed uygulanır:

- UI `local:` model ile review hazırlamaz.
- `screen-analysis-client.js` local modeli POST oluşturmadan reddeder.
- `screen-analysis-contract.mjs` local modeli backend completion çağrısından önce `nvidia_model_required` nedeni ile reddeder.

Böylece model selector'da yerel provider seçilmiş olması, ekran görüntüsünün yanlışlıkla NVIDIA'ya local-model etiketiyle gönderilmesine yol açmaz. Kullanıcı ekran analizi için ayrıca gerçek bir NVIDIA modeli seçmelidir.

## Veri sınırı

- Görüntü yalnız explicit `getDisplayMedia` seçimiyle alınır.
- Görüntü maksimum 1280×720'e küçültülür ve JPEG olarak en fazla 1 MiB kabul edilir.
- UI analiz talimatı 1200 karakterle sınırlandırılır; backend mutlak üst sınırı 4000 karakterdir.
- Review önizlemesi en fazla 240 karakterdir ve yalnız `textContent` ile render edilir.
- Görüntü veya prompt localStorage, sessionStorage, IndexedDB, cookie veya clipboard'a yazılmaz.
- NVIDIA API key veya başka credential istemciye taşınmaz.
- Yeni connector, WebSocket, EventSource veya sendBeacon yolu yoktur.

## Backend güvenliği

`explicitUserIntent: true` request şemasında zorunlu olmaya devam eder. Backend request alanlarını exact allowlist ile doğrular, JPEG data URL biçimini ve gerçek JPEG başlangıç/bitiş byte'larını kontrol eder, body boyutunu bounded tutar ve upstream hatalarını sanitize eder.

Görüntü/prompt içinde yer alan talimatlar sistem talimatı değildir. Screen-analysis system prompt bunları veri olarak değerlendirir ve secret/credential tahmini yapmamasını ister.

## Erişilebilirlik

- Dedicated prompt gerçek `textarea` öğesidir ve privacy açıklamasına `aria-describedby` ile bağlıdır.
- Review `role=status`, `aria-live=polite`, `aria-atomic=true` kullanır.
- Mobilde analiz/remove eylemleri minimum 44px hedefe sahiptir.
- `focus-visible`, `prefers-reduced-motion` ve `forced-colors` davranışları korunur.

## Test / DoD

Regresyon testleri şunları kilitler:

- composer draftının screen-analysis kaynak kodunda hiç okunmaması,
- iki aşamalı review snapshot davranışı,
- prompt/model/capture değişiminde onayın invalidation'ı,
- `local:` modelin client ve server tarafında reddi,
- explicit user intent zorunluluğu,
- forbidden storage/secret/shell/HTML yüzeyleri,
- PWA shell v78 wiring ve `/api/*` cache dışı davranışı,
- mobil ve erişilebilirlik sözleşmesi.

## Geri alma

Revert için `screen-analysis-ui.js`, `screen-analysis-client.js`, `screen-analysis-contract.mjs`, `screen-analysis-consent.css`, üç test, bu belge ve PWA v78 wiring değişiklikleri geri alınır. Görüntü, kişisel bellek veya persistent schema migrasyonu yoktur.