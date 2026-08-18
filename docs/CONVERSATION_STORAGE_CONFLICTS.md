# Conversation storage conflict policy

Hafize sohbet geçmişi `hafize.conversations.v1` anahtarında yerel ve bounded bir snapshot olarak tutulur. Birden fazla sekme aynı origin üzerinde açıkken her sekme kendi bellek kopyasını taşıdığı için eski bir sekmenin bütün snapshot'ı yeniden yazması, başka sekmede daha sonra oluşmuş sohbetleri veya mesajları sessizce ezebilir.

Bu sözleşme yalnız bu çok-sekmeli yazma yarışını ele alır. Yeni backend, cloud sync veya uzak persistence eklemez.

## Üç yönlü uzlaştırma

Write boundary her sekme için üç canonical görünüm kullanır:

- `baseline`: bu sekmenin son okuduğu veya başarıyla yazdığı canonical snapshot,
- `current`: yazma anında localStorage içinde gerçekten bulunan canonical snapshot,
- `candidate`: uygulamanın şimdi yazmak istediği canonical snapshot.

`current === baseline` ise uzak değişiklik yoktur ve candidate normal biçimde yazılır. `candidate === baseline` ise yerel değişiklik yoktur ve current korunur. İkisi de baseline'dan ayrılmışsa conversation ID bazında üç yönlü uzlaştırma yapılır.

## Veri kaybını önleme kuralları

- Başka sekmede eklenen yeni conversation, stale candidate içinde bulunmasa da korunur.
- Aynı conversation iki sekmede farklı yeni message ID'leri aldıysa bounded mesaj birleşimi yapılır.
- Aynı message ID iki tarafta farklı içerik taşıyorsa daha yeni conversation `updatedAt` tarafı tercih edilir; duplicate message üretilmez.
- Yerel sekme conversation'ı silmiş fakat uzak sekme baseline sonrasında conversation'ı değiştirmişse stale yerel silme uzak güncellemeyi yok etmez; uzak sürüm korunur.
- Uzak sekme conversation'ı silmiş fakat stale yerel sekme onu değiştirmişse silme kazanır. Kullanıcının başka sekmede sildiği içerik sessizce yeniden canlandırılmaz.
- Her birleşim mevcut 30 conversation, 200 message, conversation/global content budget ve allowlist normalizasyonundan tekrar geçer.

## Baseline neden storage event ile otomatik ilerletilmez?

Bir sekme `storage` event'i aldığında kendi in-memory conversation state'i henüz yeniden kurulmuş değildir. Baseline'ı yalnız event nedeniyle current değere ilerletmek, bir sonraki stale write'ın uzak eklemeleri yerel silme gibi yorumlamasına yol açabilir. Bu nedenle baseline yalnız bu sekmenin gerçekten yazdığı canonical sonuçla ilerler.

## Görünür sinyal

Gerçek bir uzlaştırma veya uzak değişikliği koruma oluştuğunda yalnız sayısal metadata taşıyan `hafize:conversation-storage-merged` olayı yayınlanabilir. Event içine title, message content, owner, trace, token veya credential konmaz.

## Güvenlik sınırı

- Yeni network isteği veya backend endpoint yoktur.
- Conversation storage hâlâ yalnız `user` ve `assistant` rollerini ve mevcut dar alan allowlist'ini kabul eder.
- Secret/credential alanları canonical snapshot'a eklenmez.
- sessionStorage veya diğer localStorage anahtarları conflict resolver tarafından değiştirilmez.
- Agent registry, provider seçimi, tool permission ve external write approval sözleşmeleri değişmez.
- `.env`, credential dosyaları ve `.github/workflows/` kapsam dışıdır.

## Test beklentileri

Regresyonlar en az şu durumları kapsar: bağımsız remote/local ekleme, aynı conversation'a eşzamanlı mesaj ekleme, stale local delete karşısında remote update, remote delete karşısında stale local update, aynı message ID edit çakışması, non-conversation storage passthrough ve event payload veri minimizasyonu.