# Konuşma Dalları Migration Notu

Fork metadata mevcut conversation JSON kayıtlarına opsiyonel alanlar ekler:

- forkOf
- forkMessageId
- forkDepth
- forkNote

Eski kayıtlar bu alanları içermediğinde normal conversation olarak çalışır.

Yeni app-shell normalize aşaması alanları bounded biçimde kabul eder. Bilinmeyen başka alanlar üzerinden branch davranışı oluşturulmaz.

Mevcut localStorage anahtarı değiştirilmez. Bu nedenle ayrı migration job veya backend backfill gerekmez.

Fork child silinse parent kayıt kalır. Parent silinse child metadata'sı tarihsel referans olarak kalabilir; UI parent bulunamadığını gösterir.

Yedek export formatı version 1 ile açıkça işaretlenir. Bu turda otomatik import uygulanmadığından eski recovery dosyaları üzerine sessiz yazma riski yoktur.

Rollback sırasında metadata alanları conversation parser tarafından opsiyonel kabul edilir.
