# Revision History Threat Model

## Varlıklar

Korunan varlıklar prompt başlığı, prompt body, etiketler, revision kayıtları ve revision tarih bilgisidir.

## Güven sınırı

Tüm veriler browser local storage ve DOM sınırında tutulur. Backend revision endpoint'i bulunmaz.

## Tehdit: HTML injection

Kullanıcı revision body içine HTML veya script yazabilir. Mitigasyon: tüm görüntüleme textContent/pre node üzerinden yapılır; HTML parser kullanılmaz.

## Tehdit: Storage poisoning

Kötü biçimli JSON veya beklenmeyen object gelebilir. Mitigasyon: parse try/catch, type checks, bounded normalizeStore.

## Tehdit: Resource exhaustion

Çok sayıda prompt/revision veya aşırı uzun text storage'ı şişirebilir. Mitigasyon: 120 prompt, 10 revision, body/title/tag sınırları ve 1 MB export limiti.

## Tehdit: Restore abuse

Yanlış içerik geri yüklenebilir. Mitigasyon: kullanıcı onayı ve restore öncesi manual snapshot.

## Tehdit: Clickjacking benzeri UI karmaşası

Dialog paneli fixed overlay ve açık role semantics ile izole edilir. Action düğmeleri explicit button type kullanır.

## Tehdit: Data exfiltration

Revision module dış ağ çağrısı yapmaz. Export yalnız kullanıcı tıklaması ile local Blob oluşturur.

## Tehdit: Cross-feature corruption

Restore favori ve useCount alanlarını hedef prompt'tan taşır. Revision snapshot bu alanları tutmaz.

## Tehdit: Stale references

Aktif prompt başka bir local storage değişikliği ile kaybolursa listeden yeniden okunur. Restore olmayan prompt için başarısız sonuç döner.

## Tehdit: Browser API uyumsuzluğu

StorageEvent desteklenmezse custom refresh event fallback'i vardır; core refresh gereksinimi kritik olmayan path'tir.

## Kabul

Bu tehditler release test matrisi ve source-contract testleriyle doğrulanır.
