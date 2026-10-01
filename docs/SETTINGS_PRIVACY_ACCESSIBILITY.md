# Gizlilik Merkezi Erişilebilirlik

Panel semantik bir section olarak oluşturulur ve başlığı `aria-labelledby` ile ilişkilendirilir. Daraltma düğmesi `aria-expanded` ve `aria-controls` durumunu günceller.

Durum mesajları `role=status` ve `aria-live=polite` kullanır. Her yüzeyin temizleme düğmesi yüzey adını içeren bir `aria-label` taşır.

Klavye kısayolu Ctrl / ⌘ + Shift + R yalnız düzenlenebilir olmayan bir alandayken çalışır. Input, textarea, select, button ve contenteditable hedeflerinde kısayol devre dışıdır.

Dinamik listeler `replaceChildren()` ile yenilenir. Kullanıcı metinleri `textContent` üzerinden ekrana alınır.

Mobil görünümde özet kutuları tek sütuna iner ve temizleme düğmeleri genişler. Forced-colors ortamında sınırlar ve odak göstergeleri sistem renklerini kullanır.

Reduced-motion ortamında panel içi kaydırma davranışı yumuşatılmadan çalışır.

Gelecek UI değişikliklerinde erişilebilirlik testlerinin bozulmaması için roller, durum nitelikleri ve klavye korumaları API sözleşmesi kabul edilir.
