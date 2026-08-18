# Conversation storage content budget

## Amaç

`hafize.conversations.v1` için yalnız kayıt sayısı ve tek mesaj uzunluğu sınırı yeterli değildir. Teorik olarak 30 sohbet × 200 mesaj × 12.000 karakter, tarayıcı localStorage kotasını ve mobil cihaz belleğini aşabilecek kadar büyük bir snapshot üretebilir.

Bu sözleşme mevcut conversation guard'a iki ek bounded içerik bütçesi getirir. Yeni bir storage sistemi veya backend senkronizasyonu oluşturmaz.

## Sınırlar

- Tek mesaj: en fazla 12.000 karakter.
- Tek sohbet: toplam message content en fazla **120.000 karakter**.
- Tüm canonical conversation snapshot: toplam message content en fazla **1.200.000 karakter**.
- En fazla 200 mesaj / sohbet ve 30 sohbet sınırları ayrıca geçerlidir.
- Tek normalize çağrısı en fazla **120 conversation candidate** inceler.

Bu sayılar storage quota'nın birebir byte garantisi değildir; JSON metadata ve tarayıcıların UTF-16/storage implementasyonları farklı olabilir. Ama önceki teorik üst sınırı önemli ölçüde azaltan ölçülebilir bir uygulama sınırıdır.

## Retention politikası

İçerik bütçesi aşılırsa en güncel bağlam korunur.

1. Her sohbet içinde mesajlar sondan başa değerlendirilir.
2. En yeni geçerli mesajlar 120.000 karakterlik conversation bütçesine sığdığı sürece tutulur.
3. Sonuç tekrar kronolojik eski → yeni sıraya çevrilir.
4. Conversation candidate'lar bounded normalize edildikten sonra `updatedAt` azalan sıraya dizilir.
5. Global 1.200.000 karakter bütçesi en yeni sohbetlerden başlanarak tüketilir.
6. Global bütçenin kalan kısmı son conversation'ın yalnız sığan en yeni mesajlarını tutabilir.
7. Mesajı olan bir conversation için hiçbir mesaj artık bütçeye sığmıyorsa daha eski conversation'lara geçilmez; recency önceliği korunur.

Bu politika “eski konuşmaların sayısını korumak uğruna yeni bağlamı kaybetme” davranışını özellikle önler.

## Candidate scan sınırı

Untrusted/elle değiştirilmiş localStorage dizisi sınırsız uzunlukta olabilir. Guard bütün array'i normalize etmeye çalışmaz. En fazla 120 candidate incelenir; bu değer normal 30-conversation uygulama sınırının dört katıdır ve bozuk/verimsiz girdiler için CPU/memory yüzeyini bounded tutar.

Candidate normalization sonrası yalnız en güncel 30 geçerli sohbet canonical snapshot'a girer. Duplicate conversation ID durumunda bounded taramada ilk geçerli örnek tutulur.

## Güvenlik ve veri minimizasyonu

Bu değişiklik mevcut allowlist modelini değiştirmez:

- yalnız `user` ve `assistant` rolleri;
- bounded id/title/agent/tool activity alanları;
- bilinmeyen alanların otomatik düşürülmesi;
- owner/trace/token/credential alanlarının persist edilmemesi;
- secret veya connector bilgisinin agent context'e eklenmemesi;
- yeni network, backend endpoint veya external-write yetkisi olmaması.

Content budget metni analiz etmez veya sınıflandırmaz; yalnız normalize edilmiş `message.content.length` üzerinden deterministik sayım yapar.

## Write-time davranışı

#286 ile kurulan storage write boundary aynı normalizer'ı kullandığı için bu bütçeler hem ilk yüklemede hem aynı sayfadaki sonraki conversation persistence yazımlarında uygulanır. Diğer localStorage anahtarları etkilenmez.

Quota exception yine tarayıcıdan gelebilir; boundary bu hatayı saklamaz veya remote storage fallback açmaz. Bu sözleşme quota riskini bounded tutar fakat her tarayıcı için sınırsız persistence garantisi vermez.

## Test sözleşmesi

Regresyonlar en az şu davranışları kilitler:

- 20 × 10.000 karakterlik mesajdan tek conversation için yalnız en yeni 12 mesajın korunması.
- Conversation içerik toplamının 120.000'i aşmaması.
- Birçok büyük conversation arasında global toplamın 1.200.000'i aşmaması.
- Global retention'ın en yeni `updatedAt` conversation'lardan başlaması.
- Stable JSON round-trip sonrasında aynı budget sınırlarının korunması.
- 120 candidate sonrası girdilerin normalize edilmemesi.
- Unsorted conversation girdisinin deterministic `updatedAt` sırasına alınması.
- Duplicate conversation kimliğinin tek canonical kayda düşmesi.

## Geri alma

Bu PR tek başına geri alınacaksa `MAX_CONVERSATION_CONTENT_CHARS`, `MAX_TOTAL_CONTENT_CHARS`, candidate scan limiti ve ilgili helper/test/dokümanlar kaldırılır. #286'nın newest-200 retention ve write-boundary davranışı yerinde kalabilir; backend veya durable schema migrasyonu yoktur.
