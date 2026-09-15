# Yerel Veri Merkezi — İşletim Prosedürü

1. Kullanıcı Settings alanını açar.
2. Data center snapshot'ı mevcut yönetilen key'leri okur.
3. Özet, alan sayısı ve byte boyutu hesaplanır.
4. Kullanıcı tek bir alanı seçerse yalnız o key için confirmation gösterilir.
5. Kullanıcı tüm yönetilen verileri seçerse toplu confirmation gösterilir.
6. Manifest seçilirse yalnız metadata oluşturulur ve geçici Blob URL revoke edilir.
7. Başka sekmede değişiklik gelirse snapshot yeniden okunur.

## Operasyon notları

Storage error herhangi bir backend incident'ı değildir. Client storage kullanılamıyorsa kullanıcı verisine dokunulmaz.

## Güvenlik notları

Registry dışında kalan key'ler otomatik silinmez. Yeni storage key eklemek kod review gerektirir.

## Rollback

PR revert edilir. Rollback sırasında data center clear fonksiyonu çağrılmaz.

## Evidence

Sorun araştırmasında browser console ve network paneli kullanılabilir. Module kaynaklı network request beklenmediği için gözlenen requestler başka feature'lara aittir.
