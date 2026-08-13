# Hafize Email Intelligence sözleşmesi

Bu sözleşme Agency Agents içindeki Email Intelligence Engineer yaklaşımını Hafize'nin gelecekteki Gmail connector ve kişisel çalışma alanına uyarlar.

## Amaç

E-posta verisini yalnız düz metin olarak modele vermek yerine konuşma yapısını, göndereni, zamanı ve kaynak mesajı koruyan güvenilir bir veri katmanı oluşturmak.

## Thread önce gelir

Bir Gmail thread'i tek bir uzun belge değildir. Her mesaj ayrı kimliğini korur:

- message id;
- thread id;
- gönderen ve alıcı rolleri;
- gönderim zamanı;
- subject;
- temizlenmiş body;
- attachment metadata;
- varsa parent/reply ilişkisi.

Model veya retrieval katmanı thread özetini kullanabilir; ancak gerektiğinde özgün mesaja geri dönebilmelidir.

## Quote ve signature temizliği

Yanıt zincirlerinde önceki mesajların tekrar kopyalanması retrieval kalitesini bozar. Ingestion sırasında:

1. Yeni yazılan içerik ile quoted history ayrıştırılır.
2. İmza ve otomatik footer bölümleri mümkün olduğunca ayrı metadata olarak tutulur.
3. Aynı metin farklı reply'larda tekrar indekslenmez.
4. Temizlik sırasında özgün message id ve zaman bilgisi kaybedilmez.

Temizlenemeyen belirsiz bölüm sessizce silinmez; düşük güven işaretiyle korunur.

## Yapılandırılmış çıktı

Email intelligence sonucu mümkünse şu alanları ayırır:

```json
{
  "threadId": "...",
  "summary": "...",
  "participants": [],
  "decisions": [],
  "actionItems": [],
  "openQuestions": [],
  "importantDates": [],
  "citations": [
    { "messageId": "...", "reason": "Bu karar bu mesajdan türetildi" }
  ]
}
```

Özet veya action item iddiası kaynak mesaja bağlanamıyorsa kesin bilgi gibi sunulmaz.

## Retrieval ilkeleri

- Kullanıcının hesabı ve mailbox scope'u retrieval filtresinin ilk sınırıdır.
- Thread özeti hızlı aday bulmak için kullanılabilir.
- Nihai cevap için gerektiğinde ilgili özgün mesajlar yeniden alınır.
- Gönderen, tarih, label/folder, participant ve thread metadata'sı filtreleme için korunur.
- Hybrid retrieval ancak ölçülen kalite artışı sağlıyorsa eklenir.

## Attachment davranışı

Attachment yalnız dosya adı olarak değerlendirilmez. Desteklenen tiplerde içerik ayrı extraction adımından geçebilir ve kaynak message id ile ilişkilendirilir. Bilinmeyen veya işlenemeyen dosya türü varmış gibi özetlenmez.

## Gizlilik ve logging

Uygulama logları varsayılan olarak ham e-posta body veya tam thread metni taşımamalıdır. Operasyonel log için message/thread kimliği, işlem sonucu, süre ve güvenli hata kodu yeterlidir.

Kullanıcı silme veya bağlantı kaldırma akışında email-derived index/cache verisi de ilgili retention sözleşmesine göre temizlenebilmelidir.

## Hata durumları

Aşağıdaki durumlar ayrı sınıflandırılır:

- mailbox erişilemiyor;
- message MIME parse edilemiyor;
- attachment extraction başarısız;
- thread eksik veya parçalı;
- kaynak mesaj bulunamadığı için citation doğrulanamıyor;
- retrieval sonucu yeterli güvene sahip değil.

Bu durumlarda sistem uydurma içerikle boşluğu doldurmaz.

## Finish gate

Gmail intelligence özelliği üretime hazır sayılmadan önce en az şu örnekler test edilmelidir:

1. İki mesajlı basit reply zinciri.
2. Uzun quoted-history içeren thread.
3. Birden fazla katılımcılı thread.
4. Attachment içeren mesaj.
5. Türkçe ve İngilizce karışık konuşma.
6. Eksik veya bozuk MIME içerik.
7. Aynı quoted metnin birden fazla mesajda tekrarlandığı zincir.

Başarı kriteri yalnız "özet çıktı" değildir; kaynak mesaj ilişkisi ve tekrar azaltma davranışı da doğrulanmalıdır.
