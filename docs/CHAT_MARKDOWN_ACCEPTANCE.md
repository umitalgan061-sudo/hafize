# Chat Markdown Kabul Kriterleri

## Temel çıktı

Asistanın başlıklı, paragraflı veya listeli yanıtı görsel hiyerarşisini korumalıdır. Modelin tek bir cevabı yüzlerce DOM wrapper üreterek sayfayı ağırlaştırmamalıdır. Boş asistan cevabı için okunabilir bir yer tutucu kalır.

## Kod

Fenced code üçlü backtick veya tilde ile görünür. Dil etiketi yalnız güvenli karakterlerden oluşur. Kod içindeki `<script>`, HTML ve Markdown işaretleri çalıştırılmaz; düz kod metni olarak kalır. Kopyalama eylemi kod bloğundan çıkarılan ham metni panoya yollar.

## Bağlantılar

HTTP(S) ve mailto tıklanabilir. Göreli, data, javascript, vbscript ve diğer protokoller metin kalır. Dış bağlantılar yeni sekmede güvenli ilişki niteliği taşır.

## Tablo

Başlık ve ayraç satırı olmayan pipe metni tabloya dönüşmez. Sütun sayısı sınırı uygulanır. Mobilde yatay scroll vardır. Hücrelerde inline biçimlendirme çalışsa da raw HTML çalışmaz.

## Erişilebilirlik

Kod kopyalama düğmesi açık `aria-label` taşır. Link ve düğme focus-visible durumuna sahiptir. Reduced-motion ortamında yeni bir animasyon dayatılmaz. Forced-colors ortamında sınırlar görünür kalır.

## Streaming

Kapanmamış fence geçerli ara durumdur. Yeni delta geldiğinde kaynak değişirse yeniden çizim yapılır. Aynı içerik ikinci kez geldiğinde gereksiz render yapılmaz. Observer kapatıldığında `disconnect` çalışır.

## Veri bütünlüğü

Markdown yalnız presentation layer'dır. `hafize.conversations.v1` içindeki mesaj metni Markdown node ağacına dönüştürülmez ve kalıcı şema değişmez. Bu nedenle export/retry/edit işlemleri ham metni kullanmaya devam eder.

## PWA

Index'in yüklediği iki yeni shell asset'i service worker cache'inde bulunmalıdır. Cache revision değişir; eski shell cache'leri silinir. API yolları cache edilmez.
