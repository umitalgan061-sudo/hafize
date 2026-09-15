# Yerel Veri Merkezi — Güvenli Silme

## Tekli silme

Tekli silme yalnız seçilen registry key'ini kaldırır. Kullanıcı confirmation vermeden işlem yapılmaz.

## Seçimli silme

Bulk controller en fazla 8 alanı aynı işlemde hedefleyebilir. Confirmation mesajı alan adlarını listeler.

## Tümünü temizleme

`clearAllKnown` yalnız immutable registry key'lerini hedefler. Bilinmeyen `hafize.*` alanları korunur.

## Geri alınamazlık

Client storage silme fiziksel olarak geri alınamaz. Data center recovery sistemi değildir.

## Export ile ayrım

Manifest before-clear teknik metadata sağlar; içerik backup'ı sağlamaz. Kullanıcı backup gerekiyorsa ilgili feature export'u kullanılmalıdır.

## Race handling

Başka sekmede state değişirse clear controller yeni snapshot üretir. Clear hedefi yine registry descriptor'ına dayanır.

## Failure

Tek bir `removeItem` exception'ı diğer kayıtların silinmesini sessizce başarıya çevirmemelidir.

## Audit

Silme sonrası integrity audit yeniden çalışır ve boş alanları normal state olarak gösterir.
