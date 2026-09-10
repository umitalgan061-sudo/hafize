# Sohbet geçmişi yönetimi

Hafize sohbet geçmişi, `hafize.conversations.v1` anahtarıyla tarayıcının yerel depolamasında tutulur. Bu özellik sunucuya sohbet geçmişi göndermez; mevcut yerel geçmişin kullanıcı tarafından düzenlenmesini sağlar.

## Özellikler

### Sabitleme

Her sohbet satırında elmas düğmesi bulunur. Düğme `pinned: true` alanını yerel konuşma nesnesine ekler veya kaldırır. Sabitlenen sohbetler geçmiş listesinin üstünde gösterilir. Sabitleme, sohbet mesajlarını ve zaman damgalarını değiştirmez.

Eski konuşmalarda `pinned` alanının bulunmaması normaldir; eksik alan `false` kabul edilir. Böylece önceki depolama formatı değiştirilmeden yeni davranış kullanılabilir.

### Yeniden adlandırma

Kalem düğmesi satır içinde bir düzenleme alanı açar. Başlıklar baştaki/sondaki boşluklardan arındırılır, ardışık boşluklar tek boşluğa indirilir ve 80 karakterle sınırlandırılır. Boş bir başlık kaydedilmez.

Kaydetme doğrudan `hafize.conversations.v1` içine yapılır. Uygulamanın ana sohbet ekranı yeniden çizilse bile başlık korunur.

### Silme koruması

Mevcut silme düğmesinin davranışı korunur; ancak yönetim katmanı olayı yakalama fazında ele alır ve kullanıcıdan ikinci bir onay ister. Kullanıcı iptal ederse uygulamanın mevcut silme handler'ına olay ulaşmaz.

Bu onay yalnızca sohbet geçmişindeki tekil silme eylemi içindir. `Temizle` düğmesinin kendi uygulama içi onay akışı aynen bırakılmıştır.

## DOM entegrasyonu

`chat-history-management.js`, `#conversationList` altında oluşturulan `.conversation-row` öğelerini gözlemler. `app.js` her render işleminde satırları yeniden ürettiği için özellik `MutationObserver` kullanarak satırları tekrar dekore eder.

Satırların DOM üzerinde benzersiz konuşma kimliği yoktur. İlk dekorasyon sırasında güncel yerel geçmişteki aynı sıra korunarak `data-conversation-id` atanır. Daha sonra bu kimlik satırın açık düğmesinde taşınır; sabitleme, yeniden adlandırma ve silme guard'ı bu kimliği kullanır.

Sabitlenen satırlar yalnızca DOM görünümünde yukarı taşınır. Yerel depolamadaki dizi sırası değiştirilmez. Bu sayede `app.js` içindeki güncellenme zamanına göre sıralama mantığıyla çakışma azaltılır.

## Veri sözleşmesi

Yeni alan yalnızca şu biçimde kullanılır:

```json
{
  "id": "mevcut-konuşma-id",
  "title": "Sohbet başlığı",
  "pinned": true
}
```

Diğer konuşma alanlarına dokunulmaz. Özellikle `messages`, `agentId`, `toolsEnabled`, `createdAt` ve `updatedAt` korunur.

Yazma başarısız olursa kullanıcıya mevcut toast mekanizmasıyla hata bildirilir. Başlık veya sabitleme işlemi başarısız olduğunda DOM başarı durumu taklit edilmez.

## Erişilebilirlik

Yönetim düğmeleri gerçek `button` öğeleridir ve `aria-label` değerleri taşır. Sabitleme durumu `aria-pressed` ile belirtilir. Yeniden adlandırma alanı grup etiketiyle sunulur; `Enter` kaydetme, `Escape` iptal etme işlemlerini destekler.

Mobil görünümde yönetim düğmeleri daha büyük dokunma hedeflerine çıkarılır. Klavye ile odaklandığında düğmeler ve giriş alanı görünür bir odak çerçevesi gösterir.

## PWA

Yeni JS ve CSS dosyaları shell varlıklarına eklenir ve service worker cache sürümü `v20` olarak yenilenir. Böylece yeni özellik eski cache içeriği nedeniyle sessizce kaybolmaz.

## Test yaklaşımı

`script/test-chat-history-management.mjs` kaynak-sözleşme kontrolleri yapar. Kontroller; HTML bağlantılarını, yerel depolama anahtarını, sabitleme/yeniden adlandırma/silme guard sözleşmelerini, responsive CSS seçicilerini ve service-worker cache kayıtlarını doğrular.

Node/npm runtime'ı olmayan çalışma ortamlarında bu testler dosya içeriği üzerinden gözden geçirilebilir; çalıştırılamayan komut sonucu PR açıklamasında açıkça belirtilmelidir.

## Geri alma

Bu özellik tek bir PR olarak squash-revert edilebilir. Geri alma sonrasında mevcut sohbet geçmişindeki ek `pinned` alanı zararsız bir bilinmeyen alan olarak kalabilir; eski `app.js` bu alanı okumadığı için sohbetlerin temel işlemleri etkilenmez.
