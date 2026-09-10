# Sohbet Mesajı Düzenleme

Hafize sohbetindeki kullanıcı mesajları artık konuşma içinden düzenlenip yeniden gönderilebilir. Özellik tamamen istemci tarafındaki mevcut sohbet geçmişi ve `/api/chat` / `/api/agent/run` akışlarını kullanır; yeni bir upload, endpoint veya secret eklemez.

## Kullanıcı akışı

Her `user` mesajının altında `Düzenle` eylemi bulunur. Eyleme basıldığında mesaj metni composer alanına taşınır, alan seçilir ve composer üzerinde `Mesaj düzenleniyor` göstergesi açılır.

Kullanıcı `Gönder` ile yeni metni gönderdiğinde:

1. Düzenlenen mesaj bulunur.
2. O mesajdan sonraki yerel kullanıcı ve asistan mesajları konuşmadan çıkarılır.
3. Yeni metin aynı konuşmanın yeni kullanıcı dönüşü olarak eklenir.
4. Normal sohbet yolu veya mevcut tool-enabled ajan yolu tekrar çalıştırılır.
5. Yeni asistan yanıtı normal sohbet geçmişine kaydedilir.

Bu davranış bir `branch` mantığı oluşturmaz. Amaç, aynı sohbet içinde bir dönüşü düzeltip o noktadan devam etmektir.

## Neden sonraki mesajlar siliniyor?

Önceki asistan yanıtları düzenlenmiş kullanıcı isteğinin devamıdır. Eski kullanıcı metninden türemiş yanıtları görünürde koruyup yeni metnin altına eklemek bağlamı belirsizleştirirdi. Bu nedenle düzenleme, seçilen kullanıcı dönüşünde bağlamı keser ve yeniden üretir.

## Güvenlik sınırı

Düzenleme istemcide mevcut yerel geçmiş üzerinde çalışır. Yeni bir yetki yükseltmesi yoktur. Backend, ajan kimliği, model seçimi, tool policy ve dış servis onay sınırları değişmez.

Mesaj kimliği DOM'dan alınsa bile backend'e ayrı bir "edit id" gönderilmez. İstek, mevcut `messages` dizisinin güncel hâli üzerinden normal sohbet sözleşmesine girer.

Düzenleme sırasında SSE veya tool isteği zaten akıyorsa eylem reddedilir. Bu, aktif isteğin geçmişini eşzamanlı olarak değiştirme riskini önler.

## Composer davranışı

Düzenleme göstergesi `role="status"` taşır ve metni `Mesaj düzenleniyor` olarak bildirir. `Vazgeç` ile düzenleme modu kapanır ve composer temizlenir.

`Escape` tuşu düzenleme modundayken aynı iptal davranışını verir. Başka bir sohbet seçildiğinde etkin düzenleme iptal edilir; böylece eski mesaj kimliği yeni konuşmada uygulanamaz.

Mevcut taslak otomatik kaydetme modülü, form submit olayında düzenlenmiş mesajı normal bir gönderim olarak ele alır. Düzenleme iptal edildiğinde composer yeniden boşaltıldığı için mevcut taslak anahtarı da normal yaşam döngüsü üzerinden güncellenir.

## Tool modu

Düzenlenen mesaj, konuşmanın mevcut `toolsEnabled` tercihini korur. Kullanıcı araç modunu kapatmadıysa `/api/agent/run`, aksi durumda `/api/chat` kullanılır. Bu seçim düzenleme özelliğine özel bir bypass değildir.

## Erişilebilirlik

`Düzenle` ve `Vazgeç` kontrolleri gerçek `button` elemanlarıdır. Her ikisinin de görünür metni vardır ve `aria-label` desteklenir. Düzenleme durumunun değişimi status bölgesinden duyurulur.

Dar ekran için mevcut `.message-actions` düzeni korunur; düzenleme göstergesi de 560 px altında daha küçük metinle sıkışmadan çalışacak şekilde ayarlanır. Azaltılmış hareket tercihinde ekstra animasyon kullanılmaz.

## Çoklu sekme

Sohbet geçmişi zaten `localStorage` üzerinden paylaşılır. Düzenleme işlemi de aynı anahtarı yazar. Başka sekmedeki açık sohbet, kendi mevcut render akışında depolama değişimini gördüğünde güncellenebilir. Özellik gerçek zamanlı ortak düzenleme iddiasında değildir; son başarılı yerel yazma kazanır.

## Hata davranışı

Düzenlenecek mesaj mevcut konuşmada bulunamazsa işlem yapılmaz ve kullanıcıya kısa bir uyarı gösterilir. Aktif istek varken düzenleme başlatılamaz.

Yeni yanıt alınamazsa mevcut sohbet hata mesajı gösterme davranışı korunur. Düzenlenen eski tur ayrı bir hata nesnesi olarak taşınmaz; yalnız güncel konuşma geçmişi persist edilir.

## Sınırlar

Özellik aşağıdaki davranışları bilinçli olarak desteklemez:

- Asistan mesajlarını doğrudan düzenleme.
- Mesaj düzenleme geçmişini ayrı bir revision listesinde saklama.
- Sunucu tarafında edit endpoint'i oluşturma.
- Düzenlenmiş eski mesajın yanında eski asistan dalını tutma.
- Aktif streaming isteğinin ortasında düzenleme.

Bu sınırlar, mevcut yerel sohbet mimarisinde küçük ve geri alınabilir bir değişiklik tutmak içindir.

## Test

Kaynak sözleşmesi `scripts/test-chat-message-edit.mjs` ile doğrulanır. Test özellikle:

- düzenleme durumunun başlangıç değerini,
- kullanıcı mesajı bulma ve güvenli rol kontrolünü,
- geçmişin seçilen mesaja kadar kesilmesini,
- yeni kullanıcı mesajı oluşturulmasını,
- düzenleme olayının DOM tarafından yayınlanmasını,
- `Escape` / `Vazgeç` iptal yollarını,
- yalnız kullanıcı mesajında `Düzenle` görünmesini,
- HTML/JS/CSS referanslarının bütünlüğünü

doğrular.

Tam kalite kapısı için depo standardı geçerlidir:

```bash
npm run precheck
npm run check
```

## Geri alma

Bu özellik tek self-development PR'ının parçasıdır. Geri almak için PR squash commit'ini revert etmek yeterlidir. Backend veri şeması veya kalıcı sunucu tarafı state değişmediğinden rollback sırasında migration gerekmez.
