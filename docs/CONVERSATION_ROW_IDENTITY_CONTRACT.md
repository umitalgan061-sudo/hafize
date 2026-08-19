# Conversation row identity contract

Hafize sohbet satırları birden fazla UI katmanı tarafından işlenebilir. Çekirdek uygulama storage sırasıyla satır üretirken `conversation-organize.js` sabitlenmiş sohbetleri DOM içinde yeniden sıralayabilir. Branch-lineage gibi sonraki katmanlar bu nedenle yalnız DOM sıra numarasını conversation storage dizisiyle eşleştirerek kimlik çıkarmamalıdır.

## Kaynak önceliği

`conversation-branch-lineage.js` satır kimliğini şu sırayla çözer:

1. `conversation-organize.js` tarafından daha önce doğrulanıp satıra yazılmış `data-conversation-organize-id` değeri mevcut canonical conversation ID kümesinde ise authoritative kabul edilir.
2. Aynı ID ikinci bir satır tarafından tekrar talep edilirse duplicate mapping kabul edilmez.
3. Güvenilir organizer kimliği olmayan satırlarda mevcut geçerli ve henüz kullanılmamış `data-conversation-id` korunabilir.
4. Yalnız kalan etiketsiz/stale satırlar canonical conversation listesindeki henüz kullanılmamış ID'lerle deterministik olarak doldurulur.
5. Eşlenecek geçerli ID kalmadıysa stale `data-conversation-id` kaldırılır.

Bu sözleşme sabitleme/yeniden sıralama sonrasında aktif branch'in yanlış conversation'a bağlanmasını ve `Kaynak sohbeti aç` eyleminin yanlış satıra yönelmesini önler.

## Mutation davranışı

Lineage observer yalnız satır ekleme/çıkarma, aktif `class` değişimi ve organizer kimliğinin `data-conversation-organize-id` değişimini izler. Genel attribute gözlemi yapılmaz; gereksiz observer döngüsü oluşturulmaz.

## Fail-closed sınırlar

- Organizer ID canonical storage'da yoksa güvenilir sayılmaz.
- Duplicate organizer ID ikinci kez kullanılmaz.
- ID biçimi mevcut bounded allowlist üzerinden doğrulanır.
- Branch metadata store'una yeni alan eklenmez.
- Mesaj içeriği, title, model/tool sonucu, owner/trace veya credential bu kimlik eşleme katmanına taşınmaz.
- Yeni backend endpoint, network isteği, connector veya agent tool yetkisi yoktur.

## Geriye uyumluluk

Organizer katmanı yüklenmemişse legacy index tabanlı mapping yalnız etiketsiz satırlara fallback olarak devam eder. Bu, mevcut çekirdek conversation listesi storage sırasını koruduğu sürece önceki davranışla uyumludur.

## Test kanıtı

- `scripts/test-conversation-lineage-row-identity.mjs`: pinned/reordered satırlar, duplicate organizer ID, stale ID ve organizer olmayan legacy fallback davranışını doğrular.
- `scripts/test-conversation-lineage-organize-integration.mjs`: organizer'ın ID etiketleme ve DOM reorder sözleşmesi ile lineage'ın aynı identity kaynağını kullandığını, ayrıca network/secret/shell yüzeyinin açılmadığını doğrular.
