# Smart Fill Performans

Smart Fill tek bir istem üzerinde çalışacak şekilde sınırlandırılmıştır. Maksimum 12 değişken, değer başına 1000 karakter ve çıktı başına 8000 karakter sınırları DOM ve storage yükünü öngörülebilir tutar.

Command palette en fazla 12 sonuç gösterir. Arama her input değişiminde yeniden hesaplanır; kütüphane 120 kayıtla sınırlı olduğundan işlem lineer ve küçük kalır.

Preset listesi istem başına 6 kayıtla sınırlıdır. Her açılışta yalnız aktif istemin presetleri okunur; tüm kütüphanenin presetleri taranmaz.

Önizleme güncellemesi yalnız aktif alan değerleriyle yapılır. Ağ isteği olmadığı için network latency bu akışı etkilemez.

MutationObserver yalnız panel/list subtree'sini izler. Destroy sırasında observer disconnect edilir.

Palette listesi uzun olduğunda `scrollIntoView({block:'nearest'})` kullanır. Görsel animasyonlara ihtiyaç duymaz.

PWA shell cache asset sayısı küçük tutulur; yeni feature iki CSS ve iki JS asset'i ekler.

Performans regresyon sinyalleri: mount süresi, input gecikmesi, uzun değerlerle render, 120 kayıtla palette araması ve 6 preset yenilemesi.

Bu sürümde harici performans telemetry'si eklenmez. Ölçüm gerektiğinde lokal profil veya browser performance tooling kullanılmalıdır.
