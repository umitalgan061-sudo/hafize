# Hafize kişisel bellek sözleşmesi

Bu belge, Hafize'nin gelecekteki kalıcı kişisel bellek katmanı için runtime sınırını tanımlar. Kalıcı storage, otomatik memory extraction veya yeni model tool'u bu aşamada hâlâ açılmaz.

## Amaç

Kullanıcının açıkça saklamak istediği kimlik, tercih, proje ve not bilgisini daha sonra güvenli biçimde hatırlayabilmek; bunu sessiz veri toplama sistemine dönüştürmemek.

## Temel kurallar

- Her memory komutu bir `ownerId` ile tek kullanıcı kapsamına bağlıdır.
- Yazma yalnız `explicitUserIntent: true` ile kabul edilir. Modelin "önemli görünüyor" değerlendirmesi tek başına yazma yetkisi değildir.
- Kaynak türü yalnız `user_statement`, `user_note` veya `user_import` olabilir. Assistant tahmini bağımsız kaynak olarak kabul edilmez.
- İlk sürümde yalnız `identity`, `preference`, `project` ve `note` kategorileri vardır.
- Memory write yalnız `sensitivity: personal` kabul eder. Daha hassas sınıflar fail-closed reddedilir ve ayrı güvenlik/storage değerlendirmesi olmadan kalıcılaştırılamaz.
- Okuma her zaman aynı `ownerId` içinde yapılır; kategori filtresi ve sonuç limiti bounded kalır.
- Silme geniş doğal dil eşleşmesine dayanmaz. Tek bir server-generated `memoryId` ve `exactMatch: true` gerekir.
- Command contract bilinmeyen alanları reddeder; arbitrary metadata taşınmaz.

## Güncel runtime store aşaması

`createPersonalMemoryStore()` yalnız backend süreci içinde çalışan ilk store katmanıdır. Bu aşama kalıcı disk storage değildir ve model-facing bir memory tool açmaz.

- Yeni kayıt kimlikleri store tarafından üretilir; istemci kendi `memoryId` değerini seçemez.
- Write/read/delete işlemleri önce mevcut command contract'tan geçirilir.
- Retrieval, herhangi bir skorlamadan önce `ownerId` ile filtrelenir; farklı kullanıcının kaydı aday kümeye giremez.
- İlk retrieval yöntemi deterministik lexical eşleşmedir. Embedding, vector index veya reranker varmış gibi davranılmaz.
- `readForContext()` en fazla retrieval boundary limitini kullanır ve kayıtları #67'deki ikinci owner/provenance kontrolünden geçirir.
- Ajan-facing context sonucunda `ownerId`, sensitivity ve store timestamp alanları taşınmaz; provenance korunur.
- Exact-delete yabancı owner veya bulunmayan kayıt için aynı `MEMORY_NOT_FOUND` sonucunu verir.
- Store kapasitesi bounded'dır ve ID collision fail-closed sonuçlanır.
- Snapshot/restore şeması yalnız sonraki şifreli persistence katmanına güvenli handoff hazırlığıdır; snapshot doğrudan public API değildir.
- Snapshot restore bilinmeyen alan, bozuk kayıt, duplicate `memoryId`, yanlış schema ve kapasite aşımını reddeder.

Bu aşamada process restart sonrası memory kaybolur. Hafize bunu "kalıcı hafıza" olarak kullanıcıya sunmamalıdır; kalıcılık ancak aşağıdaki storage gereksinimleri tamamlandığında açılır.

## Storage katmanına geçmeden önce zorunlu gereksinimler

1. Sunucu tarafında korumalı veya şifreli kalıcı storage.
2. Owner scope'un storage sorgusunda backend tarafından zorunlu uygulanması.
3. `memory.read`, `memory.write`, `memory.delete` izinlerinin model sağlayıcısından bağımsız backend default-deny policy ile yönetilmesi.
4. Yazma ve silme işlemlerinde kullanıcıya görünür kontrol yüzeyi.
5. Kaynak/provenance bilgisinin kayıtla birlikte tutulması.
6. Retention ve kullanıcı tarafından toplu export/delete davranışlarının ayrıca tanımlanması.
7. Hassas içerik sınıflandırmasının storage sınırında fail-closed uygulanması.
8. Retrieval eval'lerinde yanlış kullanıcıya veri dönmeme, kaynak izlenebilirliği ve alakasız memory enjeksiyonu ölçümleri.

## Bilerek bu aşamaya alınmayanlar

- Düz JSON veya localStorage tabanlı kalıcı kişisel bellek.
- Kullanıcıdan habersiz otomatik memory write.
- Conversation içindeki her cümlenin otomatik olarak memory'ye çıkarılması.
- Global kullanıcılar arası vector index.
- Secret/credential sınıfındaki içeriği model context'ine geri verme.
- `agents/registry.json` içine henüz memory tool permission eklemek.
- Process-local store'u kalıcı storage gibi kullanıcıya tanıtmak.

Bu sıra, Jarvis incelemesindeki kalıcı bellek ürün fikrini Hafize'nin mevcut least-privilege ve server-side authorization mimarisine bağımsız biçimde uyarlar.
