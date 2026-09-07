# Calendar / reminder read-first boundary

Takvim ve hatırlatıcı entegrasyonu önce read-only sorgu sözleşmesini netleştirir. `normalizeCalendarRead()` owner, tarih aralığı, tür ve metin sorgusunu sınırlar; runtime yalnız owner-scope veriyi cache'ler ve sorgular.

Yazma işlemleri için ayrı approval sözleşmesi vardır. Create/update/delete event ve reminder operasyonları açık kullanıcı onayı olmadan kabul edilmez; bu tur dış takvim sağlayıcısına hiçbir yazma çağrısı yapılmaz.

Sonraki connector implementasyonu bu sözleşmeyi sağlayan `source.read()` adaptörü olarak eklenebilir; provider/auth/secret yönetimi sözleşmenin dışında tutulur.
