# Üretim Kontrolü 2.0

## Amaç

Hafize'nin streaming yanıt üretimini kullanıcı kontrollü, gözlemlenebilir ve geri alınabilir hale getirmek. Kontrol katmanı yalnızca tarayıcıdaki üretim yaşam döngüsünü yönetir; modele yeni bir yetki vermez ve server'a ayrı telemetry akışı açmaz.

## Temel akış

Üretim başlamadan önce controller tek bir çalışma kimliği üretir. Aynı anda ikinci bir üretim başlatılamaz. Her çalışma kendi `AbortController` sinyaline sahiptir.

Akış sırasında:

- geçen süre 250 ms aralıkla güncellenir,
- SSE olay ve byte sayıları izlenir,
- mesaj listesindeki `aria-busy` durumu korunur,
- composer kontrolleri üretim boyunca kilitlenir,
- kullanıcı `Üretimi durdur` düğmesi veya Ctrl/⌘ + Shift + X ile akışı kesebilir.

Durdurma istemi geldiğinde SSE istemcisine abort sinyali gönderilir. Sonraki network hatası ayrı bir yeni hata gibi ele alınmaz; mevcut çalışma `aborted` olarak kapanır.

## Kısmi yanıt davranışı

Durdurulmuş normal üretimde elde edilmiş metin korunur. Sadece henüz içerik üretmemiş boş assistant placeholder'ı kaldırılır. Böylece kullanıcı durdurma anındaki faydalı kısmı kaybetmez.

Yeniden üretmede önceki cevap geçici olarak saklanır. Yeni üretim durdurulur veya başarısız olursa eski cevap geri yazılır. Bu, regeneration işleminin kullanıcı verisini kaybetmemesini sağlar.

## Üretim geçmişi

`hafize.generation-control.history.v1` anahtarında en fazla 12 metadata kaydı tutulur. Her kayıtta yalnız:

- çalışma numarası,
- başarı/durdurma/hata durumu,
- başlangıç/bitiş zamanı,
- süre,
- okunan byte,
- SSE olay sayısı,
- kısa UI etiketi,
- durdurma nedeni,
- hata kodu

bulunur.

Prompt metni, assistant cevabı, access token, cookie, credential veya ham SSE gövdesi geçmişe yazılmaz.

## Tanı özeti

`Tanıyı kopyala` yalnız terminal durumda kullanılabilir. Çıktı bounded bir metin özetidir. `Geçmişi aç` son beş üretimi gösterir; geçmişin tamamı ayrıca yalnız kullanıcı temizleme kararıyla silinebilir.

## PWA

Üretim kontrol CSS'i shell cache'e dahil edilir. TypeScript controller bundle içinde `app-shell` ile birlikte derlenir; ayrı browser JS kaynağı oluşturulmaz.

## Yaşam döngüsü

Sayfa kapanırken controller aktif üretimi abort eder ve timer/listener'ları kaldırır. Ağ bağlantısı düştüğünde uygulama aktif üretimi `offline` nedeni ile kontrollü biçimde durdurur. Yeniden bağlantıda yeni üretim ancak kullanıcı yeni gönderim yaptığında başlar.

## Doğrulama

Unit testler state machine ve bounded history'yi; contract testleri HTML, Vite ve service-worker wiring'ini; security testleri storage/network sınırını; regression testleri durdurma sonrası message persistence davranışını kapsar.
