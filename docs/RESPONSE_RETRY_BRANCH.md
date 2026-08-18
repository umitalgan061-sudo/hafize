# Response retry branch contract

Hafize'nin **Tekrar dene** eylemi artık önceki kullanıcı isteğini mevcut konuşmanın sonuna otomatik olarak tekrar göndermez. Eylem, ilgili kullanıcı turunun mevcut güvenli **Düzenle** branch sınırına delege edilir.

## Davranış

- Tamamlanmış her doğrudan `user → assistant` çifti kendi retry hedefini alabilir; böylece yalnız son yanıt değil geçmiş bir Hafize yanıtı da kaynak bağlamından yeniden denenebilir.
- Her retry düğmesi yalnız hemen öncesindeki canonical kullanıcı turunun edit-branch eylemine bağlanır.
- Streaming sürerken tüm retry eylemleri gizlenir.
- Composer'da gönderilmemiş taslak varsa retry branch başlatılmaz.
- Retry, hedef kullanıcı mesajındaki `.message-edit-btn` güvenli eylemini kullanır; ayrı bir storage veya conversation mutation uygulamaz.
- Edit branch hedef kullanıcı turundan önceki canonical bağlamı yeni konuşmaya kopyalar ve eski kullanıcı isteğini geçici composer taslağı olarak geri yükler.
- Kaynak konuşma ve eski assistant yanıtı değişmeden kalır.
- Composer restore sonrasında kullanıcı metni isterse değiştirir ve **Gönder** eylemini ayrıca verir. Retry kodu `requestSubmit`, send-button click veya doğrudan provider isteği çalıştırmaz.
- Aynı konuşmadaki retry action'ları idempotent biçimde decorate edilir; MutationObserver yeniden render'ı duplicate düğme üretmez.

## Güvenlik sınırı

Retry katmanı network, connector, credential, cookie veya persistent storage erişimi eklemez. Agent/tool yetkisi model sağlayıcısından bağımsız backend default-deny kalır. GitHub/Gmail/Canva gibi dış write/send/merge işlemlerinin explicit approval gereksinimi değişmez.

Edit branch özelliği kullanılamıyorsa retry eski otomatik-submit davranışına geri düşmez; **fail-closed** biçimde kullanıcıya güvenli düzenleme dalının hazır olmadığını bildirir.

## Geri alma

Revert durumunda `public/response-retry.js` eski davranışına döndürülebilir. Conversation schema migrasyonu veya backend API değişikliği yoktur.
