# Chat Markdown Uyumluluk Garantileri

Markdown katmanı mevcut konuşma kayıt formatını değiştirmez. `hafize.conversations.v1` içindeki mesajların `role`, `content`, `id` ve timestamp alanları aynı kalır.

Renderer başarıyla kurulamazsa sohbet tamamen bozulmak zorunda değildir. `app.js` mesajı üretmeye devam eder; Markdown yalnız presentation layer olarak eklenir. Bu nedenle feature asset'i eksik bir eski shell ile açılan kayıtlı sohbet, metni yine gösterebilir.

Kullanıcı mesajları hiçbir zaman model çıktısı gibi biçimlendirilmez. Bu, geçmişte düz metin olarak görünen kullanıcı içeriklerinin aynı görünümde kalmasını sağlar.

Streaming sırasında sonlandırılmamış fence desteklenir. Cevap tamamlandığında aynı kaynak tekrar çizilir. Bu davranış, model cevabının bir anda tek parça gelmesi ile SSE üzerinden parça parça gelmesi arasında görsel farkı azaltır.

Markdown sözdizimi kısıtlı bir alt kümedir. Tanınmayan syntax düz metin kalır. Bu, bir model metninin parser tarafından yanlışlıkla komut veya HTML'e dönüştürülmesini önleyen bir uyumluluk politikasıdır.

PWA eski cache sürümünden yeni sürüme geçtiğinde yeni JS/CSS shell assetleri birlikte alınır. API ve credential yüzeyi bu asset'ler üzerinden değişmez.

Geriye dönük export işlemlerinde raw mesaj metni kullanılır. Renderer'ın oluşturduğu DOM ağacı depolama formatına yazılmaz.
