# Schedule Edit Decisions

## PATCH seçimi
Update işlemi kısmi değişiklik doğurduğu için item endpoint'inde PATCH kullanılır. POST yeni kayıt, DELETE iptal semantiğini korur.

## UI güvenlik sınırı
Client yalnız UX sağlar. Ownership, state, credential ve veri doğrulaması backend'de tekrar yapılır.

## Aynı kayıt
Edit mevcut scheduleId'yi korur. Kullanıcının görevin kimliğini ve execution izini değiştirmesi engellenir.

## Repeat-plan
Kopyalama ayrı POST ile yeni schedule üretir; kaynak kayıt sessizce taşınmaz.

## Quick postpone
Sadece runAt değiştirilir ve genel update path kullanılır; farklı bir endpoint eklenmez.

## Bulk
Bulk işlemler frontend'de mevcut tekil mutation'ların kontrollü ardışık kullanımıdır. Yeni bulk API yüzeyi oluşturulmaz.
