# Prompt Workspace — QA Plan

## Veri oluşturma

Yeni workspace adı boş bırakılmaz. Aynı isim case-insensitive ikinci kez oluşturulamaz. Varsayılan workspace silinemez.

Yeni collection adı boş bırakılamaz. Aynı isim case-insensitive ikinci kez oluşturulamaz. Varsayılan Genel collection silinemez.

Workflow yalnızca var olan prompt ID'lerinden oluşur ve en fazla 8 adım tutar.

## Workspace activation

Aktif workspace kaydedilmeden başka workspace'e geçilmez. State alanı yalnızca desteklenen sort, filter ve query değerleriyle normalize edilir.

## Collection assignment

Tek prompt ve çoklu seçim için assignment yapılabilir. Geçersiz collection ID genel koleksiyona düşer veya güvenli biçimde reddedilir.

## Revisions

İlk anlamlı kaydetmede revizyon snapshot'ı oluşturulmalıdır. Aynı içerik tekrar kaydedildiğinde gereksiz duplicate revision üretilmemelidir. Bir prompt için 8 sürümden fazlası tutulmamalıdır.

Restore öncesi mevcut sürümün korunması hedeflenir. Restore sonucu yeni bir sürüm kaydı olarak temsil edilir.

## Packs

Export çıktısı JSON olmalıdır. Version ve source alanları bulunmalıdır. Import dosyası 1,5 MB üzerindeyse okunmamalıdır.

ID duplicate senaryosunda mevcut prompt overwrite edilmemelidir. Collections, workspaces ve revisions bağımsız normalize edilmelidir.

## Smart Insert

Tek prompt Ekle composer'ı doldurur. Birden fazla prompt birleşimi 4 istemle sınırlıdır. Append modu mevcut composer metnini korur.

Hiçbir smart insert akışı form submit etmemelidir.

## Workflow

Workflow çalıştırıldığında step sırası korunur. Replace ilk/sonuç metnini belirler; append önceki çıktı üzerine ekler. Eksik prompt varsa workflow null sonucu vermelidir.

## Batch editor

Seçim 40 istemi aşmamalıdır. Tag güncellemesi core normalization ile aynı limitleri kullanmalıdır. Favori durumu boş bırakıldığında değiştirilmemelidir. Collection seçimi ayrı assignment katmanından uygulanır.

## Audit

Duplicate prompt ID, stale revision, geçersiz collection assignment ve eski workspace selectedIds gibi bozulmalar tespit edilmelidir. Audit sonucu prompt body içeriğini loglamamalıdır.

## UI

Her dialog Escape ile kapanmalıdır. Status mesajları live region olmalıdır. Focusable kontrol gerçek native form kontrolü olmalıdır.

## PWA

Yeni JS/CSS asset'leri shell listesinde bulunmalıdır. `/api/` istekleri network-only kalmalıdır. Prompt verisi cache'e eklenmemelidir.

## Regression

Mevcut Prompt Library create/edit/delete/search/favorite/import/export davranışı korunmalıdır. Yeni modüllerin mount edilmemesi temel kütüphaneyi kullanılmaz hale getirmemelidir.
