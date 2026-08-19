# Conversation branch source retention

## Amaç

Bir fork, düzenleme dalı veya `Tekrar dene` dalı oluşturmak kaynak sohbeti sessizce silmemelidir. Hafize branch UI'si kaynağın korunduğunu açıkça söyler; storage retention davranışı da bu sözleşmeyle uyumlu olmak zorundadır.

## Risk

Canonical conversation store en fazla 30 sohbet tutar ve `updatedAt` sırasına göre normalize edilir. Yeni bir dal güncel zamanla başa girerken çok eski bir kaynak sohbet 30. sıradaysa normalizasyon yeni dalı tutup kaynağı düşürebilir. Bu durumda yeni dal görünürken kaynak sohbet ve lineage bağlantısı kaybolur.

## Davranış

- Fork/edit branch candidate yazılmadan önce hem yeni conversation ID hem source conversation ID canonical candidate içinde bulunmalıdır.
- Yeni dal hayatta kalıyor fakat kaynak retention/content budget nedeniyle düşüyorsa işlem fail-closed olur ve canonical storage değiştirilmez.
- Edit akışında önceden hazırlanmış session-only composer handoff reddedilen branch için temizlenir.
- Persistence sırasında başka sekme source conversation'ı kaldırırsa işlem başarı/reload/lineage/model-copy aşamalarına ilerlemez.
- Bu yarışta yeni branch tek başına persist olmuşsa yalnız o yeni branch best-effort kaldırılır; başka conversation verileri amaçlı olarak silinmez.
- `Tekrar dene` mevcut güvenli edit-branch düğmesini kullandığından aynı source-retention sınırını otomatik miras alır.

## Neden başka sohbeti otomatik silmiyoruz?

Kaynağı korumak için bir veya daha fazla ilgisiz sohbeti sessizce retention kurbanı seçmek de veri kaybıdır. Hafize bu durumda kullanıcı adına yeni bir destructive seçim yapmaz. Kullanıcı storage sınırında yer açtıktan sonra işlemi tekrar deneyebilir.

## Güvenlik sınırları

Bu koruma yeni storage key, backend endpoint, provider çağrısı, agent tool permission veya dış write/send/merge işlemi eklemez. Branch source kontrolü yalnız canonical local conversation ID'leri üzerinde çalışır. Token, credential, `ownerId`, `traceId`, connector verisi veya message içeriği yeni metadata alanına kopyalanmaz.
