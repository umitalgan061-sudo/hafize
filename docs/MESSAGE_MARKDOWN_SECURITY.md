# Markdown güvenlik modeli

## Temel ilke

Model çıktısı güvenilmeyen metindir.

Renderer bu metni HTML olarak parse etmez. Elementler açıkça oluşturulur ve metin düğümleri kullanılır.

## HTML enjeksiyonu

`<script>`, olay handler'ları, iframe, inline style ve SVG gibi içerikler özel HTML olarak yorumlanmaz.

Modelin `<b>` veya `<img>` yazması kullanıcı arayüzünde ham metin olarak kalır.

## URL güvenliği

Linkler yalnızca izin verilen üç protokolden biriyle oluşturulur:

- `http:`
- `https:`
- `mailto:`

`javascript:`, `data:` ve `vbscript:` kabul edilmez.

URL ayrıştırma başarısız olursa bağlantı oluşturulmaz.

Harici linklerde `target=_blank` yanında `rel=noopener noreferrer` bulunur.

## Kod blokları

Kod içeriği `textContent` ile yerleştirilir.

Bu nedenle kod içinde HTML benzeri payload bulunması DOM düğümü oluşturmaz.

Kopyalama yalnızca navigator Clipboard API varsa denenir.

Clipboard API başarısızlığı uygulamanın geri kalanını durdurmaz.

## Boyut sınırları

Yanıt 24.000 karakterle sınırlandırılır.

Blok ve satır sınırları CPU ve DOM iş yükünü bounded tutar.

22 satırı aşan kod blokları görsel olarak daraltılabilir.

## Streaming güvenliği

MutationObserver yalnız mevcut `#messages` ağacını izler.

Observer yeni network bağlantısı kurmaz.

Renderer yüklenmezse retry sayısı sınırlıdır.

Her render çağrısında model metni yeniden güvenli DOM üretiminden geçer.

## Storage ayrımı

Markdown katmanı localStorage verisini değiştirmez.

Sohbet kaydı ham metni saklar; biçimlendirilmiş DOM geçicidir.

## Test beklentileri

Kaynak kontrat testleri aşağıdaki anti-pattern'leri reddeder:

- `innerHTML`
- `outerHTML`
- `insertAdjacentHTML`
- `document.write`
- serbest URL protokolleri

## Incident yaklaşımı

XSS şüphesi halinde renderer enhancement katmanı devre dışı bırakılabilir; ham `textContent` gösterimi veri kaybı olmadan devam eder.

Yeni HTML elemanı eklemek güvenlik incelemesi gerektirir.
