# Akış denetimi — durdurma ve yeniden üretme

Akan bir yanıt bu tura kadar sonuna kadar beklenmek zorundaydı: istek bir abort
signal taşımıyordu, composer yanıt boyunca kilitliydi ve yanlış giden bir tur
ancak bittikten sonra düzeltilebiliyordu. Bu belge, `Durdur` ve `Yeniden üret`
denetimlerinin ne yaptığını ve hangi sınırların içinde çalıştığını anlatır.

## Yüzey

| Denetim | Ne zaman görünür | Ne yapar |
| --- | --- | --- |
| `■ Durdur` | Yanıt akarken (gönder düğmesinin yerini alır) | Açık isteği iptal eder |
| `↻ Yeniden üret` | Akış yokken ve son mesaj bir Hafize yanıtıyken | Son yanıtı atıp aynı soruyu yeniden sorar |
| Durum metni | Akarken `Yanıt akıyor…`, durdurulduysa `Yanıt durduruldu` | `role="status"` ile duyurulur |

`Escape`, yanıt akarken durdurur. Açık bir `role="dialog"` paneli varsa kısayol
o panele bırakılır; Akıllı doldurma gibi yüzeyler `Escape` davranışını korur.

## Durdurulan yanıt ne olur

- O ana kadar gelen metin **aynen saklanır**; modelin gerçekten yazdığı kısımdır.
- Mesaj `stopped: true` ile işaretlenir ve transkriptte `Yanıt durduruldu`
  etiketiyle görünür, böylece yarım yanıt tam yanıt gibi okunmaz.
- Hiç içerik gelmeden durdurulduysa mesaj `Yanıt durduruldu.` notuna düşer;
  transkriptte boş bir tur kalmaz.
- Durdurulan yanıt geçmişte kalır ve sonraki isteklerde bağlam olarak gider.
  İstenmiyorsa `Yeniden üret` onu transkriptten çıkarır.

## Yeniden üretme

- Yalnızca son mesaj bir Hafize yanıtıysa ve onu isteyen bir kullanıcı mesajı
  varsa çalışır. Durdurulmuş veya hata metnine düşmüş bir yanıt da yeniden
  üretilebilir — asıl ihtiyaç zaten odur.
- Eski yanıt **istek gönderilmeden önce** transkriptten düşürülür; model,
  yerine geçeceği yanıtı hiçbir zaman görmez.
- Araç modu açıkken de aynı yol izlenir; tur `/api/agent/run` üzerinden gider.
- Yanıt sürerken yeniden üretme reddedilir ve nedeni toast ile söylenir.

## Sınırlar ve sorumluluk dağılımı

- `public/chat-stream-policy.js` kuralları tutar: abort tespiti, hangi
  transkriptin yeniden üretilebileceği, düğmelerin her durumda ne sunacağı ve
  durdurulan yanıtın ne saklayacağı. DOM'a, ağa ve storage'a dokunmaz.
- `public/app.js` ağı ve transkripti tutar: tur başına bir `AbortController`,
  `/api/chat` ve `/api/agent/run` isteklerine giden `signal`, durdurulan
  yanıtın kalıcılaştırılması.
- `public/chat-stream-control.js` yalnızca düğmelerdir: `hafize:stream-state`
  olayını dinler, `hafize:stop-stream` ve `hafize:regenerate-answer` olaylarını
  yollar. Ağ çağrısı yapmaz, storage'a yazmaz, `innerHTML` kullanmaz.

Sunucu tarafında hiçbir değişiklik yoktur. Durdurma, istemcinin isteği
kapatmasıdır; backend kimlik doğrulama, rate limit ve concurrency sınırları
aynı kalır.

## Erişilebilirlik

- Her iki düğme de `type="button"` taşır ve composer'ı submit etmez.
- Gönder düğmesi gizlenirken odak `Durdur` düğmesine, tur bitince geri gönder
  düğmesine taşınır; odak asla gizlenmiş bir denetimde kalmaz.
- Durum bölgesi `aria-live="polite"` ile okunur; 560 piksel altında metin
  gizlenir, durumu düğmeler taşır.

## Kontroller

```bash
node scripts/test-chat-stream-policy.mjs
node scripts/test-chat-stream-control-ui.mjs
node scripts/test-chat-stream-runtime.mjs
node scripts/test-chat-stream-source.mjs
```

`test-chat-stream-runtime.mjs` gerçek `public/app.js` dosyasını DOM harness
üzerine mount eder, kontrol edilebilir bir SSE gövdesi servis eder, akışı
ortasında iptal eder ve hayatta kalan transkripti okur. Durdurmanın yarım yanıtı
koruduğunu ve yeniden üretmenin eski yanıtı modele göndermediğini kanıtlayan
kontrol budur.

## Geri alma

Özellik üç dosya ve üç bağlantıdan ibarettir: `public/chat-stream-policy.js`,
`public/chat-stream-control.js`, `public/chat-stream-control.css` ile bunların
`public/index.html` ve `public/sw-policy.js` içindeki kayıtları. Bunlar
kaldırıldığında `public/app.js` içindeki abort yolu da geri alınmalıdır; policy
modülü olmadan `Durdur` ve `Yeniden üret` sessizce devre dışı kalır, sohbet
akışı ise etkilenmez.
