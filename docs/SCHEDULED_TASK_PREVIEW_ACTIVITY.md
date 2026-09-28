# Preview İşlem Geçmişi

Preview modalı açıkken son sekiz işlem yalnız JavaScript belleğinde gösterilebilir.

Örnek olaylar: önizleme açıldı, ayrıntılar açıldı, düzenlemeye dönüldü, planlama onaylandı ve önizleme kapatıldı.

Bu geçmiş localStorage veya sessionStorage'a yazılmaz. Sayfa kapandığında ve modül destroy edildiğinde kayıt temizlenir.

Amaç server-side audit oluşturmak değil; kullanıcıya aynı modal içindeki son etkileşimin kısa bağlamını vermektir.
