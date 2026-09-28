# Geçici Yönerge Sınırı

Regeneration instruction yalnız yeni HTTP request'in message listesine eklenir.

Instruction ayrı ChatMessage olarak localStorage'a persist edilmez.

Instruction maksimum 600 karakterdir.

Null byte temizlenir.

Boş instruction request'e eklenmez.

Presetler sabit ve sınırlıdır.

Custom instruction textContent/value üzerinden okunur.

Alternates request'e dahil edilmez.

Generation metadata instruction içeriğini içermez.

Tool mode açık veya kapalı olsa aynı transient instruction boundary korunur.

Feature backend API sözleşmesini değiştirmez.
