# Smart Fill Güvenlik Modeli

## Güven sınırı

Smart Fill tamamen tarayıcı tarafında çalışır. Değişken değerleri backend'e gönderilmez; kullanıcı `Mesaja aktar` seçeneğine bastığında metin yalnızca mevcut composer textarea alanına yazılır.

## Depolama

Preset verileri `localStorage` altında istem bazlı anahtarlarla tutulur. Secret yönetimi, OAuth token depolama veya uzak analytics katmanı yoktur.

Storage okuma hatası uygulamanın geri kalanını durdurmaz. Yazma hatası kullanıcıya kontrollü durum mesajı olarak yansır.

## DOM güvenliği

Kullanıcı tarafından girilen değişken değerleri `textContent`, input `value` ve textarea `value` özellikleri üzerinden işlenir. `innerHTML`, `outerHTML` veya HTML template interpolation kullanılmaz.

Önizleme `pre` elemanında düz metin olarak tutulur. Böylece `<script>`, `<img onerror>`, SVG veya benzeri içerikler HTML olarak çalıştırılmaz.

## Boyut sınırları

Bir değişken değeri 1000 karakteri geçemez. Aynı istemde en fazla 12 değişken işlenir. Bir istemin son önizlemesi 8000 karakterle sınırlandırılır. Bir istem için en fazla 6 preset tutulur.

Bu sınırlar hem bellek kullanımını hem de tek bir kötü niyetli storage kaydının kullanıcı arayüzünü kilitleme riskini azaltır.

## Command palette

Palette yalnızca mevcut local Prompt Library kayıtlarını tarar. Ağ isteği yapmaz. `/prompt` komutunun arama metni güvenli sınırlandırılır. Sonuçlar 12 kayıtla sınırlıdır.

## Otomatik gönderim yasağı

Smart Fill aktarımı composer'ı doldurabilir ve `input` olayını tetikleyebilir ancak form submit etmez. Kullanıcının açık `Gönder` etkileşimi olmadan model çağrısı başlatılmaz.

## Preset gizliliği

Preset adı ve değişken değerleri Prompt Library export dosyasına dahil edilmez. Kullanıcı açıkça export alırken bile Smart Fill presetleri ayrı kalır.

## Veri temizleme

Preset silme yalnızca ilgili prompt'un preset anahtarını etkiler. Prompt silme sırasında preset temizliği gelecekte ayrıca ele alınabilir; bu sürümde stale presetler ana uygulama davranışını bozmaz.

## Tehdit modeli

Tehditler: aşırı uzun girdiler, bozuk JSON, storage erişim hatası, HTML injection, event yarışları, tekrarlı mount, PWA stale cache ve klavye odağı kaybıdır.

Kontroller: uzunluk sınırları, safe parse, text-only DOM, mount guard, lifecycle cleanup, focus trap, cache version bump ve kaynak sözleşme testleri.
