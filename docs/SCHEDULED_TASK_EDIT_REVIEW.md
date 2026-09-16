# Schedule Edit Review

## Backend review
- Update yalnız scheduled kayıtları kabul ediyor.
- Owner kontrolü mutation'dan önce yapılıyor.
- Agent registry doğrulaması update sırasında tekrar yapılıyor.
- Credential policy create ve update için aynı.
- Public response ownerId içermiyor.

## Persistence review
- Update mutation queue üzerinden serialize ediliyor.
- Save başarısızsa state commit edilmiyor.
- Snapshot schema version değişmiyor.

## Frontend review
- Edit form mevcut değerleri taşıyor.
- Kaydetme PATCH kullanıyor.
- Quick postpone aynı PATCH yolunu kullanıyor.
- Bulk işlemler bounded selection ile sınırlı.
- Native controls ve accessible status korunuyor.

## Release review
- PWA cache yalnız shell asset'lerini içeriyor.
- API response'ları cache dışı.
- Rollback planı mevcut.
