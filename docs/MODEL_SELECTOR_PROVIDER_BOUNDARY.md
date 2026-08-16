# Model seçici provider sınırı

`public/model-selector-enhancement.js`, mevcut `/api/models` listesini değiştirmeden seçili modelin hangi provider yoluna ait olduğunu görünür kılar.

## Görünür davranış

- NVIDIA model kimlikleri `NVIDIA · …` etiketiyle gösterilir.
- `local:` önekli modeller `Yerel · …` etiketiyle gösterilir.
- Seçimin altında erişilebilir bir provider durum metni bulunur.
- Model kimliği olduğu gibi option `title` alanında korunur; request payload veya model routing değiştirilmez.

Provider ayrımı `lib/model-provider-router.mjs` içindeki mevcut sözleşmeyle aynıdır: `local:` öneki yerel provider, diğer model kimlikleri NVIDIA provider yoludur.

## Yerel model + araç modu koruması

Yerel provider bugün standart `/api/chat` akışındadır. Tool-calling agent yolu NVIDIA araç runtime'ına bağlıdır. Bu nedenle UI katmanı:

- yerel model seçiliyken kapalı araç modunun açılmasını capture aşamasında engeller;
- NVIDIA modelden yerel modele geçildiğinde açık araç modunu mevcut uygulama click yolu üzerinden kapatmayı dener;
- araç modu herhangi bir nedenle açık kalırsa composer gönderimini ve öneri düğmesi gönderimini fail-closed engeller;
- kullanıcıya görünür bir uyarı verir ve model seçicisine focus döndürür.

Bu davranış backend tool permission sözleşmesinin yerine geçmez. Backend default-deny izin kontrolü, agent registry ve dış yazma onayı aynen korunur.

## Veri ve gizlilik

Controller yeni network isteği üretmez. localStorage, sessionStorage, cookie, clipboard, connector, tool veya external send çağrısı yapmaz. Yalnız mevcut model select, tool-mode button ve composer DOM durumunu okur.

## Lifecycle

Model seçenekleri `/api/models` çağrısından sonra dinamik geldiği için controller select child-list değişimlerini izler. Destroy sırasında observer/listener'lar kaldırılır, üretilen status temizlenir ve mevcut option etiketleri önceki metinlerine döndürülür.
