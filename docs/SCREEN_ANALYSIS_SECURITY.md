# Hafize ekran analizi güvenlik modeli

Bu katman Jarvis incelemesindeki ekran analizi fikrini Hafize'ye bağımsız ve kullanıcı kontrollü biçimde uygular. Üçüncü taraf Jarvis kaynak kodu kullanılmaz.

## Kullanıcı kontrolü

- Ekran görüntüsü yalnız browser/Electron izin yüzeyinde kullanıcı seçimiyle alınır.
- Analiz isteği ayrıca `explicitUserIntent:true` gerektirir. Sadece ekran görüntüsü almak görüntüyü Hafize'ye göndermez.
- İstek tek JPEG kare taşır; sürekli ekran akışı veya arka plan yakalama yoktur.
- Görüntü personal-memory store'a, schedule store'a veya tool context'e yazılmaz.
- HTTP yanıtı görüntüyü veya byte metadata'sını geri yansıtmaz; yalnız analiz metni ve model kimliği döner.

## Veri sınırı

`screen-analysis-contract` yalnız `model`, `prompt`, `image`, `explicitUserIntent` alanlarını kabul eder. `ownerId`, token, URL, file path veya bilinmeyen alanlar reddedilir. Görüntü yalnız `data:image/jpeg;base64,...` biçiminde ve en fazla 1 MiB olabilir; JPEG başlangıç/bitiş işaretleri doğrulanır.

Bu ilk boundary yalnız request-level boyut kontrolü yapar. Production server wiring yapılırken `/api/screen-analysis` için JSON body limiti ayrıca bu sınırı karşılayacak şekilde dar ve route-specific tanımlanmalıdır; global chat body limiti büyütülmemelidir.

## NVIDIA vision payload

Runtime OpenAI-compatible multimodal message yapısını kullanır: bir system güvenlik mesajı ve user seviyesinde text + image_url parçaları. Görüntüde veya kullanıcı açıklamasında bulunan talimatlar harici veri sayılır; system yetkisi kazanmaz.

Payload'a tool veya tool_choice eklenmez. Ekran analizi agent/tool permission sistemini atlayan yeni bir tool execution yolu değildir. NVIDIA NIM ana sağlayıcı olarak kalır ve model kullanıcı tarafından seçilir.

## Hata ve iptal

Request `AbortSignal` production wiring'de NVIDIA completion'a taşınmalıdır. Pre-aborted veya çalışma sırasında iptal edilen analiz sanitize edilmiş `SCREEN_ANALYSIS_CANCELLED` üretir. Provider exception mesajı, yerel path, upstream response body veya credential ayrıntısı public sonuca taşınmaz.

## Bilinçli sınır

Bu PR güvenli contract/runtime/HTTP boundary'yi hazırlar; `server.mjs` route'u ve frontendde ayrı “analiz et” onay düğmesi sonraki küçük, testli wiring adımına bırakılır. Mevcut `screen-share.js` yakalamadan sonra görüntünün Hafize'ye gönderilmediğini söylemeye devam eder.
