# Prompt Workspace — Migration

## Mevcut Prompt Library

Yeni katmanlar mevcut `hafize.prompt-library.v1` kayıtlarını taşımadan okur. Temel prompt ID'leri değişmez.

## Workspace oluşturma

Eski prompt kayıtlarından otomatik workspace üretmek zorunlu değildir. Kullanıcı yeni bir workspace oluşturduğunda mevcut state kopyalanır; prompt gövdeleri ayrı tutulur.

## Collections

Collection storage bağımsızdır. Bir prompt collection'a atanmadıysa `general` kabul edilir. Migration sırasında bilinmeyen collection ID'leri güvenli biçimde dışarıda bırakılır.

## Revisions

Revision storage bağımsızdır. Eski prompt'lardan geriye dönük revision üretilmez. İlk sonraki anlamlı düzenleme yeni snapshot oluşturabilir.

## Workflows

Workflow migration prompt ID tabanlıdır. Prompt silinmişse workflow step'i artık çalıştırılamaz ve compile güvenli şekilde null sonucu üretir.

## Packs

Pack import mevcut kayıtların üstüne yazmaz. Aynı prompt ID varsa duplicate olarak sayılır. Aynı isimli collection/workspace değerleri de doğrudan overwrite edilmez.

## Sürümleme

Her yeni storage formatı `version` alanı taşır. Desteklenmeyen version import sırasında reddedilir. Gelecekte bir migration gerekiyorsa mevcut version'dan hedef version'a explicit dönüştürücü eklenmelidir.

## Kullanıcı verisi

Migration otomatik sunucu aktarımı yapmaz. Kullanıcı isterse önce mevcut Prompt Library'yi JSON olarak dışa aktarabilir, sonra yeni Workspace katmanında paket içe aktarabilir.

## Rollback

Migration sonrası hata varsa yeni workspace/collection/revision anahtarları silinmeden UI eski yüzeye döndürülebilir. Temel prompt storage bağımsız olduğundan geri alma sırasında kayıp riski düşüktür.

## QA

Migration doğrulamasında boş veya bozuk localStorage değerleri test edilmelidir. Import sonrası item count, duplicate count, collection count ve revision referansları kontrol edilmelidir.
