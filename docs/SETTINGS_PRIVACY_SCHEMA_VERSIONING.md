# Schema Versioning

Privacy report `version: 1` olarak başlar.

Storage surface schema version'ları ürün modülleri tarafından yönetilir; privacy center bunları rewrite etmez.

Rapor formatı ileride version 2'ye geçerse version 1 reader compatibility notu tutulmalıdır.

Eski report dosyalarının import edilmesi bu feature'ın kapsamı değildir; report yalnız diagnostic/export çıktısıdır.
