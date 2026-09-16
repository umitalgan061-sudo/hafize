# Schedule Edit User Flows

## Tekil düzenleme
Görev paneli → Planlandı görev → Düzenle → alanları değiştir → Değişiklikleri kaydet → liste yenilenir.

## Hızlı erteleme
Planlandı görev → +15 dk veya +1 saat → PATCH yalnız runAt ile gönderilir → liste yenilenir.

## Tekrar planla
Planlandı görev → Tekrar planla → yeni POST → yeni scheduleId oluşur → eski kayıt korunur.

## Toplu erteleme
Planlandı görevleri seç → +15 dk/+1 saat → seçilen her id sırayla PATCH edilir → seçim temizlenir.

## Toplu iptal
Planlandı görevleri seç → Seçilenleri iptal et → onay → DELETE istekleri sırayla uygulanır.

## Başarısız işlem
Mutation hata verirse kullanıcı status alanında sonucu görür. Başarılı kayıtlar korunur; panel yeniden yüklenerek sunucu state'i esas alınır.
