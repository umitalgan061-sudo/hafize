# Sohbet taslakları

Hafize'nin sohbet kutusuna yazılan ancak henüz gönderilmeyen metinler `hafize.chat-drafts.v1` anahtarıyla yalnızca tarayıcıdaki `localStorage` içinde tutulur. Taslaklar sunucuya gönderilmez ve `/api/chat` veya `/api/agent/run` çağrısının parçası değildir.

## Davranış

Kullanıcı metin alanına yazdıkça taslak 250 ms gecikmeli olarak kaydedilir. Kaydetme başarısızsa sohbet çalışmaya devam eder; kullanıcıya kalıcı depolamanın kullanılamadığı bildirilir.

Aktif konuşma, geçmiş listesindeki `.conversation-row.active` satırının `.conversation-open` düğmesindeki `data-conversation-id` değeriyle belirlenir. Yeni bir konuşmaya geçildiğinde ilgili kimliğin taslağı varsa geri yüklenir. Böylece aynı tarayıcıda farklı konuşmalar için farklı taslaklar tutulabilir.

Gönderim formu çalıştığında gönderim olayının yakalama fazındaki handler taslağı temizler. Bu, uygulamanın normal submit handler'ı kullanıcı metnini göndermeden önce veya sonra çalışsa da gönderilmiş metnin taslak olarak kalmasını önler.

Sayfa gizlenirken, `pagehide`/`beforeunload` sırasında ve görünürlük `hidden` olduğunda bekleyen debounce kaydı flush edilir. Son karakterlerin kaybolma olasılığını azaltmak için bu lifecycle noktaları doğrudan depolama katmanına bağlanmıştır.

## Veri sınırları

Bir taslak en fazla 12.000 karakterdir; bu sınır sohbet kutusunun mevcut `maxlength="12000"` sözleşmesiyle aynıdır. Aynı anda en fazla 30 taslak saklanır. Konuşma artık `hafize.conversations.v1` içinde bulunmuyorsa onun taslağı geçersiz sayılır ve temizlik sırasında kaldırılır.

Depolanan biçim basit bir nesnedir:

```json
{
  "conversation-id": "Henüz göndermediğim metin..."
}
```

Anahtarlar yalnız mevcut konuşma kimlikleriyle eşleştirilir. Değerler string değilse veya sınırı aşıyorsa kalıcı depolamaya alınmaz/trimlenir. Eski sürümlerde taslak anahtarının bulunmaması normaldir; modül bunu boş durum olarak ele alır.

## UX ve erişilebilirlik

Composer altında küçük bir status alanı bulunur. `role="status"` ve `aria-live="polite"` kullanıldığı için taslağın geri yüklenmesi gibi önemli ama düşük öncelikli durumlar yardımcı teknolojilere duyurulabilir. Alan boşken görsel olarak gizlenir.

Taslak geri yüklenirken kullanıcı metin alanına zaten yeni bir metin yazdıysa mevcut değer ezilmez. Böylece çok hızlı konuşma değişimlerinde kullanıcı yazısı korunur.

## Çoklu sekme

`storage` olayı hem taslak anahtarı hem de mevcut sohbet geçmişi anahtarı için izlenir. Bir sekmede konuşma silinirse diğer sekmedeki taslak katmanı bir sonraki senkronizasyonda artık geçersiz olan taslağı temizler.

## Güvenlik ve gizlilik

Taslaklar sadece yerel depolamada tutulur. Yeni network yüzeyi, OAuth scope, secret veya backend endpoint'i yoktur. Tarayıcı erişim alanı içindeki diğer script'ler localStorage'a erişebildiği için bu özellik güvenlik sınırı olarak değerlendirilmemelidir; hassas sırlar ve parolalar için taslak alanı kullanılmamalıdır.

## PWA

`chat-drafts.js` ve `chat-drafts.css` service worker shell listesine eklenir. Cache sürümü `v21` yapılır; böylece yeni varlıklar önceki shell cache'inde unutulmaz.

## Bakım notları

Modül bilinçli olarak `app.js`'in conversation state'ine yeni bir kopya oluşturmaz. Aktif konuşmayı DOM'daki mevcut kimlik üzerinden gözlemler ve yerel draft store'u bağımsız tutar. `MutationObserver` yalnız geçmiş listesi yeniden çizildiğinde restore/cleanup akışını tetikler.

Bu yaklaşım mevcut sohbet render, agent seçimi, tool mode ve streaming koduna müdahaleyi azaltır. Taslak özelliği geri alınırsa `chat-drafts.js`, `chat-drafts.css`, index.html'deki iki referans, service-worker shell kayıtları ve test/doküman dosyası kaldırılabilir; mevcut conversation verisi değişmeden kalır.
