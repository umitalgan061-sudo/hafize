# Schedule Edit Deployment

Backend ve frontend aynı release içinde yayınlanmalıdır.

PATCH endpoint backend deploy edilmeden eski client edit gönderemez; bu nedenle backend önce veya aynı atomic release içinde açılmalıdır.

Service worker yeni UI asset'lerini shell cache'e alır; API cache davranışı değişmez.

Rollback backend PATCH ile ilişkili frontend'i de birlikte geri almalıdır.

Persistence schema migration gerekmediğinden data migration job çalıştırılmaz.

Worker process restart zorunlu değildir; update mevcut persisted schedule state üzerinden çalışır.

İlk doğrulama düzenlenmiş bir görevin gerçek worker tarafından claim edilmesiyle tamamlanır.
